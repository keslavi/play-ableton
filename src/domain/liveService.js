import { EventEmitter } from "node:events";
import { resolveSongTrackMix } from "./songMix.js";

const DEFAULT_PLAYING_SLOT_POLL_INTERVAL_MS = 1000;
const DEFAULT_SONG_TIME_POLL_INTERVAL_MS = 5000;
const TRACK_STATE_SNAPSHOT_TIMEOUT_MS = 1200;
const SCENE_AUTO_STOP_GRACE_MS = 3000;

export class LiveService extends EventEmitter {
  #abletonClient;
  #cacheStore;
  #songProfileStore;
  #refreshIntervalMs;
  #sceneFallbackStopMs;
  #playingSlotPollIntervalMs;
  #songTimePollIntervalMs;
  #logger;
  #refreshTimer;
  #playbackTimer;
  #playingSlotTimer;
  #currentSongIsPlaying;
  #playbackStopArmed;
  #activeSceneIndex;
  #lastPlaybackResponseAt;
  #abletonOnline;
  #sceneStopTimer;
  #sceneStopToken;
  #trackPlayingSlots;
  #sceneSlotsObservedSinceArm;
  #currentSongTimeSeconds;
  #trackLevels;
  #trackMutes;
  #sceneStopGraceUntil;

  constructor({
    abletonClient,
    cacheStore,
    songProfileStore = null,
    refreshIntervalMs,
    sceneFallbackStopMs = 0,
    playingSlotPollIntervalMs = DEFAULT_PLAYING_SLOT_POLL_INTERVAL_MS,
    songTimePollIntervalMs = DEFAULT_SONG_TIME_POLL_INTERVAL_MS,
    logger
  }) {
    super();
    this.#abletonClient = abletonClient;
    this.#cacheStore = cacheStore;
    this.#songProfileStore = songProfileStore;
    this.#refreshIntervalMs = refreshIntervalMs;
    this.#sceneFallbackStopMs = Math.max(0, sceneFallbackStopMs);
    this.#playingSlotPollIntervalMs = Math.max(250, playingSlotPollIntervalMs);
    this.#songTimePollIntervalMs = songTimePollIntervalMs <= 0
      ? 0
      : Math.max(1000, songTimePollIntervalMs);
    this.#logger = logger;

    this.#refreshTimer = null;
    this.#playbackTimer = null;
    this.#playingSlotTimer = null;
    this.#currentSongIsPlaying = null;
    this.#playbackStopArmed = false;
    this.#activeSceneIndex = null;
    this.#lastPlaybackResponseAt = 0;
    this.#abletonOnline = false;
    this.#sceneStopTimer = null;
    this.#sceneStopToken = 0;
    this.#trackPlayingSlots = new Map();
    this.#sceneSlotsObservedSinceArm = false;
    this.#currentSongTimeSeconds = null;
    this.#trackLevels = new Map();
    this.#trackMutes = new Map();
    this.#sceneStopGraceUntil = 0;

    this.#abletonClient.on("tracksSnapshot", ({ names }) => {
      this.#cacheStore.setTracks(names);
      this.#pruneTrackPlayingSlots(names.length);
      this.emit("cache.updated", this.snapshot());
      if (typeof this.#abletonClient.requestTrackColors === "function") {
        void this.#abletonClient.requestTrackColors(names.length);
      }
    });

    this.#abletonClient.on("scenesSnapshot", ({ names }) => {
      this.#cacheStore.setScenes(names);
      this.emit("cache.updated", this.snapshot());
      if (typeof this.#abletonClient.requestSceneColors === "function") {
        void this.#abletonClient.requestSceneColors(names.length);
      }
    });

    this.#abletonClient.on("trackName", ({ index, name }) => {
      this.#cacheStore.upsertTrack(index, name);
      this.emit("cache.updated", this.snapshot());
    });

    this.#abletonClient.on("trackColor", ({ index, colorIndex }) => {
      this.#cacheStore.upsertTrackColor(index, colorIndex);
      this.emit("cache.updated", this.snapshot());
    });

    this.#abletonClient.on("sceneName", ({ index, name }) => {
      this.#cacheStore.upsertScene(index, name);
      this.emit("cache.updated", this.snapshot());
    });

    this.#abletonClient.on("sceneColor", ({ index, colorIndex }) => {
      this.#cacheStore.upsertSceneColor(index, colorIndex);
      this.emit("cache.updated", this.snapshot());
    });

    this.#abletonClient.on("sceneStarted", ({ sceneIndex }) => {
      this.#armSceneStopController(sceneIndex);
      this.emit("scene.started", { sceneIndex, timestamp: new Date().toISOString() });
    });

    this.#abletonClient.on("songIsPlaying", ({ isPlaying }) => {
      this.#currentSongIsPlaying = isPlaying;
      this.#lastPlaybackResponseAt = Date.now();
      this.#setAbletonOnline(true);

      this.emit("song.playback.status", {
        type: "song.playback.status",
        isPlaying,
        activeSceneIndex: this.#activeSceneIndex,
        currentSongTimeSeconds: this.#currentSongTimeSeconds,
        timestamp: new Date().toISOString()
      });

      if (!isPlaying && this.#canEvaluateAutoStop()) {
        const event = {
          type: "song.playback.ended",
          reason: "playback-ended",
          activeSceneIndex: this.#activeSceneIndex,
          timestamp: new Date().toISOString()
        };
        this.emit("song.playback.ended", event);

        void this.#triggerAutoStop("playback-ended").catch((error) => {
          this.#logger.error("Failed playback-ended stop", error);
        });
      }
    });

    this.#abletonClient.on("currentSongTime", ({ songTimeSeconds }) => {
      if (Number.isFinite(songTimeSeconds)) {
        this.#currentSongTimeSeconds = songTimeSeconds;
      }
      this.#lastPlaybackResponseAt = Date.now();
      this.#setAbletonOnline(true);
      this.emit("song.playback.status", {
        type: "song.playback.status",
        isPlaying: this.#currentSongIsPlaying === true,
        activeSceneIndex: this.#activeSceneIndex,
        currentSongTimeSeconds: this.#currentSongTimeSeconds,
        timestamp: new Date().toISOString()
      });
    });

    this.#abletonClient.on("trackPlayingSlot", ({ trackIndex, slotIndex }) => {
      this.#trackPlayingSlots.set(trackIndex, slotIndex);
      if (this.#playbackStopArmed) {
        this.#sceneSlotsObservedSinceArm = true;
      }
      this.#evaluateSceneStopFromTrackSlots();
    });

    this.#abletonClient.on("trackVolume", ({ trackIndex, level }) => {
      if (!Number.isInteger(trackIndex) || trackIndex < 0 || !Number.isFinite(level)) {
        return;
      }

      this.#trackLevels.set(trackIndex, Math.max(0, Math.min(1, level)));
    });

    this.#abletonClient.on("trackMute", ({ trackIndex, mute }) => {
      if (!Number.isInteger(trackIndex) || trackIndex < 0) {
        return;
      }

      this.#trackMutes.set(trackIndex, Boolean(mute));
    });

    this.#abletonClient.on("error", (error) => {
      this.#setAbletonOnline(false);
      this.emit("osc.error", { message: error.message, timestamp: new Date().toISOString() });
    });
  }

  #setAbletonOnline(isOnline) {
    if (this.#abletonOnline === isOnline) {
      return;
    }

    this.#abletonOnline = isOnline;
    this.emit("osc.connection.status", {
      type: "osc.connection.status",
      isOnline,
      timestamp: new Date().toISOString()
    });
  }

  #pruneTrackPlayingSlots(trackCount) {
    for (const trackIndex of this.#trackPlayingSlots.keys()) {
      if (trackIndex >= trackCount) {
        this.#trackPlayingSlots.delete(trackIndex);
      }
    }
  }

  #sceneForIndex(sceneIndex) {
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
      return null;
    }

    return this.#cacheStore.getScenes().find((scene) => scene.index === sceneIndex) ?? null;
  }

  #songPathFromSceneTitle(sceneTitle) {
    return String(sceneTitle ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\.$/, "")
      .replace(/ /g, "_")
      .slice(0, 120);
  }

  #songIdentityFromSceneIndex(sceneIndex) {
    const scene = this.#sceneForIndex(sceneIndex);
    if (!scene?.name) {
      return null;
    }

    const sceneTitle = String(scene.name).trim();
    if (!sceneTitle) {
      return null;
    }

    return {
      sceneTitle,
      songPath: this.#songPathFromSceneTitle(sceneTitle)
    };
  }

  #clearSceneStopTimer() {
    if (!this.#sceneStopTimer) {
      return;
    }

    clearTimeout(this.#sceneStopTimer);
    this.#sceneStopTimer = null;
  }

  #canEvaluateAutoStop() {
    return this.#playbackStopArmed && Date.now() >= this.#sceneStopGraceUntil;
  }

  #armSceneStopController(sceneIndex) {
    this.#sceneStopToken += 1;
    this.#playbackStopArmed = true;
    this.#activeSceneIndex = sceneIndex;
    this.#sceneSlotsObservedSinceArm = false;
    this.#sceneStopGraceUntil = Date.now() + SCENE_AUTO_STOP_GRACE_MS;
    this.#clearSceneStopTimer();

    if (this.#sceneFallbackStopMs <= 0) {
      return;
    }

    const stopToken = this.#sceneStopToken;
    this.#sceneStopTimer = setTimeout(() => {
      void this.#triggerAutoStop("timer", stopToken).catch((error) => {
        this.#logger.error("Failed timer-based stop", error);
      });
    }, this.#sceneFallbackStopMs);
    this.#sceneStopTimer.unref?.();
  }

  #evaluateSceneStopFromTrackSlots() {
    if (!this.#canEvaluateAutoStop() || !Number.isInteger(this.#activeSceneIndex)) {
      return;
    }

    if (!this.#sceneSlotsObservedSinceArm) {
      return;
    }

    const trackCount = this.#cacheStore.getTracks().length;
    if (trackCount <= 0) {
      return;
    }

    for (let index = 0; index < trackCount; index += 1) {
      if (!this.#trackPlayingSlots.has(index)) {
        return;
      }
    }

    let hasAnyActiveSceneSlot = false;
    for (let index = 0; index < trackCount; index += 1) {
      if (this.#trackPlayingSlots.get(index) === this.#activeSceneIndex) {
        hasAnyActiveSceneSlot = true;
        break;
      }
    }

    if (hasAnyActiveSceneSlot) {
      return;
    }

    const event = {
      type: "song.playback.ended",
      reason: "slots-ended",
      activeSceneIndex: this.#activeSceneIndex,
      timestamp: new Date().toISOString()
    };
    this.emit("song.playback.ended", event);

    void this.#triggerAutoStop("slots-ended").catch((error) => {
      this.#logger.error("Failed slots-ended stop", error);
    });
  }

  async #pollTrackPlayingSlots() {
    if (typeof this.#abletonClient.requestTrackPlayingSlots !== "function") {
      return;
    }

    const trackCount = this.#cacheStore.getTracks().length;
    if (trackCount <= 0) {
      return;
    }

    await this.#abletonClient.requestTrackPlayingSlots(trackCount);
  }

  async #requestTrackStateSnapshot() {
    const trackCount = this.#cacheStore.getTracks().length;
    if (trackCount <= 0) {
      return { levels: {}, mutes: {} };
    }

    if (typeof this.#abletonClient.requestTrackVolumes === "function") {
      await this.#abletonClient.requestTrackVolumes(trackCount);
    }

    if (typeof this.#abletonClient.requestTrackMutes === "function") {
      await this.#abletonClient.requestTrackMutes(trackCount);
    }

    const deadline = Date.now() + TRACK_STATE_SNAPSHOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      let haveAllLevels = true;
      let haveAllMutes = true;

      for (let index = 0; index < trackCount; index += 1) {
        if (!this.#trackLevels.has(index)) {
          haveAllLevels = false;
        }

        if (!this.#trackMutes.has(index)) {
          haveAllMutes = false;
        }
      }

      if (haveAllLevels && haveAllMutes) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    const levels = {};
    const mutes = {};
    for (let index = 0; index < trackCount; index += 1) {
      if (this.#trackLevels.has(index)) {
        levels[String(index)] = this.#trackLevels.get(index);
      }
      mutes[String(index)] = this.#trackMutes.has(index)
        ? this.#trackMutes.get(index)
        : false;
    }

    return { levels, mutes };
  }

  async #setTrackMuteInternal(trackIndex, mute) {
    await this.#abletonClient.muteTrack(trackIndex, mute);
    this.#trackMutes.set(trackIndex, Boolean(mute));
  }

  async #setTrackVolumeInternal(trackIndex, level) {
    const normalizedLevel = Math.max(0, Math.min(1, Number(level)));
    await this.#abletonClient.setTrackVolume(trackIndex, normalizedLevel);
    this.#trackLevels.set(trackIndex, normalizedLevel);
  }

  async #applySongMix(sceneIndex) {
    if (!this.#songProfileStore) {
      return { levels: {}, mutes: {} };
    }

    const defaults = this.#songProfileStore.getDefaults();
    const songIdentity = this.#songIdentityFromSceneIndex(sceneIndex);
    const profile = songIdentity
      ? this.#songProfileStore.getSongProfile(songIdentity.sceneTitle)
      : null;
    const tracks = this.#cacheStore.getTracks();

    const operations = [];
    const appliedLevels = {};
    const appliedMutes = {};
    for (const track of tracks) {
      const trackKey = String(track.index);
      const { level, mute } = resolveSongTrackMix(trackKey, profile, defaults);

      if (level !== null) {
        operations.push(this.#setTrackVolumeInternal(track.index, level));
        appliedLevels[trackKey] = level;
      }

      operations.push(this.#setTrackMuteInternal(track.index, mute));
      appliedMutes[trackKey] = mute;
    }

    await Promise.all(operations);
    return {
      levels: appliedLevels,
      mutes: appliedMutes
    };
  }

  async #triggerAutoStop(reason, stopToken = this.#sceneStopToken) {
    if (!this.#playbackStopArmed) {
      return;
    }

    if (stopToken !== this.#sceneStopToken) {
      return;
    }

    await this.stopSong(reason);
  }

  #playbackResponseTimeoutMs() {
    return this.#songTimePollIntervalMs * 2 + 1000;
  }

  snapshot() {
    return this.#cacheStore.snapshot();
  }

  getTracks() {
    return this.#cacheStore.getTracks();
  }

  getScenes() {
    return this.#cacheStore.getScenes();
  }

  getSongProfiles() {
    if (!this.#songProfileStore) {
      return [];
    }

    return this.#songProfileStore.getSongProfiles();
  }

  getSongProfileForScene(sceneIndex) {
    if (!this.#songProfileStore) {
      return null;
    }

    const songIdentity = this.#songIdentityFromSceneIndex(sceneIndex);
    if (!songIdentity) {
      return null;
    }

    return this.#songProfileStore.getSongProfile(songIdentity.sceneTitle);
  }

  async setSongNotesForScene(sceneIndex, notes, tags, useFixedDocFont, confidence, pdfCuePoints) {
    if (!this.#songProfileStore) {
      return null;
    }

    const songIdentity = this.#songIdentityFromSceneIndex(sceneIndex);
    if (!songIdentity) {
      return null;
    }

    return this.#songProfileStore.upsertSongMeta(songIdentity.sceneTitle, {
      notes,
      tags,
      confidence,
      pdfCuePoints,
      useFixedDocFont,
      songPath: songIdentity.songPath
    });
  }

  async setSongNotesForTitle(sceneTitle, notes, tags, useFixedDocFont, confidence, pdfCuePoints) {
    if (!this.#songProfileStore) {
      return null;
    }

    if (typeof sceneTitle !== "string" || !sceneTitle.trim()) {
      return null;
    }

    return this.#songProfileStore.upsertSongMeta(sceneTitle, {
      notes,
      tags,
      confidence,
      pdfCuePoints,
      useFixedDocFont
    });
  }

  async recheckTrackDefaults() {
    if (!this.#songProfileStore) {
      return null;
    }

    const snapshot = await this.#requestTrackStateSnapshot();
    return this.#songProfileStore.setDefaults(snapshot);
  }

  async getTrackStateSnapshot() {
    return this.#requestTrackStateSnapshot();
  }

  async applyTrackDefaults() {
    if (!this.#songProfileStore) {
      return { levels: {}, mutes: {} };
    }

    const defaults = this.#songProfileStore.getDefaults();
    const tracks = this.#cacheStore.getTracks();
    const operations = [];
    const appliedLevels = {};
    const appliedMutes = {};

    for (const track of tracks) {
      const trackKey = String(track.index);
      const level = defaults.levels?.[trackKey];
      const mute = defaults.mutes?.[trackKey];

      if (Number.isFinite(level)) {
        operations.push(this.#setTrackVolumeInternal(track.index, level));
        appliedLevels[trackKey] = Math.max(0, Math.min(1, Number(level)));
      }

      if (typeof mute === "boolean") {
        operations.push(this.#setTrackMuteInternal(track.index, mute));
        appliedMutes[trackKey] = mute;
      }
    }

    await Promise.all(operations);
    return { levels: appliedLevels, mutes: appliedMutes };
  }

  getTrackDefaults() {
    if (!this.#songProfileStore) {
      return {
        levels: {},
        mutes: {},
        updatedAt: null
      };
    }

    return this.#songProfileStore.getDefaults();
  }

  async clearTrackDefaults() {
    if (!this.#songProfileStore) {
      return {
        levels: {},
        mutes: {},
        updatedAt: null
      };
    }

    return this.#songProfileStore.setDefaults({ levels: {}, mutes: {} });
  }

  getConnectionStatus() {
    return {
      abletonOnline: this.#abletonOnline,
      isPlaying: this.#currentSongIsPlaying === true,
      activeSceneIndex: this.#activeSceneIndex,
      lastPlaybackResponseAt: this.#lastPlaybackResponseAt > 0
        ? new Date(this.#lastPlaybackResponseAt).toISOString()
        : null,
      currentSongTimeSeconds: this.#currentSongTimeSeconds,
      sceneFallbackStopMs: this.#sceneFallbackStopMs,
      playingSlotPollIntervalMs: this.#playingSlotPollIntervalMs,
      songTimePollIntervalMs: this.#songTimePollIntervalMs
    };
  }

  async hydrateCache() {
    await Promise.all([
      this.#abletonClient.requestTracks(),
      this.#abletonClient.requestScenes()
    ]);

    return this.snapshot();
  }

  startAutoRefresh() {
    if (this.#refreshIntervalMs > 0 && !this.#refreshTimer) {
      this.#refreshTimer = setInterval(async () => {
        try {
          await this.hydrateCache();
        } catch (error) {
          this.#logger.error("OSC refresh failed", error);
        }
      }, this.#refreshIntervalMs);

      this.#refreshTimer.unref?.();
    }

    if (typeof this.#abletonClient.startListenSongIsPlaying === "function") {
      void this.#abletonClient.startListenSongIsPlaying().catch((error) => {
        this.#logger.error("OSC start-listen is_playing failed", error);
      });
    }

    if (
      !this.#playbackTimer &&
      this.#songTimePollIntervalMs > 0 &&
      typeof this.#abletonClient.requestCurrentSongTime === "function"
    ) {
      this.#playbackTimer = setInterval(() => {
        const playbackResponseTimeoutMs = this.#playbackResponseTimeoutMs();
        const lastResponseAgeMs = Date.now() - this.#lastPlaybackResponseAt;
        if (this.#lastPlaybackResponseAt > 0 && lastResponseAgeMs > playbackResponseTimeoutMs) {
          this.#setAbletonOnline(false);
          this.#currentSongIsPlaying = false;
        }

        void this.#abletonClient.requestCurrentSongTime().catch((error) => {
          this.#logger.error("OSC song-time poll failed", error);
        });
      }, this.#songTimePollIntervalMs);

      this.#playbackTimer.unref?.();

      void this.#abletonClient.requestCurrentSongTime().catch((error) => {
        this.#logger.error("OSC initial song-time poll failed", error);
      });
    }

    if (typeof this.#abletonClient.requestSongIsPlaying === "function") {
      void this.#abletonClient.requestSongIsPlaying().catch((error) => {
        this.#logger.error("OSC initial is_playing query failed", error);
      });
    }

    if (!this.#playingSlotTimer && this.#playingSlotPollIntervalMs > 0) {
      this.#playingSlotTimer = setInterval(() => {
        void this.#pollTrackPlayingSlots().catch((error) => {
          this.#logger.error("OSC playing-slot poll failed", error);
        });
      }, this.#playingSlotPollIntervalMs);

      this.#playingSlotTimer.unref?.();
      void this.#pollTrackPlayingSlots().catch((error) => {
        this.#logger.error("OSC initial playing-slot poll failed", error);
      });
    }

  }

  stopAutoRefresh() {
    if (this.#refreshTimer) {
      clearInterval(this.#refreshTimer);
      this.#refreshTimer = null;
    }

    if (this.#playbackTimer) {
      clearInterval(this.#playbackTimer);
      this.#playbackTimer = null;
    }

    if (this.#playingSlotTimer) {
      clearInterval(this.#playingSlotTimer);
      this.#playingSlotTimer = null;
    }

    if (typeof this.#abletonClient.stopListenSongIsPlaying === "function") {
      void this.#abletonClient.stopListenSongIsPlaying().catch((error) => {
        this.#logger.error("OSC stop-listen is_playing failed", error);
      });
    }

    this.#clearSceneStopTimer();
    this.#setAbletonOnline(false);
  }

  async startScene(sceneIndex) {
    const appliedMix = await this.#applySongMix(sceneIndex);
    this.#armSceneStopController(sceneIndex);
    await this.#abletonClient.startScene(sceneIndex);
    const event = {
      type: "scene.start.requested",
      sceneIndex,
      appliedMix,
      timestamp: new Date().toISOString()
    };
    this.emit("scene.start.requested", event);
    return event;
  }

  async stopSong(reason = "manual") {
    const stoppedSceneIndex = this.#activeSceneIndex;
    this.#clearSceneStopTimer();
    this.#sceneStopToken += 1;
    this.#playbackStopArmed = false;
    this.#sceneSlotsObservedSinceArm = false;
    this.#currentSongIsPlaying = false;
    this.#activeSceneIndex = null;
    await this.#abletonClient.stopSong();
    const event = {
      type: "song.stop.requested",
      reason,
      activeSceneIndex: stoppedSceneIndex,
      timestamp: new Date().toISOString()
    };
    this.emit("song.stop.requested", event);
    return event;
  }

  async setTrackMute(trackIndex, mute) {
    await this.#setTrackMuteInternal(trackIndex, mute);

    if (this.#songProfileStore && Number.isInteger(this.#activeSceneIndex)) {
      const songIdentity = this.#songIdentityFromSceneIndex(this.#activeSceneIndex);
      if (songIdentity) {
        await this.#songProfileStore.setSongTrackMute(
          songIdentity.sceneTitle,
          trackIndex,
          mute,
          songIdentity.songPath,
          this.#songProfileStore.getDefaults()
        );
      }
    }

    return {
      type: "track.mute.requested",
      trackIndex,
      mute,
      timestamp: new Date().toISOString()
    };
  }

  async setTrackVolume(trackIndex, level) {
    const normalizedLevel = Math.max(0, Math.min(1, Number(level)));
    await this.#setTrackVolumeInternal(trackIndex, normalizedLevel);

    if (this.#songProfileStore && Number.isInteger(this.#activeSceneIndex)) {
      const songIdentity = this.#songIdentityFromSceneIndex(this.#activeSceneIndex);
      if (songIdentity) {
        await this.#songProfileStore.setSongTrackLevel(
          songIdentity.sceneTitle,
          trackIndex,
          normalizedLevel,
          songIdentity.songPath,
          this.#songProfileStore.getDefaults()
        );
      }
    }

    return {
      type: "track.volume.requested",
      trackIndex,
      level: normalizedLevel,
      timestamp: new Date().toISOString()
    };
  }
}
