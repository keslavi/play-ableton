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

const normalizeSceneIndex = (sceneIndex) => {
  const value = Number(sceneIndex);
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return String(value);
};

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

const normalizeDoc = (doc) => {
  if (!doc || typeof doc !== "object") {
    return null;
  }

  if (typeof doc.fileName !== "string" || typeof doc.url !== "string") {
    return null;
  }

  return {
    fileName: doc.fileName,
    url: doc.url,
    htmlUrl: typeof doc.htmlUrl === "string" ? doc.htmlUrl : "",
    storedName: typeof doc.storedName === "string" ? doc.storedName : "",
    htmlStoredName: typeof doc.htmlStoredName === "string" ? doc.htmlStoredName : "",
    mimeType: typeof doc.mimeType === "string" ? doc.mimeType : "application/octet-stream",
    uploadedAt: typeof doc.uploadedAt === "string" ? doc.uploadedAt : new Date().toISOString()
  };
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
    for (const [sceneIndex, profile] of Object.entries(songs)) {
      const normalizedSceneIndex = normalizeSceneIndex(sceneIndex);
      if (!normalizedSceneIndex) {
        continue;
      }

      normalized[normalizedSceneIndex] = {
        levels: normalizedLevels(profile?.levels),
        mutes: normalizedMutes(profile?.mutes),
        notes: typeof profile?.notes === "string" ? profile.notes : "",
        tags: normalizeTags(profile?.tags),
        useFixedDocFont: Boolean(profile?.useFixedDocFont),
        doc: normalizeDoc(profile?.doc),
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
    const normalizedSceneIndex = normalizeSceneIndex(sceneIndex);
    if (!normalizedSceneIndex) {
      return null;
    }

    const profile = this.#state.songs[normalizedSceneIndex];
    if (!profile) {
      return null;
    }

    return {
      sceneIndex: Number(normalizedSceneIndex),
      levels: { ...profile.levels },
      mutes: { ...profile.mutes },
      notes: profile.notes,
      tags: [...(profile.tags ?? [])],
      useFixedDocFont: Boolean(profile.useFixedDocFont),
      doc: profile.doc ? { ...profile.doc } : null,
      updatedAt: profile.updatedAt
    };
  }

  getSongProfiles() {
    return Object.entries(this.#state.songs).map(([sceneIndex, profile]) => ({
      sceneIndex: Number(sceneIndex),
      levels: { ...profile.levels },
      mutes: { ...profile.mutes },
      notes: profile.notes,
      tags: [...(profile.tags ?? [])],
      useFixedDocFont: Boolean(profile.useFixedDocFont),
      doc: profile.doc ? { ...profile.doc } : null,
      updatedAt: profile.updatedAt
    }));
  }

  #ensureProfile(sceneIndex) {
    const normalizedSceneIndex = normalizeSceneIndex(sceneIndex);
    if (!normalizedSceneIndex) {
      throw new Error("sceneIndex must be a non-negative integer");
    }

    if (!this.#state.songs[normalizedSceneIndex]) {
      this.#state.songs[normalizedSceneIndex] = {
        levels: {},
        mutes: {},
        notes: "",
        tags: [],
        useFixedDocFont: false,
        doc: null,
        updatedAt: new Date().toISOString()
      };
    }

    return { normalizedSceneIndex, profile: this.#state.songs[normalizedSceneIndex] };
  }

  async setSongTrackLevel(sceneIndex, trackIndex, level) {
    const normalizedTrackIndex = Number(trackIndex);
    if (!Number.isInteger(normalizedTrackIndex) || normalizedTrackIndex < 0) {
      return null;
    }

    const { normalizedSceneIndex, profile } = this.#ensureProfile(sceneIndex);
    profile.levels[String(normalizedTrackIndex)] = Math.max(0, Math.min(1, Number(level)));
    profile.updatedAt = new Date().toISOString();
    await this.#enqueuePersist();
    return this.getSongProfile(Number(normalizedSceneIndex));
  }

  async setSongTrackMute(sceneIndex, trackIndex, mute) {
    const normalizedTrackIndex = Number(trackIndex);
    if (!Number.isInteger(normalizedTrackIndex) || normalizedTrackIndex < 0) {
      return null;
    }

    const { normalizedSceneIndex, profile } = this.#ensureProfile(sceneIndex);
    profile.mutes[String(normalizedTrackIndex)] = Boolean(mute);
    profile.updatedAt = new Date().toISOString();
    await this.#enqueuePersist();
    return this.getSongProfile(Number(normalizedSceneIndex));
  }

  async upsertSongMeta(sceneIndex, { notes, tags, useFixedDocFont }) {
    const { normalizedSceneIndex, profile } = this.#ensureProfile(sceneIndex);

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
    return this.getSongProfile(Number(normalizedSceneIndex));
  }

  async setSongDocument(sceneIndex, doc) {
    const { normalizedSceneIndex, profile } = this.#ensureProfile(sceneIndex);
    profile.doc = normalizeDoc(doc);
    profile.updatedAt = new Date().toISOString();
    await this.#enqueuePersist();
    return this.getSongProfile(Number(normalizedSceneIndex));
  }

  async clearSongDocument(sceneIndex) {
    const { normalizedSceneIndex, profile } = this.#ensureProfile(sceneIndex);
    profile.doc = null;
    profile.updatedAt = new Date().toISOString();
    await this.#enqueuePersist();
    return this.getSongProfile(Number(normalizedSceneIndex));
  }
}
