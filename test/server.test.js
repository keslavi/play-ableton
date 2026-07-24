import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRuntime } from "../src/server.js";

class FakeAbletonClient extends EventEmitter {
  constructor() {
    super();
    this.startedScenes = [];
    this.muteCalls = [];
    this.volumeCalls = [];
  }

  async requestTracks() {
    this.emit("tracksSnapshot", { names: ["Kick", "Bass"] });
  }

  async requestScenes() {
    this.emit("scenesSnapshot", { names: ["Intro", "Verse"] });
  }

  async startScene(sceneIndex) {
    this.startedScenes.push(sceneIndex);
  }

  async muteTrack(trackIndex, mute) {
    this.muteCalls.push({ trackIndex, mute });
  }

  async setTrackVolume(trackIndex, level) {
    this.volumeCalls.push({ trackIndex, level });
  }
}

const createTestRuntime = async ({ songProfiles = null } = {}) => {
  const fakeClient = new FakeAbletonClient();
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testDataDir = path.join(os.tmpdir(), `playable-test-${testId}`);
  const songProfilesPath = path.join(testDataDir, "song-profiles.json");
  await fs.mkdir(testDataDir, { recursive: true });
  if (songProfiles) {
    await fs.writeFile(songProfilesPath, `${JSON.stringify(songProfiles, null, 2)}\n`, "utf8");
  }

  const runtime = createRuntime({
    config: {
      server: { host: "127.0.0.1", port: 0 },
      storage: {
        songProfilesPath,
        songDocsDir: path.join(testDataDir, "song-docs")
      },
      osc: { refreshIntervalMs: 0, addresses: {} }
    },
    transport: {
      async open() {},
      close() {}
    },
    abletonClient: fakeClient,
    logger: {
      info() {},
      warn() {},
      error() {}
    }
  });

  await runtime.start();
  const address = runtime.server.address();
  const baseUrl = `http://${address.address}:${address.port}`;

  return { runtime, fakeClient, baseUrl };
};

test("GET /api/health returns ok", async (t) => {
  const { runtime, baseUrl } = await createTestRuntime();
  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
});

test("GET / serves static client page", async (t) => {
  const { runtime, baseUrl } = await createTestRuntime();
  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /playAble Monitor/);
});

test("GET /api/tracks returns cached names and indexes", async (t) => {
  const { runtime, baseUrl } = await createTestRuntime();
  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${baseUrl}/api/tracks`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.deepEqual(payload.tracks, [
    { index: 0, name: "Kick" },
    { index: 1, name: "Bass" }
  ]);
});

test("POST /api/scenes/:sceneIndex/start forwards to Ableton client", async (t) => {
  const { runtime, fakeClient, baseUrl } = await createTestRuntime();
  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${baseUrl}/api/scenes/1/start`, {
    method: "POST"
  });

  assert.equal(response.status, 200);
  assert.deepEqual(fakeClient.startedScenes, [1]);
});

test("POST /api/scenes/:sceneIndex/start applies defaults unless song overrides", async (t) => {
  const { runtime, fakeClient, baseUrl } = await createTestRuntime({
    songProfiles: {
      version: 1,
      defaults: {
        levels: { "0": 0.6, "1": 0.9 },
        mutes: { "1": true },
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      songs: {
        verse: {
          sceneTitle: "Verse",
          sceneTitleKey: "verse",
          songPath: "Verse",
          levels: { "0": 0.3 },
          mutes: {},
          notes: "",
          tags: [],
          useFixedDocFont: false,
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      }
    }
  });
  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${baseUrl}/api/scenes/1/start`, { method: "POST" });
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.deepEqual(payload.event.appliedMix, {
    levels: { "0": 0.3, "1": 0.9 },
    mutes: { "0": false, "1": true }
  });
  assert.deepEqual(fakeClient.volumeCalls, [
    { trackIndex: 0, level: 0.3 },
    { trackIndex: 1, level: 0.9 }
  ]);
  assert.deepEqual(fakeClient.muteCalls, [
    { trackIndex: 0, mute: false },
    { trackIndex: 1, mute: true }
  ]);
});

test("song documents are stored and listed by scene title", async (t) => {
  const { runtime, baseUrl } = await createTestRuntime();
  t.after(async () => {
    await runtime.stop();
  });

  const formData = new FormData();
  formData.append("file", new Blob(["%PDF-1.4 test\n"], { type: "application/pdf" }), "anything.pdf");

  const uploadResponse = await fetch(`${baseUrl}/api/songs/1/document`, {
    method: "POST",
    body: formData
  });
  assert.equal(uploadResponse.status, 200);

  const docsResponse = await fetch(`${baseUrl}/api/songs/available-docs`);
  assert.equal(docsResponse.status, 200);
  const docsPayload = await docsResponse.json();
  assert.deepEqual(docsPayload.pdfs, ["Verse"]);

  const documentResponse = await fetch(`${baseUrl}/api/songs/1/document`);
  assert.equal(documentResponse.status, 200);
  assert.equal(documentResponse.headers.get("content-type"), "application/pdf");

  const documentBody = await documentResponse.text();
  assert.match(documentBody, /%PDF-1.4/);
});

test("PATCH /api/songs/profile/by-title persists pdf cue points", async (t) => {
  const { runtime, baseUrl } = await createTestRuntime();
  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${baseUrl}/api/songs/profile/by-title`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sceneTitle: "Verse",
      notes: "",
      pdfCuePoints: [
        { atSeconds: 12.34, scrollRatio: 0.42 },
        { atSeconds: 2.18, scrollRatio: 0.05 }
      ]
    })
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.profile.pdfCuePoints, [
    { atSeconds: 2.2, scrollRatio: 0.05 },
    { atSeconds: 12.3, scrollRatio: 0.42 }
  ]);

  const profilesResponse = await fetch(`${baseUrl}/api/songs/profiles`);
  assert.equal(profilesResponse.status, 200);
  const profilesPayload = await profilesResponse.json();
  assert.deepEqual(profilesPayload.profiles[0].pdfCuePoints, [
    { atSeconds: 2.2, scrollRatio: 0.05 },
    { atSeconds: 12.3, scrollRatio: 0.42 }
  ]);
});
