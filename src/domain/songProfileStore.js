import fs from "node:fs/promises";
import path from "node:path";

const emptyState = () => ({
  version: 1,
  defaults: {
    levels: {},
    mutes: {},
    updatedAt: null
  },
  songs: {}
});

const normalizeSceneTitle = (sceneTitle) => String(sceneTitle ?? "")
  .normalize("NFKC")
  .trim()
  .replace(/\s+/g, " ");

const sceneTitleKey = (sceneTitle) => normalizeSceneTitle(sceneTitle)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .replace(/[^a-z0-9 ]+/g, "")
  .trim();

const songPathFromTitle = (sceneTitle) => normalizeSceneTitle(sceneTitle)
  .replace(/[\\/:*?"<>|]/g, "")
  .replace(/\.$/, "")
  .replace(/ /g, "_")
  .slice(0, 120);

const normalizedLevels = (levels = {}) => {
  const entries = Object.entries(levels)
    .map(([trackIndex, level]) => [Number(trackIndex), Number(level)])
    .filter(([trackIndex, level]) => Number.isInteger(trackIndex) && trackIndex >= 0 && Number.isFinite(level));

  return Object.fromEntries(entries.map(([trackIndex, level]) => [String(trackIndex), Math.max(0, Math.min(1, level))]));
};

const normalizedMutes = (mutes = {}) => {
  const entries = Object.entries(mutes)
    .map(([trackIndex, mute]) => [Number(trackIndex), mute])
    .filter(([trackIndex]) => Number.isInteger(trackIndex) && trackIndex >= 0);

  return Object.fromEntries(entries.map(([trackIndex, mute]) => [String(trackIndex), Boolean(mute)]));
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  const deduped = new Set();
  for (const tag of tags) {
    if (typeof tag !== "string") {
      continue;
    }

    const normalized = tag.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    deduped.add(normalized.slice(0, 40));
  }

  return Array.from(deduped);
};

const titleFromLegacyKey = (key) => {
  if (typeof key !== "string" || !key) {
    return "";
  }

  const numeric = Number(key);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return "";
  }

  return normalizeSceneTitle(key.replace(/[_-]+/g, " "));
};

export class SongProfileStore {
  #filePath;
  #logger;
  #state;
  #writeQueue;

  constructor({ filePath, logger }) {
    this.#filePath = filePath;
    this.#logger = logger;
    this.#state = emptyState();
    this.#writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const payload = await fs.readFile(this.#filePath, "utf8");
      const parsed = JSON.parse(payload);
      this.#state = {
        version: 1,
        defaults: {
          levels: normalizedLevels(parsed?.defaults?.levels),
          mutes: normalizedMutes(parsed?.defaults?.mutes),
          updatedAt: typeof parsed?.defaults?.updatedAt === "string" ? parsed.defaults.updatedAt : null
        },
        songs: this.#normalizedSongs(parsed?.songs)
      };
      await this.#persist();
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        this.#logger.warn("Failed to load song profiles; using empty state", error);
      }
      await this.#persist();
    }
  }

  #normalizedSongs(songs) {
    if (!songs || typeof songs !== "object") {
      return {};
    }

    const normalized = {};
    for (const [legacyKey, profile] of Object.entries(songs)) {
      const sceneTitle = normalizeSceneTitle(
        profile?.sceneTitle
        || profile?.songMasterTitle
        || profile?.songPath?.replaceAll("_", " ")
        || titleFromLegacyKey(legacyKey)
      );
      const normalizedSceneTitleKey = sceneTitleKey(sceneTitle);
      if (!normalizedSceneTitleKey) {
        continue;
      }

      normalized[normalizedSceneTitleKey] = {
        sceneTitle,
        sceneTitleKey: normalizedSceneTitleKey,
        songPath: normalizeSceneTitle(profile?.songPath || songPathFromTitle(sceneTitle)),
        levels: normalizedLevels(profile?.levels),
        mutes: normalizedMutes(profile?.mutes),
        notes: typeof profile?.notes === "string" ? profile.notes : "",
        tags: normalizeTags(profile?.tags),
        useFixedDocFont: Boolean(profile?.useFixedDocFont),
        updatedAt: typeof profile?.updatedAt === "string" ? profile.updatedAt : null
      };
    }

    return normalized;
  }

  async #persist() {
    const targetDir = path.dirname(this.#filePath);
    await fs.mkdir(targetDir, { recursive: true });
    const tempPath = `${this.#filePath}.tmp`;
    const payload = JSON.stringify(this.#state, null, 2);
    await fs.writeFile(tempPath, `${payload}\n`, "utf8");
    await fs.rename(tempPath, this.#filePath);
  }

  async #enqueuePersist() {
    this.#writeQueue = this.#writeQueue.then(() => this.#persist()).catch((error) => {
      this.#logger.error("Failed to persist song profiles", error);
    });
    await this.#writeQueue;
  }

  getDefaults() {
    return {
      levels: { ...this.#state.defaults.levels },
      mutes: { ...this.#state.defaults.mutes },
      updatedAt: this.#state.defaults.updatedAt
    };
  }

  async setDefaults({ levels = {}, mutes = {} }) {
    this.#state.defaults = {
      levels: normalizedLevels(levels),
      mutes: normalizedMutes(mutes),
      updatedAt: new Date().toISOString()
    };
    await this.#enqueuePersist();
    return this.getDefaults();
  }

  getSongProfile(sceneIndex) {
    const normalizedSceneTitle = normalizeSceneTitle(sceneIndex);
    const normalizedSceneTitleKey = sceneTitleKey(normalizedSceneTitle);
    if (!normalizedSceneTitleKey) {
      return null;
    }

    const profile = this.#state.songs[normalizedSceneTitleKey];
    if (!profile) {
      return null;
    }

    return {
      sceneTitle: profile.sceneTitle,
      sceneTitleKey: profile.sceneTitleKey,
      songPath: profile.songPath,
      levels: { ...profile.levels },
      mutes: { ...profile.mutes },
      notes: profile.notes,
      tags: [...(profile.tags ?? [])],
      useFixedDocFont: Boolean(profile.useFixedDocFont),
      updatedAt: profile.updatedAt
    };
  }

  getSongProfiles() {
    return Object.values(this.#state.songs).map((profile) => ({
      sceneTitle: profile.sceneTitle,
      sceneTitleKey: profile.sceneTitleKey,
      songPath: profile.songPath,
      levels: { ...profile.levels },
      mutes: { ...profile.mutes },
      notes: profile.notes,
      tags: [...(profile.tags ?? [])],
      useFixedDocFont: Boolean(profile.useFixedDocFont),
      updatedAt: profile.updatedAt
    }));
  }

  #ensureProfile(sceneTitle, songPath = "") {
    const normalizedSceneTitle = normalizeSceneTitle(sceneTitle);
    const normalizedSceneTitleKey = sceneTitleKey(normalizedSceneTitle);
    if (!normalizedSceneTitleKey) {
      throw new Error("sceneTitle must be a non-empty string");
    }

    if (!this.#state.songs[normalizedSceneTitleKey]) {
      this.#state.songs[normalizedSceneTitleKey] = {
        sceneTitle: normalizedSceneTitle,
        sceneTitleKey: normalizedSceneTitleKey,
        songPath: normalizeSceneTitle(songPath || songPathFromTitle(normalizedSceneTitle)),
        levels: {},
        mutes: {},
        notes: "",
        tags: [],
        useFixedDocFont: false,
        updatedAt: new Date().toISOString()
      };
    }

    if (normalizedSceneTitle && this.#state.songs[normalizedSceneTitleKey].sceneTitle !== normalizedSceneTitle) {
      this.#state.songs[normalizedSceneTitleKey].sceneTitle = normalizedSceneTitle;
    }

    if (songPath) {
      this.#state.songs[normalizedSceneTitleKey].songPath = normalizeSceneTitle(songPath);
    }

    return { normalizedSceneTitle, normalizedSceneTitleKey, profile: this.#state.songs[normalizedSceneTitleKey] };
  }

  async setSongTrackLevel(sceneTitle, trackIndex, level, songPath = "") {
    const normalizedTrackIndex = Number(trackIndex);
    if (!Number.isInteger(normalizedTrackIndex) || normalizedTrackIndex < 0) {
      return null;
    }

    const { normalizedSceneTitle, profile } = this.#ensureProfile(sceneTitle, songPath);
    profile.levels[String(normalizedTrackIndex)] = Math.max(0, Math.min(1, Number(level)));
    profile.updatedAt = new Date().toISOString();
    await this.#enqueuePersist();
    return this.getSongProfile(normalizedSceneTitle);
  }

  async setSongTrackMute(sceneTitle, trackIndex, mute, songPath = "") {
    const normalizedTrackIndex = Number(trackIndex);
    if (!Number.isInteger(normalizedTrackIndex) || normalizedTrackIndex < 0) {
      return null;
    }

    const { normalizedSceneTitle, profile } = this.#ensureProfile(sceneTitle, songPath);
    profile.mutes[String(normalizedTrackIndex)] = Boolean(mute);
    profile.updatedAt = new Date().toISOString();
    await this.#enqueuePersist();
    return this.getSongProfile(normalizedSceneTitle);
  }

  async upsertSongMeta(sceneTitle, { notes, tags, useFixedDocFont, songPath }) {
    const { normalizedSceneTitle, profile } = this.#ensureProfile(sceneTitle, songPath);

    if (typeof notes === "string") {
      profile.notes = notes.trim();
    }

    if (tags !== undefined) {
      profile.tags = normalizeTags(tags);
    }

    if (typeof useFixedDocFont === "boolean") {
      profile.useFixedDocFont = useFixedDocFont;
    }

    profile.updatedAt = new Date().toISOString();
    await this.#enqueuePersist();
    return this.getSongProfile(normalizedSceneTitle);
  }

}
