import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
const envExamplePath = path.resolve(process.cwd(), ".env.example");

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
}

dotenv.config({ path: envPath });

const DEFAULT_OSC_REFRESH_INTERVAL_MS = 5000;
const DEFAULT_PLAYING_SLOT_POLL_INTERVAL_MS = 1000;
const DEFAULT_SONG_TIME_POLL_INTERVAL_MS = 5000;

const intFromEnv = (name, defaultValue) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isNaN(value) ? defaultValue : value;
};

export const config = {
  server: {
    host: process.env.HOST ?? "127.0.0.1",
    port: intFromEnv("PORT", 3000)
  },
  storage: {
    songProfilesPath: process.env.SONG_PROFILES_PATH ?? path.resolve(process.cwd(), "data/song-profiles.json"),
    songDocsDir: process.env.SONG_DOCS_DIR ?? path.resolve(process.cwd(), "data/song-docs"),
    songDocsDefaultRoot: process.env.SONG_DOCS_DEFAULT_ROOT ?? ""
  },
  osc: {
    localAddress: process.env.OSC_LOCAL_ADDRESS ?? "0.0.0.0",
    localPort: intFromEnv("OSC_LOCAL_PORT", 11001),
    remoteHost: process.env.OSC_REMOTE_HOST ?? "127.0.0.1",
    remotePort: intFromEnv("OSC_REMOTE_PORT", 11000),
    refreshIntervalMs: intFromEnv("OSC_REFRESH_INTERVAL_MS", DEFAULT_OSC_REFRESH_INTERVAL_MS),
    sceneFallbackStopMs: intFromEnv("OSC_SCENE_FALLBACK_STOP_MS", 0),
    playingSlotPollIntervalMs: intFromEnv("OSC_PLAYING_SLOT_POLL_INTERVAL_MS", DEFAULT_PLAYING_SLOT_POLL_INTERVAL_MS),
    songTimePollIntervalMs: intFromEnv("OSC_SONG_TIME_POLL_INTERVAL_MS", DEFAULT_SONG_TIME_POLL_INTERVAL_MS),
    addresses: {
      getTracks: process.env.OSC_GET_TRACKS_ADDRESS ?? "/live/song/get/track_names",
      getScenes: process.env.OSC_GET_SCENES_ADDRESS ?? "/live/song/get/scenes/name",
      getSongIsPlaying: process.env.OSC_GET_SONG_IS_PLAYING_ADDRESS ?? "/live/song/get/is_playing",
      startListenSongIsPlaying: process.env.OSC_START_LISTEN_SONG_IS_PLAYING_ADDRESS ?? "/live/song/start_listen/is_playing",
      stopListenSongIsPlaying: process.env.OSC_STOP_LISTEN_SONG_IS_PLAYING_ADDRESS ?? "/live/song/stop_listen/is_playing",
      getCurrentSongTime: process.env.OSC_GET_CURRENT_SONG_TIME_ADDRESS ?? "/live/song/get/current_song_time",
      startScene: process.env.OSC_START_SCENE_ADDRESS ?? "/live/scene/fire",
      stopSong: process.env.OSC_STOP_SONG_ADDRESS ?? "/live/song/stop_playing",
      songIsPlaying: process.env.OSC_SONG_IS_PLAYING_ADDRESS ?? "/live/song/get/is_playing",
      currentSongTime: process.env.OSC_CURRENT_SONG_TIME_ADDRESS ?? "/live/song/get/current_song_time",
      getTrackPlayingSlot: process.env.OSC_GET_TRACK_PLAYING_SLOT_ADDRESS ?? "/live/track/get/playing_slot_index",
      trackPlayingSlot: process.env.OSC_TRACK_PLAYING_SLOT_ADDRESS ?? "/live/track/get/playing_slot_index",
      getTrackMute: process.env.OSC_GET_TRACK_MUTE_ADDRESS ?? "/live/track/get/mute",
      trackMute: process.env.OSC_TRACK_MUTE_ADDRESS ?? "/live/track/get/mute",
      getTrackVolume: process.env.OSC_GET_TRACK_VOLUME_ADDRESS ?? "/live/track/get/volume",
      trackVolume: process.env.OSC_TRACK_VOLUME_ADDRESS ?? "/live/track/get/volume",
      trackName: process.env.OSC_TRACK_NAME_ADDRESS ?? "/live/track/get/name",
      trackColor: process.env.OSC_TRACK_COLOR_ADDRESS ?? "/live/track/get/color_index",
      sceneName: process.env.OSC_SCENE_NAME_ADDRESS ?? "/live/scene/get/name",
      sceneColor: process.env.OSC_SCENE_COLOR_ADDRESS ?? "/live/scene/get/color_index",
      sceneStarted: process.env.OSC_SCENE_STARTED_ADDRESS ?? "/live/scene/started",
      muteTrack: process.env.OSC_MUTE_TRACK_ADDRESS ?? "/live/track/set/mute",
      setTrackVolume: process.env.OSC_SET_TRACK_VOLUME_ADDRESS ?? "/live/track/set/volume"
    }
  }
};
