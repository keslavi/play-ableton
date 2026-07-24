export const resolveSongTrackMix = (trackKey, profile, defaults) => {
  const songLevels = profile?.levels ?? {};
  const songMutes = profile?.mutes ?? {};
  const hasSongLevel = Object.hasOwn(songLevels, trackKey);
  const hasSongMute = Object.hasOwn(songMutes, trackKey);

  const defaultLevel = defaults?.levels?.[trackKey];
  const defaultMute = defaults?.mutes?.[trackKey];

  const rawLevel = hasSongLevel ? songLevels[trackKey] : defaultLevel;
  const level = Number.isFinite(Number(rawLevel))
    ? Math.max(0, Math.min(1, Number(rawLevel)))
    : null;

  const mute = hasSongMute
    ? Boolean(songMutes[trackKey])
    : typeof defaultMute === "boolean"
      ? defaultMute
      : false;

  return { level, mute, hasSongLevel, hasSongMute };
};
