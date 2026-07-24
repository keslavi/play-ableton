# playAble

Live-performance control surface for **Ableton Live**. Each Ableton **scene** is a **song** in your setlist. A browser UI talks to a Node/Koa server, which bridges to Ableton via **[AbletonOSC](https://github.com/ideoforms/AbletonOSC)** over UDP/OSC.

## Features

### Songs
- Browse scenes synced from Ableton (0-based indexes)
- Search and filter by name, wildcards, and tags
- **Play** fires a scene; **Stop** ends playback
- Auto-stop when playback ends, all clip slots finish, or a configurable timer elapses

### Mixer
- Per-track mute toggles and volume sliders with ±2 dB step buttons
- Double-tap/double-click a fader to restore its session "original" level
- **Global defaults** — baseline volume/mute for all songs (Set Defaults / Reset to Defaults on the Mixer page)
- **Per-song mix** — volume/mute remembered per scene **title** (not index), applied automatically when a song starts and saved when you adjust the mixer while that song is playing

### Library & documents
- Per-song notes (≤500 chars) and tags
- Import or replace **PDF lyrics/chords** by song title (even without a matching Live scene)
- PDF opens automatically in a full-screen modal when a scene starts (if a matching file exists)

### Status
- WebSocket-driven connection indicator (Ableton online/offline)
- Event log page

## Requirements

- Node.js 20+
- Ableton Live with AbletonOSC installed and selected as a control surface

## Ableton Setup

macOS paths shown below; Windows paths differ — see [Ableton's remote script guide](https://help.ableton.com/hc/en-us/articles/209072009-Installing-third-party-remote-scripts).

In `/Users/<user>/Music/Ableton/User Library`:

1. Add [AbletonOSC](https://github.com/ideoforms/AbletonOSC)
2. Add [m4l-connection-kit](https://github.com/Ableton/m4l-connection-kit)
3. Restart Ableton Live
4. To view OSC logs: `/Users/<user>/Music/Ableton/User Library/Remote Scripts/AbletonOSC/logs`

## playAble Setup

1. Copy environment file:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start in dev mode:

   ```bash
   npm run dev
   ```

4. Open the client:

   http://127.0.0.1:3000/

Production-style (no file watcher): `npm run start-live`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (watches `src/`, `client/`, `.env`) |
| `npm run start-live` | Start without nodemon |
| `npm run osc:fanout` | UDP fan-out for sharing OSC with another client (e.g. TouchOSC) |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |

## Data

| Path | Contents |
|------|----------|
| `data/song-profiles.json` | Global mixer defaults, per-song volume/mute, notes, tags |
| `data/song-docs/` | PDF attachments (`{sanitizedSceneTitle}.pdf`) |

Song profiles are keyed by **normalized scene title**, so they survive scene reordering in Live as long as names stay the same.

## API

### Health & cache

- `GET /api/health` — server status, Ableton connection, OSC config
- `GET /api/tracks` — cached track list
- `GET /api/scenes` — cached scene list

### Playback

- `POST /api/scenes/:sceneIndex/start` — apply saved mix, fire scene
- `POST /api/song/stop` — stop playback (`{ "reason": "manual" }` optional)

### Mixer

- `POST /api/tracks/:trackIndex/mute` — `{ "mute": true }`
- `POST /api/tracks/:trackIndex/volume` — `{ "level": 0.7 }` (0–1)
- `GET /api/tracks/state` — current Ableton levels and mutes
- `GET /api/tracks/defaults` — stored global defaults
- `POST /api/tracks/defaults/add` — snapshot current Ableton state as defaults
- `POST /api/tracks/defaults/reset` — apply stored defaults to Ableton
- `POST /api/tracks/defaults/clear` — clear stored defaults

### Song profiles & documents

- `GET /api/songs/profiles` — all song profiles
- `GET /api/songs/:sceneIndex/profile` — profile for one scene
- `PATCH /api/songs/:sceneIndex/profile` — update notes, tags, `useFixedDocFont`
- `PATCH /api/songs/profile/by-title` — update by scene title (library-only songs)
- `GET /api/songs/available-docs` — list PDF basenames in song-docs dir
- `GET /api/songs/:sceneIndex/document` — serve PDF bytes
- `GET /api/songs/document/by-title?sceneTitle=` — serve PDF by title
- `POST /api/songs/:sceneIndex/document` — upload PDF (multipart `file`)
- `POST /api/songs/document/by-title` — upload PDF by title
- `DELETE /api/songs/:sceneIndex/document` — delete PDF for scene

### Examples

Start scene 2:

```bash
curl -X POST http://127.0.0.1:3000/api/scenes/2/start
```

Mute track 4:

```bash
curl -X POST http://127.0.0.1:3000/api/tracks/4/mute \
  -H "Content-Type: application/json" \
  -d '{"mute": true}'
```

Set track volume to 0.7:

```bash
curl -X POST http://127.0.0.1:3000/api/tracks/4/volume \
  -H "Content-Type: application/json" \
  -d '{"level": 0.7}'
```

## WebSocket

- URL: `ws://127.0.0.1:3000/ws`
- Events:
  - `connected`
  - `cache.updated`
  - `scene.start.requested`
  - `scene.started`
  - `song.stop.requested`
  - `song.playback.ended`
  - `song.playback.status`
  - `osc.connection.status`
  - `osc.error`

## Client

The UI lives in `client/` — a browser SPA written in **modern ES6/ESNext** (ES modules via `<script type="module">`, `const`/`let`, `async`/`await`, arrow functions, destructuring, etc.). No framework or bundler; served from `/` by Koa static middleware. Pages: **Songs**, **Mixer**, **Library**, **Log**, plus a PDF document modal.

## AbletonOSC addresses

Default OSC message addresses are configurable in `.env` (`OSC_*_ADDRESS`) and should match your AbletonOSC setup. Default ports: send to `127.0.0.1:11000`, listen on `11001`.

## Running with TouchOSC and playAble together

If two apps need the same AbletonOSC receive stream, use the UDP fanout helper.

Suggested port map:

- AbletonOSC send/listen: 11000
- AbletonOSC receive target: 11001
- Fanout listener: 11001
- playAble local OSC listener: 11003
- TouchOSC local receive port: 11004

Start fanout:

```bash
FANOUT_LISTEN_PORT=11001 FANOUT_TARGETS=127.0.0.1:11003,127.0.0.1:11004 npm run osc:fanout
```

Then configure:

- playAble `.env` with `OSC_LOCAL_PORT=11003` and `OSC_REMOTE_PORT=11000`
- TouchOSC to receive on 11004

This keeps AbletonOSC sending to one port while both clients receive mirrored OSC packets.

## Further reading

See [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) for architecture diagrams, mixer persistence details, PDF matching logic, and implementation notes for contributors and AI assistants.
