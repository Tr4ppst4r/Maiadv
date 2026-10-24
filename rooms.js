import { randomBytes, randomUUID } from "node:crypto";
export function attachRooms(wss) {
  const rooms = new Map();
  const send = (ws, data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  };
  const broadcast = (room) => {
    const players = [...room.values()].map((p) => p.state);
    for (const p of room.values()) send(p.ws, { type: "players", players });
  };
  wss.on("connection", (ws) => {
    let roomCode = null,
      player = null,
      count = 0,
      bucket = Date.now();
    const leave = () => {
      if (roomCode && rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        room.delete(player?.state.id);
        if (!room.size) rooms.delete(roomCode);
        else broadcast(room);
      }
      roomCode = null;
      player = null;
    };
    ws.on("message", (raw) => {
      if (Date.now() - bucket > 1000) {
        count = 0;
        bucket = Date.now();
      }
      if (++count > 35) return;
      let m;
      try {
        m = JSON.parse(raw.toString());
      } catch {
        return send(ws, {
          type: "error",
          message: "That message could not be read.",
        });
      }
      if (!m || typeof m !== "object") return;
      if (m.type === "create" || m.type === "join") {
        const name =
          typeof m.name === "string"
            ? m.name
                .replace(/[^a-zA-Z0-9 -]/g, "")
                .trim()
                .slice(0, 18)
            : "";
        if (!name)
          return send(ws, {
            type: "error",
            message: "Choose a short nickname first.",
          });
        let code;
        if (m.type === "create") {
          if (rooms.size >= 1000)
            return send(ws, {
              type: "error",
              message: "The kingdom is busy. Please try again soon.",
            });
          do {
            code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
          } while (rooms.has(code));
        } else {
          code = typeof m.code === "string" ? m.code.trim().toUpperCase() : "";
          if (!rooms.has(code))
            return send(ws, {
              type: "error",
              message:
                "We could not find that room. Check the six-letter code.",
            });
          if (rooms.get(code).size >= 6)
            return send(ws, {
              type: "error",
              message: "This room has six friends already.",
            });
        }
        leave();
        if (!rooms.has(code)) rooms.set(code, new Map());
        roomCode = code;
        player = {
          ws,
          state: {
            id: randomUUID(),
            name,
            x: 0,
            y: 0,
            z: 16,
            rotation: 0,
            world: 0,
          },
        };
        rooms.get(code).set(player.state.id, player);
        send(ws, { type: "joined", code, id: player.state.id });
        broadcast(rooms.get(code));
      } else if (m.type === "move" && player) {
        const p = m.position;
        if (
          !p ||
          !["x", "y", "z", "rotation", "world"].every((k) =>
            Number.isFinite(p[k]),
          )
        )
          return;
        if (
          !Number.isInteger(p.world) ||
          p.world < 0 ||
          p.world > 4 ||
          Math.hypot(p.x, p.z) > 34 ||
          p.y < 0 ||
          p.y > 8
        )
          return;
        Object.assign(player.state, {
          x: p.x,
          y: p.y,
          z: p.z,
          rotation: p.rotation,
          world: p.world,
        });
        broadcast(rooms.get(roomCode));
      } else if (m.type === "leave") {
        leave();
        send(ws, { type: "left" });
      }
    });
    ws.on("close", leave);
    ws.on("error", () => {});
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  wss.on("close", () => clearInterval(heartbeat));
  return rooms;
}
