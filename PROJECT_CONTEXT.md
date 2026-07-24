# playAble — Project Context

Canonical reference for how this app works. Read this before re-exploring the codebase.

## What It Is

**playAble** is a live-performance control surface for **Ableton Live**. Each Ableton **scene** is treated as a **song** in the setlist. A browser UI talks to a Node/Koa server, which bridges to Ableton via **AbletonOSC** (UDP/OSC). Not MIDI, not the Live Python API.

**Run:** `npm run dev` → http://127.0.0.1:3000 (Node 20+, AbletonOSC installed in Live)

## User-Facing Features

| Area | What it does |
|------|--------------|
| **Songs** | Browse scenes from Live; search/filter (wildcards, tags); tap Play to fire a scene |
| **Playback** | Stop button; auto-stop when playback ends, all clip slots finish, or a timer fallback |
| **Mixer** | Per-track mute toggles, volume sliders, ±2 dB steps; double-tap restores session "original" level |
| **Library** | Song metadata; import/replace PDF attachments by title (even without a matching Live scene) |
| **Docs** | PDF lyrics/chords open automatically on scene start; modal iframe viewer |
| **Notes/Tags** | Per-song notes (≤500 chars), tags for filtering |
| **Status** | WebSocket connection indicator; event log page |

UI: ES6/ESNext browser SPA in `client/` (`type="module"`, no framework or bundler).

---

## Architecture

```
Browser (client/)  ──REST /api/*──►  Koa (src/server.js)
                 ──WebSocket /ws──►       │
                                          ▼
                                   LiveService (domain/liveService.js)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
             AbletonClient          SongProfileStore        CacheStore
             (osc/)                 (song-profiles.json)    (in-memory)
                    │
                    ▼ UDP OSC (default: send 11000, listen 11001)
             Ableton Live + AbletonOSC remote script
```

**Key files**

| Path | Role |
|------|------|
| `src/server.js` | Bootstrap: Koa, WebSocket, services |
| `src/api/routes.js` | All REST endpoints |
| `src/domain/liveService.js` | Scene start/stop, mix apply/save, OSC events, auto-stop |
| `src/domain/songProfileStore.js` | Read/write `data/song-profiles.json` |
| `src/domain/cacheStore.js` | In-memory track/scene names and colors |
| `src/osc/abletonClient.js` | OSC command send + message normalization |
| `src/ws/broadcastHub.js` | Fan-out LiveService events to WS clients |
| `client/app.js` | Full UI (~2000 lines): songs, mixer, library, PDF modal |
| `data/song-profiles.json` | Persisted mixer settings + song metadata |
| `data/song-docs/` | PDF files (`{sanitizedTitle}.pdf`) |

---

## Ableton Integration (OSC)

