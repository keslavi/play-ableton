import test from "node:test";
import assert from "node:assert/strict";
import { resolveSongTrackMix } from "../src/domain/songMix.js";

test("resolveSongTrackMix applies defaults when song has no explicit override", () => {
  const profile = {
    levels: { "0": 0.4 },
    mutes: {}
  };
  const defaults = {
    levels: { "0": 0.8, "1": 0.9 },
    mutes: { "1": true }
  };

  assert.deepEqual(resolveSongTrackMix("0", profile, defaults), {
    level: 0.4,
    mute: false,
    hasSongLevel: true,
    hasSongMute: false
  });

  assert.deepEqual(resolveSongTrackMix("1", profile, defaults), {
    level: 0.9,
    mute: true,
    hasSongLevel: false,
    hasSongMute: false
  });
});

test("resolveSongTrackMix uses song mute override instead of default", () => {
  const profile = {
    levels: {},
    mutes: { "1": false }
  };
  const defaults = {
    levels: {},
    mutes: { "1": true }
  };

  assert.deepEqual(resolveSongTrackMix("1", profile, defaults), {
    level: null,
    mute: false,
    hasSongLevel: false,
    hasSongMute: true
  });
});
