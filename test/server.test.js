import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import os from "node:os";
import { createRuntime } from "../src/server.js";

class FakeAbletonClient extends EventEmitter {
  constructor() {
    super();
    this.startedScenes = [];
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

  async muteTrack() {}

  async setTrackVolume() {}
}

const createTestRuntime = async () => {
  const fakeClient = new FakeAbletonClient();
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testDataDir = path.join(os.tmpdir(), `playable-test-${testId}`);
  const runtime = createRuntime({
    config: {
      server: { host: "127.0.0.1", port: 0 },
      storage: {
        songProfilesPath: path.join(testDataDir, "song-profiles.json"),
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
