import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: "dist/offline.js",
  write: false,
  loader: { ".woff2": "dataurl" },
  define: { "import.meta.env.DEV": "false" },
  legalComments: "inline",
});
const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;
await mkdir(path.join(root, "dist"), { recursive: true });
const boot = await readFile(path.join(root, "public/boot.js"), "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#233f39"><title>Maisie & the Magic Kingdom</title><style>${css.replaceAll("</style", "<\\/style")}</style></head><body><div id="app"><div style="min-height:100vh;display:grid;place-content:center;text-align:center;padding:30px;background:#fffaf0;color:#294a3f;font:16px/1.7 system-ui,sans-serif"><h1>Maisie &amp; the Magic Kingdom</h1><p>Getting your adventure ready…</p><p>If this screen stays here, open the game in a web browser.<br>A file preview cannot run the game.</p><noscript>Enable JavaScript in your browser to play.</noscript></div></div><script>${boot.replaceAll("</script", "<\\/script")}</script><script>${js.replaceAll("</script", "<\\/script")}</script></body></html>`;
await writeFile(path.join(root, "dist", "Maisies-Magic-Kingdom.html"), html);
const notices = await Promise.all(
  [
    ["Three.js", "node_modules/three/LICENSE"],
    ["DM Sans", "node_modules/@fontsource-variable/dm-sans/LICENSE"],
    ["Fraunces", "node_modules/@fontsource-variable/fraunces/LICENSE"],
  ].map(
    async ([name, file]) =>
      `## ${name}\n\n${await readFile(path.join(root, file), "utf8")}\n`,
  ),
);
await writeFile(
  path.join(root, "dist", "THIRD-PARTY-LICENSES.txt"),
  notices.join("\n"),
);
console.log(
  "Standalone solo adventure written to dist/Maisies-Magic-Kingdom.html. All fonts and game assets are embedded.",
);
