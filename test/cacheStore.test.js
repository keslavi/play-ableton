import test from "node:test";
import assert from "node:assert/strict";
import { CacheStore } from "../src/domain/cacheStore.js";

test("CacheStore keeps 0-based indexes for tracks and scenes", () => {
  const cacheStore = new CacheStore();
  cacheStore.setTracks(["Drums", "Bass"]);
  cacheStore.setScenes(["Intro", "Drop"]);

  assert.deepEqual(cacheStore.getTracks(), [
    { index: 0, name: "Drums" },
    { index: 1, name: "Bass" }
  ]);

  assert.deepEqual(cacheStore.getScenes(), [
    { index: 0, name: "Intro" },
    { index: 1, name: "Drop" }
  ]);
});

test("CacheStore upserts sparse indexes", () => {
  const cacheStore = new CacheStore();
  cacheStore.upsertTrack(3, "FX");
  cacheStore.upsertTrack(1, "Bass");

  assert.deepEqual(cacheStore.getTracks(), [
    { index: 1, name: "Bass" },
    { index: 3, name: "FX" }
  ]);
});