Uses [AbletonOSC](https://github.com/ideoforms/AbletonOSC) remote script. All OSC addresses are overridable in `.env` (`OSC_*_ADDRESS`).

| Action | Default OSC address |
|--------|---------------------|
| Fire scene | `/live/scene/fire` + index |
| Stop | `/live/song/stop_playing` |
| Track mute/volume | `/live/track/get\|set/mute`, `/live/track/get\|set/volume` |
| Scene/track names | `/live/song/get/scenes/name`, `/live/song/get/track_names` |
| Playing state | `/live/song/start_listen/is_playing`, `/live/song/get/is_playing` |

Indexes are **0-based** (matches AbletonOSC).

### Start scene (`POST /api/scenes/:index/start`)

1. Apply saved mix for that song (per-song profile → global defaults)
2. Arm auto-stop controller (+ optional timer, `OSC_SCENE_FALLBACK_STOP_MS`)
3. Send `/live/scene/fire`
4. Client loads PDF and opens doc modal if available

### Stop song (`POST /api/song/stop`)

Sends `/live/song/stop_playing`; clears armed stop state; client returns to Songs page on WS events.

### Auto-stop (while armed after scene start)

1. `playback-ended` — Ableton reports `is_playing = false`
2. `slots-ended` — no track playing the active scene's slot
3. `timer` — fallback timeout elapsed

---

## Mixer — What Persists Song to Song

Three layers of mixer state:

### 1. Global defaults (`defaults` in `song-profiles.json`)

Baseline volume/mute for **all songs** when a per-song value isn't set.

- **Set:** Mixer page "Set Defaults" → snapshots current Ableton state
- **Apply:** "Reset to Defaults"
- **Note:** Defaults are only updated via explicit "Set Defaults" / recheck — not on server startup

### 2. Per-song mix (`songs[titleKey].levels` / `.mutes`)

Saved **per scene title** (not index), so profiles survive scene reordering in Live.

- **Applied automatically** when a scene starts (`resolveSongTrackMix`): global default for each track, replaced only when the song profile has an explicit override for that track (`Object.hasOwn` on `levels`/`mutes`)
- **Saved automatically** when mute/volume is adjusted **while that song is actively playing**; values matching global defaults are not stored as overrides
- Adjustments outside an active scene affect Live only — **not** written to a song profile

### 3. Session-only (browser)

`trackOriginalLevels` — captured on slider pointer-down; double-click/double-tap restores that snapshot. Not persisted to disk.

| Setting | Persists how |
|---------|--------------|
| Volume/mute per track for a song | Per-song profile, keyed by **scene title** |
| Volume/mute baseline | Global `defaults` |
| Notes, tags | Per-song profile |
| PDF attachment | File on disk (`data/song-docs/{songPath}.pdf`) |
| Double-click fader restore | Browser session only |

### `song-profiles.json` shape

```json
{
  "version": 1,
  "defaults": { "levels": { "0": 0.8 }, "mutes": { "13": true }, "updatedAt": "..." },
  "songs": {
    "<normalized title key>": {
      "sceneTitle": "Africa - Toto - A",
      "sceneTitleKey": "africa toto a",
      "songPath": "Africa_-_Toto_-_A",
      "levels": { "21": 1.0 },
      "mutes": { "13": true },
      "notes": "...",
      "tags": ["80s"],
      "useFixedDocFont": false,
      "updatedAt": "..."
    }
  }
}
```

Title key: lowercase, accents stripped, punctuation removed.

---

## PDF Lyrics / Chords

- **Storage:** `data/song-docs/{sanitizedSceneTitle}.pdf` (spaces → `_`, max 120 chars)
- **Upload:** Library Import/Replace, or song meta Attachment button; can attach by title without a Live scene
- **Serve:** Raw PDF bytes (`Content-Type: application/pdf`) — no server-side text extraction in the live path
- **Display:** On Play, client fetches `/api/songs/:sceneIndex/document`, embeds in iframe modal with `#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
- **Fuzzy matching:** `findDocBasenameForTitle()` in `client/app.js` handles title/filename mismatches (accents, `&`→`and`, trailing BPM/key tokens, prefix fallback)
- **`useFixedDocFont`:** Stored per song; `src/docs/htmlConverter.js` exists for PDF→HTML but is **not wired** to any API route yet

---

## API Quick Reference

**Playback:** `POST /api/scenes/:index/start`, `POST /api/song/stop`

**Mixer:** `POST /api/tracks/:index/mute|volume`, `GET /api/tracks/state`, `POST /api/tracks/defaults/add|reset|clear`

**Songs:** `GET|PATCH /api/songs/:index/profile`, `GET|POST|DELETE /api/songs/:index/document`, `GET /api/songs/available-docs`

**Cache:** `GET /api/health`, `GET /api/tracks`, `GET /api/scenes`

**WebSocket** (`/ws`): `connected`, `cache.updated`, `scene.start.requested`, `scene.started`, `song.stop.requested`, `song.playback.ended`, `osc.connection.status`, `osc.error`

---

## Tech Stack

Node 20+ ES modules · Koa 2 · ws · osc (UDP) · Zod · @koa/multer · dotenv · node:test

**Client:** ES6/ESNext (ES modules, `async`/`await`, modern syntax). Prefer ES6+ over legacy vanilla patterns (no `var`, no IIFEs, no callback-heavy code when `async`/`await` fits).

---

## Gotchas

1. **Index vs title:** Playback uses scene **index**; persistence uses scene **title**.
2. **Explicit song overrides only:** A track uses a song-level setting only when that track key exists in the song profile; matching-default adjustments are not persisted as overrides.
3. **Optional OSC fan-out:** `scripts/osc-fanout.js` mirrors UDP for TouchOSC + playAble sharing one AbletonOSC stream.
