import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { once } from "node:events";
import { attachRooms } from "../rooms.js";

function message(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", listener);
      reject(new Error("Room message timed out"));
    }, 3000);
    function listener(raw) {
      const data = JSON.parse(raw.toString());
      if (predicate(data)) {
        clearTimeout(timer);
        socket.off("message", listener);
        resolve(data);
      }
    }
    socket.on("message", listener);
  });
}
test("two family members share position, leave cleanly, and reject invalid rooms", async () => {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const rooms = attachRooms(wss);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `ws://127.0.0.1:${server.address().port}`;
  const one = new WebSocket(url),
    two = new WebSocket(url);
  await Promise.all([once(one, "open"), once(two, "open")]);
  try {
    let received = message(one, (m) => m.type === "joined");
    one.send(JSON.stringify({ type: "create", name: "Maisie<script>" }));
    const joined = await received;
    assert.match(joined.code, /^[A-F0-9]{6}$/);
    assert.equal(rooms.size, 1);
    received = message(two, (m) => m.type === "error");
    two.send(JSON.stringify({ type: "join", name: "Mama", code: "NOPE00" }));
    assert.match((await received).message, /could not find/);
    received = message(
      one,
      (m) => m.type === "players" && m.players.length === 2,
    );
    two.send(JSON.stringify({ type: "join", name: "Mama", code: joined.code }));
    const shared = await received;
    assert.equal(shared.players[0].name, "Maisiescript");
    received = message(
      two,
      (m) => m.type === "players" && m.players.some((p) => p.x === 5),
    );
    one.send(
      JSON.stringify({
        type: "move",
        position: { x: 5, y: 0, z: 3, rotation: 1, world: 0 },
      }),
    );
    const moved = await received;
    assert.equal(moved.players.find((p) => p.id === joined.id).x, 5);
    received = message(
      one,
      (m) => m.type === "players" && m.players.length === 1,
    );
    two.send(JSON.stringify({ type: "leave" }));
    await received;
    received = message(one, (m) => m.type === "left");
    one.send(JSON.stringify({ type: "leave" }));
    await received;
    assert.equal(rooms.size, 0);
  } finally {
    one.close();
    two.close();
    await new Promise((r) => wss.close(r));
    await new Promise((r) => server.close(r));
  }
});
