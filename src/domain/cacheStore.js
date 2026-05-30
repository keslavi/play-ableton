export class CacheStore {
  #tracks = [];
  #scenes = [];
  #updatedAt = null;

  #touch() {
    this.#updatedAt = new Date().toISOString();
  }

  setTracks(names = []) {
    const previousColors = new Map(this.#tracks.map((track) => [track.index, track.colorIndex]));
    this.#tracks = names.map((name, index) => {
      const colorIndex = previousColors.get(index);
      return colorIndex === undefined
        ? { index, name: String(name) }
        : { index, name: String(name), colorIndex };
    });
    this.#touch();
  }

  setScenes(names = []) {
    const previousColors = new Map(this.#scenes.map((scene) => [scene.index, scene.colorIndex]));
    this.#scenes = names.map((name, index) => {
      const colorIndex = previousColors.get(index);
      return colorIndex === undefined
        ? { index, name: String(name) }
        : { index, name: String(name), colorIndex };
    });
    this.#touch();
  }

  upsertTrack(index, name) {
    const normalizedIndex = Number(index);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) {
      return;
    }

    const existing = this.#tracks.find((track) => track.index === normalizedIndex);
    if (existing) {
      existing.name = String(name);
    } else {
      this.#tracks.push({ index: normalizedIndex, name: String(name) });
      this.#tracks.sort((a, b) => a.index - b.index);
    }
    this.#touch();
  }

  upsertScene(index, name) {
    const normalizedIndex = Number(index);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) {
      return;
    }

    const existing = this.#scenes.find((scene) => scene.index === normalizedIndex);
    if (existing) {
      existing.name = String(name);
    } else {
      this.#scenes.push({ index: normalizedIndex, name: String(name) });
      this.#scenes.sort((a, b) => a.index - b.index);
    }
    this.#touch();
  }

  upsertTrackColor(index, colorIndex) {
    const normalizedIndex = Number(index);
    const normalizedColorIndex = Number(colorIndex);
    if (
      !Number.isInteger(normalizedIndex) ||
      normalizedIndex < 0 ||
      !Number.isInteger(normalizedColorIndex)
    ) {
      return;
    }

    const existing = this.#tracks.find((track) => track.index === normalizedIndex);
    if (existing) {
      existing.colorIndex = normalizedColorIndex;
    } else {
      this.#tracks.push({ index: normalizedIndex, name: `Track ${normalizedIndex + 1}`, colorIndex: normalizedColorIndex });
      this.#tracks.sort((a, b) => a.index - b.index);
    }
    this.#touch();
  }

  upsertSceneColor(index, colorIndex) {
    const normalizedIndex = Number(index);
    const normalizedColorIndex = Number(colorIndex);
    if (
      !Number.isInteger(normalizedIndex) ||
      normalizedIndex < 0 ||
      !Number.isInteger(normalizedColorIndex)
    ) {
      return;
    }

    const existing = this.#scenes.find((scene) => scene.index === normalizedIndex);
    if (existing) {
      existing.colorIndex = normalizedColorIndex;
    } else {
      this.#scenes.push({ index: normalizedIndex, name: `Scene ${normalizedIndex + 1}`, colorIndex: normalizedColorIndex });
      this.#scenes.sort((a, b) => a.index - b.index);
    }
    this.#touch();
  }

  getTracks() {
    return this.#tracks.map((track) => ({ ...track }));
  }

  getScenes() {
    return this.#scenes.map((scene) => ({ ...scene }));
  }

  snapshot() {
    return {
      tracks: this.getTracks(),
      scenes: this.getScenes(),
      updatedAt: this.#updatedAt
    };
  }
}
