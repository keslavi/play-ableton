# playAble

Koa server for AbletonOSC bridge on macOS.

## Features

- OSC over UDP bridge for AbletonOSC
- Caches track and scene names with 0-based index mapping
- Starts scenes through a simple REST API
- Broadcasts updates to browser clients over WebSocket
- Includes mute and volume command endpoints for upcoming UI controls

## Requirements

- Node.js 20+

## Setup

1. Copy environment file:

   cp .env.example .env

2. Install dependencies:

   npm install

3. Start in dev mode:

   npm run dev

4. Open the built-in static client:

  http://127.0.0.1:3000/

## API

- GET /api/health
- GET /api/tracks
- GET /api/scenes
- POST /api/song/stop
- POST /api/scenes/:sceneIndex/start
- POST /api/tracks/:trackIndex/mute
- POST /api/tracks/:trackIndex/volume

Examples:

Start scene 2:

curl -X POST http://127.0.0.1:3000/api/scenes/2/start

Mute track 4:

curl -X POST http://127.0.0.1:3000/api/tracks/4/mute \
  -H "Content-Type: application/json" \
  -d '{"mute": true}'

Set track volume to 0.7:

curl -X POST http://127.0.0.1:3000/api/tracks/4/volume \
  -H "Content-Type: application/json" \
  -d '{"level": 0.7}'

## WebSocket

- URL: ws://127.0.0.1:3000/ws
- Events:
  - connected
  - cache.updated
  - scene.start.requested
  - scene.started
  - osc.error

## Static Client Folder

- Folder: `client/`
- Served from `/` by Koa static middleware
- Current files are a lightweight monitor/prototype and can be replaced later by a Vite build output.

## Notes on AbletonOSC addresses

Default OSC message addresses are configurable in .env and may need to match your AbletonOSC setup. Keep these in sync if your device script uses different OSC paths.

## Running With TouchOSC And playAble Together

If two apps need the same AbletonOSC receive stream, use the UDP fanout helper.

Suggested port map:

- AbletonOSC send/listen: 11000
- AbletonOSC receive target: 11001
- Fanout listener: 11001
- playAble local OSC listener: 11003
- TouchOSC local receive port: 11004

Start fanout:

FANOUT_LISTEN_PORT=11001 FANOUT_TARGETS=127.0.0.1:11003,127.0.0.1:11004 npm run osc:fanout

Then configure:

- playAble .env with OSC_LOCAL_PORT=11003 and OSC_REMOTE_PORT=11000
- TouchOSC to receive on 11004

This keeps AbletonOSC sending to one port while both clients receive mirrored OSC packets.
