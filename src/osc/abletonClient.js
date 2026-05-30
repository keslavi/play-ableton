import { EventEmitter } from "node:events";

const argValue = (arg) => {
  if (arg && typeof arg === "object" && "value" in arg) {
    return arg.value;
  }
  return arg;
};

const valuesFromMessage = (message) => (message.args ?? []).map(argValue);

const extractNameList = (values) => {
  if (values.length === 0) {
    return [];
  }

  if (values.every((value) => typeof value === "string")) {
    return values;
  }

  if (
    values.length >= 3 &&
    Number.isInteger(values[0]) &&
    Number.isInteger(values[1]) &&
    values.slice(2).every((value) => typeof value === "string")
  ) {
    return values.slice(2);
  }

  return null;
};

const normalizeMessage = (message, addresses) => {
  const values = valuesFromMessage(message);

  if (message.address === addresses.songIsPlaying && values.length >= 1) {
    const rawValue = values[0];
    const isPlaying = rawValue === true || rawValue === 1 || rawValue === "1";
    return { type: "songIsPlaying", isPlaying };
  }

  if (message.address === addresses.getTracks) {
    const names = extractNameList(values);
    if (names) {
      return { type: "tracksSnapshot", names };
    }
  }

  if (message.address === addresses.getScenes) {
    const names = extractNameList(values);
    if (names) {
      return { type: "scenesSnapshot", names };
    }
  }

  if (message.address === addresses.trackName && values.length >= 2) {
    return { type: "trackName", index: Number(values[0]), name: String(values[1]) };
  }

  if (message.address === addresses.trackColor && values.length >= 2) {
    return { type: "trackColor", index: Number(values[0]), colorIndex: Number(values[1]) };
  }

  if (message.address === addresses.sceneName && values.length >= 2) {
    return { type: "sceneName", index: Number(values[0]), name: String(values[1]) };
  }

  if (message.address === addresses.sceneColor && values.length >= 2) {
    return { type: "sceneColor", index: Number(values[0]), colorIndex: Number(values[1]) };
  }

  if (message.address === addresses.sceneStarted && values.length >= 1) {
    return { type: "sceneStarted", sceneIndex: Number(values[0]) };
  }

  if (message.address === addresses.trackPlayingSlot && values.length >= 2) {
    return {
      type: "trackPlayingSlot",
      trackIndex: Number(values[0]),
      slotIndex: Number(values[1])
    };
  }

  if (message.address === addresses.trackMute && values.length >= 2) {
    return {
      type: "trackMute",
      trackIndex: Number(values[0]),
      mute: values[1] === true || values[1] === 1 || values[1] === "1"
    };
  }

  if (message.address === addresses.trackVolume && values.length >= 2) {
    return {
      type: "trackVolume",
      trackIndex: Number(values[0]),
      level: Number(values[1])
    };
  }

  if (message.address === addresses.currentSongTime && values.length >= 1) {
    return {
      type: "currentSongTime",
      songTimeSeconds: Number(values[0])
    };
  }

  return null;
};

export class AbletonClient extends EventEmitter {
  #transport;
  #addresses;

  constructor(transport, addresses) {
    super();
    this.#transport = transport;
    this.#addresses = addresses;

    this.#transport.on("message", ({ message }) => {
      const normalized = normalizeMessage(message, this.#addresses);
      if (normalized) {
        this.emit(normalized.type, normalized);
        this.emit("event", normalized);
      }
    });

    this.#transport.on("error", (error) => {
      this.emit("error", error);
    });
  }

  async requestTracks() {
    this.#transport.send(this.#addresses.getTracks);
  }

  async requestScenes() {
    this.#transport.send(this.#addresses.getScenes);
  }

  async requestSongIsPlaying() {
    this.#transport.send(this.#addresses.getSongIsPlaying);
  }

  async startListenSongIsPlaying() {
    this.#transport.send(this.#addresses.startListenSongIsPlaying);
  }

  async stopListenSongIsPlaying() {
    this.#transport.send(this.#addresses.stopListenSongIsPlaying);
  }

  async requestCurrentSongTime() {
    this.#transport.send(this.#addresses.getCurrentSongTime);
  }

  async requestTrackPlayingSlot(trackIndex) {
    this.#transport.send(this.#addresses.getTrackPlayingSlot, [trackIndex]);
  }

  async requestTrackPlayingSlots(trackCount) {
    const requests = [];
    for (let index = 0; index < trackCount; index += 1) {
      requests.push(this.requestTrackPlayingSlot(index));
    }

    await Promise.all(requests);
  }

  async requestTrackMute(trackIndex) {
    this.#transport.send(this.#addresses.getTrackMute, [trackIndex]);
  }

  async requestTrackMutes(trackCount) {
    const requests = [];
    for (let index = 0; index < trackCount; index += 1) {
      requests.push(this.requestTrackMute(index));
    }

    await Promise.all(requests);
  }

  async requestTrackVolume(trackIndex) {
    this.#transport.send(this.#addresses.getTrackVolume, [trackIndex]);
  }

  async requestTrackVolumes(trackCount) {
    const requests = [];
    for (let index = 0; index < trackCount; index += 1) {
      requests.push(this.requestTrackVolume(index));
    }

    await Promise.all(requests);
  }

  async startScene(sceneIndex) {
    this.#transport.send(this.#addresses.startScene, [sceneIndex]);
  }

  async stopSong() {
    this.#transport.send(this.#addresses.stopSong);
  }

  async requestTrackColor(trackIndex) {
    this.#transport.send(this.#addresses.trackColor, [trackIndex]);
  }

  async requestTrackColors(trackCount) {
    const requests = [];
    for (let index = 0; index < trackCount; index += 1) {
      requests.push(this.requestTrackColor(index));
    }

    await Promise.all(requests);
  }

  async requestSceneColor(sceneIndex) {
    this.#transport.send(this.#addresses.sceneColor, [sceneIndex]);
  }

  async requestSceneColors(sceneCount) {
    const requests = [];
    for (let index = 0; index < sceneCount; index += 1) {
      requests.push(this.requestSceneColor(index));
    }

    await Promise.all(requests);
  }

  async muteTrack(trackIndex, mute) {
    this.#transport.send(this.#addresses.muteTrack, [trackIndex, mute ? 1 : 0]);
  }

  async setTrackVolume(trackIndex, level) {
    this.#transport.send(this.#addresses.setTrackVolume, [trackIndex, level]);
  }
}
