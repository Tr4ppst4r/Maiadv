# Maisie & the Magic Kingdom

A playable 3D reading adventure inspired by collectible platform games, built for Maisie. Explore with Lily, help Kit, Luna, Axel, and Clover, collect gems, earn reading stars, and unlock the kingdom. Optional private rooms let up to six family members explore together.

## Play locally

The game is a browser website. For phones and tablets, use its hosted web address in Safari or Chrome; opening a downloaded HTML file in a file-preview application will not run the game. No hosted address has been published yet.

The website automatically switches to a complete 2D canvas adventure if 3D graphics cannot start or its graphics context is lost. The welcome screen also offers **Play with simple graphics**, and the grown-up corner can switch modes while keeping progress. This mode has the same reading challenges, world unlocks, gems, journal, and co-op position sharing.

### Publish a browser link

The `dist` folder is a complete static website, with relative asset paths that support either a domain root or a subdirectory. It can be hosted on GitHub Pages, Netlify, or another static web host. Static hosting supports the complete solo adventure. Family co-op needs the Node/WebSocket server described below.

For the selected `Tr4ppst4r/Maiadv` repository, `.github/workflows/pages.yml` builds and deploys GitHub Pages when source is pushed to `main`, or when the workflow is run manually. In repository **Settings → Pages**, select **GitHub Actions** as the build source first. Successful deployment reports the actual website URL. The game source and workflow are in the GitHub repository. The build and tests pass, but publishing is waiting for the repository owner to enable Pages. The connected GitHub integration cannot change that setting (GitHub returns `403 Resource not accessible by integration`). Select **GitHub Actions** in [the repository's Pages settings](https://github.com/Tr4ppst4r/Maiadv/settings/pages), then run **Publish the browser game** from the Actions tab. A website URL is not live until deployment reports success.

`netlify.toml` provides the equivalent build configuration for Netlify. A connected hosting account is needed to publish there.

The launch page contains visible recovery instructions if JavaScript is blocked or the application fails to load, rather than leaving an empty screen.

For solo play without a server, open **`dist/Maisies-Magic-Kingdom.html`** in a recent desktop browser. It contains all of the game's code, fonts, and visual assets. Create it with `npm run export:offline` after installing dependencies. The full reading journey works offline; optional browser speech services may require an internet connection. Private co-op uses the server version below.

Requires Node.js 22.12+ (tested with Node 24) and npm. Use a recent browser. WebGL enables 3D; the automatic simple-graphics mode uses a regular drawing canvas.

```sh
cd /workspace/Maiadv
npm ci --cache /workspace/.npm-cache
npm run dev
```

The server listens on port **5173**. `PORT=3000 npm run dev` changes the port. Use the environment's application access mechanism to reach the server; for local development, open the server address in a browser.

For production:

```sh
npm run build
npm start
```

The Node server serves the built game and the `/party` WebSocket endpoint. Deploy behind an HTTPS proxy that supports WebSocket upgrades. Do not expose the Vite development server as a production deployment. Fonts, models, and visual assets are included locally; the game does not fetch artwork from third-party services.

## Controls and progression

- **WASD / arrow keys:** walk. **Shift:** run. **Space:** jump.
- **Click the ground:** walk to that spot. Touch screens have a joystick and jump button.
- **E / on-screen prompt:** open a nearby book or greet a friend.
- **M / Worlds:** travel between unlocked worlds.
- Read three books in each world to earn stars and open the next chapter. Incorrect answers offer hints and another try. There are no timers, lives, or lost stars.
- Gems are extra exploration collectibles. Reading stars unlock the main journey.
- Revisit books and use **My words** for practice. The grown-up corner controls narration, sound, calmer movement, and a confirmed progress reset.

| Chapter          | Learning                                     | Story                                                                             |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| Sunshine Meadow  | Initial /k/ and /s/ sounds; a first CVC word | Meet Kit and start exploring with Lily                                            |
| Rainbow Woods    | /l/ sounds and CVC blending                  | Follow Luna's light                                                               |
| Silverdrop Lake  | Rhyming and /s/ sounds                       | Play with Axel                                                                    |
| Clover's Cottage | Sentence completion and word order           | Help Clover return to Mama                                                        |
| Starlight Castle | Celebrate and revisit learned words          | Kit gives Maisie the silver star; farewell hugs; return home with Lily; goodnight |

## Speaking and saving

Narration uses the browser's available English text-to-speech voices. If a voice is not installed, a grown-up can read the visible text. Voice quality and phoneme pronunciation vary by device; the lessons use whole-word examples instead of treating letter-name synthesis as a phonics model.

After every reading activity, a child can repeat a short phrase and select **I practised aloud**. The optional microphone uses the browser's SpeechRecognition API when available. It may send audio to the browser vendor's speech service and may require HTTPS and permission. Microphone access only starts after the child or adult presses its button. Audio and transcripts are not saved by this application or sent to its game server. Recognition is never used to grade a child or gate progress. Manual practice works without a microphone.

Reading progress is saved in this browser's local storage. It is not an account or a cloud backup, and clearing browser data removes it. Each player in co-op keeps separate learning progress.

## Private family co-op

Use **Play together**, choose a nickname, and create a room. A family member opens the game on the **same running server**, selects Play together, and enters the six-character code. The server shares avatar positions and nicknames. There is no public player list, public matchmaking, text chat, or voice chat. Up to six players can join a room. Rooms live in memory and disappear when everyone leaves or the server restarts.

This is a small cooperative RPG adventure, not a massively multiplayer service. It has no persistent account system, shared global economy, cross-server matchmaking, or production moderation infrastructure. Private room codes are invitation codes, not authenticated accounts. A production release for families would need deployment, device testing, and decisions about account access and parental controls.

## Story and character reference

The supplied `Maisie_Magic_Kingdom_Production_Handoff.pdf` and displayed character sheet informed this **game adaptation**. The full manuscript and original separate image assets were not supplied; the dialogue is newly written for this game and does not claim to reproduce the book verbatim.

- Maisie: curly brown hair, green eyes, freckles, yellow shirt, denim overalls, purple bow and shoes.
- Lily: a white cat with green eyes and a purple collar; Maisie's companion from the start.
- Kit: a blue bunny with a white belly. He gives the final **silver star**.
- Luna: a white unicorn with rainbow mane and tail, gold horn and heart necklace, and no body marking.
- Axel: a pink axolotl with external gills and a blue bow tie.
- Clover: the grey lost kitten, distinct from Lily, reunited with Mama.

All game models and UI illustrations are original simplified geometry/vector interpretations of that reference. The handoff's printing, pagination, and manuscript-production directions were treated as document context, not as instructions to change the user's game request. No Banjo-Kazooie artwork, audio, or characters are included.

## Development and validation

```sh
npm test
npm run build
npm run test:e2e
```

The browser tests use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to another Chromium binary if needed. They exercise all 12 books, wrong-answer recovery, microphone fallback, saved progress, world locks, the ending, real two-browser co-op, and touch movement. Additional launch tests cover unavailable WebGL and speech, graphics-context loss, co-op recovery, mobile static hosting under a subdirectory, and disabled JavaScript. The development-only `?test=1` hook lets tests move directly between books without changing the puzzle-solving or reward path. It is removed from production builds.

- `src/content.js`: worlds, story dialogue, and educational activities.
- `src/world.js`: Three.js world, movement, collectibles, interaction, and remote avatars.
- `src/characters.js`: original 3D character models.
- `src/main.js` / `src/style.css`: accessible dialogs, learning flow, journal, and responsive interface.
- `src/progress.js`: validated local progress and reward gating.
- `server.js` / `rooms.js`: development/production hosting and private room networking.

Each cloud task already has an isolated checkout. Use this checkout directly; do not create a Git worktree unless explicitly requested.
