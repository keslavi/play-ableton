const wsStatus = document.querySelector("#ws-status");
const connectionAddress = document.querySelector("#connection-address");
const timerStopToast = document.querySelector("#timer-stop-toast");
const docNotFoundToast = document.querySelector("#doc-not-found-toast");
const sceneList = document.querySelector("#scene-list");
const trackList = document.querySelector("#track-list");
const eventLog = document.querySelector("#event-log");
const stopSongButton = document.querySelector("#stop-song-button");
const recheckDefaultsButton = document.querySelector("#recheck-defaults-button");
const sceneSearch = document.querySelector("#scene-search");
const clearSceneSearch = document.querySelector("#clear-scene-search");
const openSongsButton = document.querySelector("#open-songs");
const openLibraryButton = document.querySelector("#open-library");
const openDocButton = document.querySelector("#open-doc");
const openMixerButton = document.querySelector("#open-mixer");
const openLogButton = document.querySelector("#open-log");
const librarySongList = document.querySelector("#library-song-list");
const docModal = document.querySelector("#doc-modal");
const closeDocModalButton = document.querySelector("#close-doc-modal");
const songDocInput = document.querySelector("#song-doc-input");
const activeSongDocPanel = document.querySelector("#active-song-doc");
const activeSongDocTitle = document.querySelector("#active-song-doc-title");
const activeSongDocOpen = document.querySelector("#active-song-doc-open");
const activeSongDocFrame = document.querySelector("#active-song-doc-frame");
const activeSongDocFallback = document.querySelector("#active-song-doc-fallback");
const songMetaModal = document.querySelector("#song-meta-modal");
const songMetaNotes = document.querySelector("#song-meta-notes");
const songTagInput = document.querySelector("#song-tag-input");
const songTagAdd = document.querySelector("#song-tag-add");
const songTagSuggestions = document.querySelector("#song-tag-suggestions");
const songSelectedTags = document.querySelector("#song-selected-tags");
const songFixedDocFont = document.querySelector("#song-fixed-doc-font");
const songMetaSave = document.querySelector("#song-meta-save");
const songMetaCancel = document.querySelector("#song-meta-cancel");
const songMetaAttachment = document.querySelector("#song-meta-attachment");
const songMetaAttachmentOpen = document.querySelector("#song-meta-attachment-open");
const pages = {
  songs: document.querySelector("#page-songs"),
  library: document.querySelector("#page-library"),
  mixer: document.querySelector("#page-mixer"),
  log: document.querySelector("#page-log")
};
const TRACK_DB_STEP = 2;
const ABLETON_COLOR_PALETTE = [
  "#f26c63", "#f28c52", "#f2a93b", "#d6b54c", "#a4c95a", "#7acb5a", "#4fcb63", "#35c98a",
  "#2fc7a8", "#38c0c7", "#43b2d9", "#5b9df2", "#7b88f8", "#9a78f2", "#b36cf2", "#d16af2",
  "#f26ad9", "#f26ab0", "#af5a46", "#9f6a38", "#a07a2f", "#8d8431", "#6b8b39", "#4c8c39",
  "#2e8c43", "#208a61", "#1f8974", "#267e89", "#2f7297", "#4463a7", "#5d58b0", "#744fb0",
  "#8a49ac", "#a348a4", "#b8478b", "#b44b6f", "#ffb6a8", "#ffd1a8", "#ffe08a", "#f6f08b",
  "#d7f28a", "#baf28a", "#96f2a0", "#8ff2bf", "#8ff2da", "#92ebf2", "#9eddf2", "#b2cef2",
  "#c2c2f2", "#d0b7f2", "#e0b4f2", "#f2b3ec", "#f2b3d5", "#f2b3be", "#d96363", "#d98a52",
  "#d9b252", "#c4c452", "#95bf52", "#66bf52", "#52bf66", "#52bf8a", "#52bfae", "#52a9bf",
  "#528fbf", "#5271bf", "#675bbf", "#8552bf"
];
const ABLETON_COLOR_OVERRIDES = new Map([
  [0, "#9a9a9a"],
  [13, "#f0f0f0"],
  [14, "#ff4a43"],
  [17, "#f0e33a"],
  [19, "#35d10f"],
  [23, "#2f86d6"],
  [24, "#8f67e8"],
  [27, "#c8c8c8"],
  [38, "#c6b7f2"],
  [69, "#5d5d5d"]
]);

const abletonIndexedColor = (colorIndex, fallback) => {
  if (!Number.isInteger(colorIndex)) {
    return fallback;
  }

  if (ABLETON_COLOR_OVERRIDES.has(colorIndex)) {
    return ABLETON_COLOR_OVERRIDES.get(colorIndex);
  }

  return ABLETON_COLOR_PALETTE[colorIndex % ABLETON_COLOR_PALETTE.length] ?? fallback;
};

const state = {
  scenes: [],
  tracks: [],
  sceneQuery: "",
  activePage: "songs",
  showConnectionAddress: false,
  connectionInfo: null,
  wsConnected: false,
  abletonOnline: false,
  isPlaying: false,
  activeSceneIndex: null,
  songProfiles: new Map(),
  availablePdfs: new Set(),
  docNotFoundToastId: null,
  trackLevels: new Map(),
  trackMutes: new Map(),
  trackOriginalLevels: new Map(),
  trackLastTouchTapAt: new Map(),
  trackTitleLastTouchTapAt: new Map(),
  timerStopToastId: null,
  sceneStopTimerId: null,
  sceneStopToken: 0,
  pendingDocSceneIndex: null,
  pendingDocSceneTitle: null,
  editingSongSceneIndex: null,
  editingSongSceneTitle: null,
  editingSongTags: [],
  editingUseFixedDocFont: false,
  activeDocObjectUrl: null,
  activeDocEmbedUrl: null,
  activeDocOpenHref: null,
  activeDocTitle: null,
  docPreviewAutoCloseId: null,
  pageScrollTopByPage: {
    songs: 0,
    library: 0,
    mixer: 0,
    log: 0
  }
};

const scrollContainerForPage = (page) => {
  if (page === "songs") {
    return sceneList;
  }

  if (page === "mixer") {
    return trackList;
  }

  if (page === "library") {
    return librarySongList;
  }

  if (page === "log") {
    return eventLog;
  }

  return pages[page] ?? null;
};

const isDocModalOpen = () => Boolean(docModal && !docModal.classList.contains("hidden"));

const clearDocPreviewAutoClose = () => {
  if (!state.docPreviewAutoCloseId) {
    return;
  }

  clearTimeout(state.docPreviewAutoCloseId);
  state.docPreviewAutoCloseId = null;
};

const syncDocButtonState = () => {
  openDocButton?.classList.toggle("active", isDocModalOpen());
};

const openDocModal = () => {
  if (!docModal) {
    return;
  }

  clearDocPreviewAutoClose();
  docModal.classList.remove("hidden");
  syncDocButtonState();
};

const closeDocModal = () => {
  if (!docModal) {
    return;
  }

  clearDocPreviewAutoClose();
  docModal.classList.add("hidden");
  syncDocButtonState();
};

const releaseActiveDocObjectUrl = () => {
  if (!state.activeDocObjectUrl) {
    return;
  }

  URL.revokeObjectURL(state.activeDocObjectUrl);
  state.activeDocObjectUrl = null;
};

const clearActiveSongDocument = () => {
  releaseActiveDocObjectUrl();
  state.activeDocOpenHref = null;
  state.activeDocTitle = null;
  if (state.activeDocEmbedUrl !== "about:blank") {
    activeSongDocFrame.src = "about:blank";
    state.activeDocEmbedUrl = "about:blank";
  }
};

const markDocUnavailable = async (anchorElement = null) => {
  await fetchAvailableDocs();
  renderScenes();
  renderSongMetaModal();
  renderDocMenuButton();
  clearActiveSongDocument();
  closeDocModal();
  showDocNotFoundToast("no attachment", anchorElement);
};

const loadSceneDocument = async (sceneIndex, anchorElement = null) => {
  const scene = sceneForIndex(sceneIndex);
  if (!sceneHasDoc(scene)) {
    showDocNotFoundToast("no attachment", anchorElement);
    return false;
  }

  try {
    const response = await fetch(`/api/songs/${sceneIndex}/document`);
    if (!response.ok) {
      await markDocUnavailable(anchorElement);
      return false;
    }

    const blob = await response.blob();
    releaseActiveDocObjectUrl();
    state.activeDocObjectUrl = URL.createObjectURL(blob);
    state.activeSceneIndex = sceneIndex;
    state.activeDocOpenHref = `/api/songs/${sceneIndex}/document`;
    state.activeDocTitle = scene?.name ?? "Song Document";
    renderActiveSongDocument();
    return true;
  } catch (error) {
    writeLog("song.doc.load.error", { sceneIndex, message: error.message });
    await markDocUnavailable(anchorElement);
    return false;
  }
};

const loadSongDocumentByTitle = async (sceneTitle, anchorElement = null) => {
  const matchedDocBasename = findDocBasenameForTitle(sceneTitle);
  if (!matchedDocBasename) {
    showDocNotFoundToast("no attachment", anchorElement);
    return false;
  }

  try {
    const params = new URLSearchParams({ sceneTitle: matchedDocBasename });
    const response = await fetch(`/api/songs/document/by-title?${params.toString()}`);
    if (!response.ok) {
      await markDocUnavailable(anchorElement);
      return false;
    }

    const blob = await response.blob();
    releaseActiveDocObjectUrl();
    state.activeDocObjectUrl = URL.createObjectURL(blob);
    state.activeSceneIndex = null;
    state.activeDocOpenHref = `/api/songs/document/by-title?${params.toString()}`;
    state.activeDocTitle = String(sceneTitle || "Song Document").trim() || "Song Document";
    renderActiveSongDocument();
    return true;
  } catch (error) {
    writeLog("song.doc.loadByTitle.error", { sceneTitle, message: error.message });
    showDocNotFoundToast("no attachment", anchorElement);
    return false;
  }
};

const previewDocModalForScene = async (sceneIndex, durationMs = 2000, anchorElement = null) => {
  const didLoad = await loadSceneDocument(sceneIndex, anchorElement);
  if (!didLoad) {
    return;
  }

  openDocModal();
  state.docPreviewAutoCloseId = setTimeout(() => {
    state.docPreviewAutoCloseId = null;
    closeDocModal();
  }, durationMs);
};

const previewDocModalForTitle = async (sceneTitle, durationMs = 2000, anchorElement = null) => {
  const didLoad = await loadSongDocumentByTitle(sceneTitle, anchorElement);
  if (!didLoad) {
    return;
  }

  openDocModal();
  state.docPreviewAutoCloseId = setTimeout(() => {
    state.docPreviewAutoCloseId = null;
    closeDocModal();
  }, durationMs);
};

const setWsStatus = (online) => {
  state.wsConnected = online;

  if (!wsStatus) {
    return;
  }

  const colorClass = !state.wsConnected
    ? "status-red"
    : state.abletonOnline
      ? "status-green"
      : "status-yellow";

  wsStatus.classList.remove("status-green", "status-yellow", "status-red");
  wsStatus.classList.add("status-light", colorClass);
  wsStatus.title = !state.wsConnected
    ? "WebSocket disconnected"
    : state.abletonOnline
      ? "Ableton OSC online"
      : "Ableton OSC unreachable";
};

const renderStopButton = () => {
  if (!stopSongButton) {
    return;
  }

  stopSongButton.disabled = !state.isPlaying;
};

const showTimerStopToast = (message) => {
  if (!timerStopToast) {
    return;
  }

  timerStopToast.textContent = message;
  timerStopToast.classList.remove("hidden");

  if (state.timerStopToastId) {
    clearTimeout(state.timerStopToastId);
  }

  state.timerStopToastId = setTimeout(() => {
    timerStopToast.classList.add("hidden");
  }, 3600);
};

const showDocNotFoundToast = (message, anchorElement = null) => {
  if (!docNotFoundToast) {
    return;
  }

  docNotFoundToast.textContent = message;
  if (anchorElement instanceof Element) {
    const bounds = anchorElement.getBoundingClientRect();
    const margin = 8;
    const toastWidth = docNotFoundToast.offsetWidth || 120;
    const left = Math.max(margin, Math.min(
      bounds.left + (bounds.width / 2) - (toastWidth / 2),
      window.innerWidth - toastWidth - margin
    ));
    const top = Math.max(margin, bounds.top - margin);
    docNotFoundToast.style.left = `${left}px`;
    docNotFoundToast.style.top = `${top}px`;
    docNotFoundToast.style.right = "auto";
    docNotFoundToast.style.transform = "translateY(-100%)";
  } else {
    docNotFoundToast.style.left = "auto";
    docNotFoundToast.style.top = "1rem";
    docNotFoundToast.style.right = "1rem";
    docNotFoundToast.style.transform = "none";
  }
  docNotFoundToast.classList.remove("hidden");

  if (state.docNotFoundToastId) {
    clearTimeout(state.docNotFoundToastId);
  }

  state.docNotFoundToastId = setTimeout(() => {
    docNotFoundToast.classList.add("hidden");
  }, 2500);
};

const clearSceneStopTimer = (reason = "unspecified") => {
  state.sceneStopToken += 1;
  if (!state.sceneStopTimerId) {
    return;
  }

  console.info("[timer] canceled", { reason, token: state.sceneStopToken });
  clearTimeout(state.sceneStopTimerId);
  state.sceneStopTimerId = null;
};

const delayWithHandle = (ms) => new Promise((resolve) => {
  state.sceneStopTimerId = setTimeout(resolve, ms);
});

const armSceneStopTimer = (sceneIndex) => {
  clearSceneStopTimer("scene-start");

  const timerMs = Number(state.connectionInfo?.osc?.sceneFallbackStopMs ?? 0);
  if (!Number.isFinite(timerMs) || timerMs <= 0) {
    console.info("[timer] not armed", { sceneIndex, timerMs });
    return;
  }

  const stopToken = state.sceneStopToken;
  console.info("[timer] armed", { sceneIndex, timerMs, token: stopToken });
  void delayWithHandle(timerMs).then(() => {
    if (stopToken !== state.sceneStopToken) {
      console.info("[timer] skipped stale token", { sceneIndex, token: stopToken });
      return;
    }

    console.info("[timer] fired", { sceneIndex, token: stopToken });
    showTimerStopToast(`Timer stop triggered for scene ${sceneIndex}.`);
    void stopSong("timer");
  });
};

const fetchConnectionInfo = async () => {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      return;
    }

    state.connectionInfo = await response.json();
  } catch (error) {
    writeLog("connection.info.error", { message: error.message });
  }
};

const renderConnectionAddress = () => {
  if (!connectionAddress) {
    return;
  }

  if (!state.showConnectionAddress) {
    connectionAddress.classList.add("hidden");
    return;
  }

  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const httpAddress = window.location.origin;
  const wsAddress = `${wsProtocol}://${window.location.host}/ws`;
  const status = state.connectionInfo?.status;
  const osc = state.connectionInfo?.osc;
  const oscInfo = osc
    ? `${osc.remoteHost}:${osc.remotePort} (local ${osc.localAddress}:${osc.localPort}, time poll ${osc.songTimePollIntervalMs}ms)`
    : "unknown";
  const statusInfo = status
    ? `Ableton online: ${status.abletonOnline ? "yes" : "no"}, playing: ${status.isPlaying ? "yes" : "no"}`
    : "Ableton status: unknown";
  connectionAddress.textContent = `URL: ${httpAddress} | WS: ${wsAddress} | Ableton OSC: ${oscInfo} | ${statusInfo}`;
  connectionAddress.classList.remove("hidden");
};

const renderSearchClear = () => {
  if (!clearSceneSearch) {
    return;
  }

  const hasQuery = state.sceneQuery.length > 0;
  clearSceneSearch.classList.toggle("hidden", !hasQuery);
};

const writeLog = (label, payload) => {
  const line = `[${new Date().toISOString()}] ${label} ${payload ? JSON.stringify(payload) : ""}`;
  eventLog.textContent = `${line}\n${eventLog.textContent}`.slice(0, 8000);
};

const normalizeTag = (tag) => String(tag ?? "").trim().toLowerCase().slice(0, 40);

const normalizeSceneTitleKey = (sceneTitle) => String(sceneTitle ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .replace(/[^a-z0-9 ]+/g, "")
  .trim();

const sanitizeSceneTitle = (value) => String(value ?? "")
  .normalize("NFKC")
  .trim()
  .replace(/\s+/g, " ")
  .replace(/[\\/:*?"<>|]/g, "")
  .replace(/\.$/, "")
  .replace(/ /g, "_")
  .slice(0, 120);

const findDocBasenameForTitle = (sceneTitle) => {
  const exactSanitized = sanitizeSceneTitle(sceneTitle);
  if (exactSanitized && state.availablePdfs.has(exactSanitized)) {
    return exactSanitized;
  }

  const titleKey = normalizeSceneTitleKey(sceneTitle);
  if (!titleKey) {
    return null;
  }

  let prefixMatch = null;
  for (const basename of state.availablePdfs) {
    const docKey = normalizeSceneTitleKey(basename);
    if (!docKey) {
      continue;
    }

    if (docKey === titleKey) {
      return basename;
    }

    if (!prefixMatch && (docKey.startsWith(titleKey) || titleKey.startsWith(docKey))) {
      prefixMatch = basename;
    }
  }

  return prefixMatch;
};

const sceneHasDoc = (scene) => {
  if (!scene?.name) {
    return false;
  }

  return Boolean(findDocBasenameForTitle(scene.name));
};

const fetchAvailableDocs = async () => {
  try {
    const response = await fetch("/api/songs/available-docs");
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    state.availablePdfs = new Set(Array.isArray(payload.pdfs) ? payload.pdfs : []);
  } catch (error) {
    writeLog("available-docs.error", { message: error.message });
  }
};

const sceneForIndex = (sceneIndex) => state.scenes.find((item) => item.index === sceneIndex) ?? null;

const sceneIndexForTitle = (sceneTitle) => {
  const targetKey = normalizeSceneTitleKey(sceneTitle);
  if (!targetKey) {
    return null;
  }

  const scene = state.scenes.find((item) => normalizeSceneTitleKey(item?.name) === targetKey);
  return Number.isInteger(scene?.index) ? scene.index : null;
};

const allKnownTags = () => {
  const tagSet = new Set();
  for (const profile of state.songProfiles.values()) {
    for (const tag of profile?.tags ?? []) {
      const normalized = normalizeTag(tag);
      if (normalized) {
        tagSet.add(normalized);
      }
    }
  }

  return Array.from(tagSet).sort((left, right) => left.localeCompare(right));
};

const renderSongMetaModal = () => {
  if (!songSelectedTags || !songTagSuggestions) {
    return;
  }

  songSelectedTags.innerHTML = "";
  for (const tag of state.editingSongTags) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "modal-tag-chip";
    chip.textContent = `#${tag} ×`;
    chip.title = `Remove ${tag}`;
    chip.addEventListener("click", () => {
      state.editingSongTags = state.editingSongTags.filter((value) => value !== tag);
      renderSongMetaModal();
    });
    songSelectedTags.append(chip);
  }

  const selectedSet = new Set(state.editingSongTags);
  songTagSuggestions.innerHTML = "";
  for (const tag of allKnownTags()) {
    if (selectedSet.has(tag)) {
      continue;
    }

    const option = document.createElement("option");
    option.value = tag;
    songTagSuggestions.append(option);
  }

  if (songMetaAttachmentOpen) {
    const fallbackSceneIndex = sceneIndexForTitle(state.editingSongSceneTitle);
    const editableSceneIndex = Number.isInteger(state.editingSongSceneIndex)
      ? state.editingSongSceneIndex
      : fallbackSceneIndex;
    const scene = Number.isInteger(editableSceneIndex) ? sceneForIndex(editableSceneIndex) : null;
    if (sceneHasDoc(scene)) {
      songMetaAttachmentOpen.href = `/api/songs/${editableSceneIndex}/document`;
      songMetaAttachmentOpen.textContent = scene?.name
        ? `${sanitizeSceneTitle(scene.name)}.pdf`
        : "Open current attachment";
      songMetaAttachmentOpen.classList.remove("hidden");
    } else {
      songMetaAttachmentOpen.classList.add("hidden");
      songMetaAttachmentOpen.removeAttribute("href");
    }
  }

  if (songFixedDocFont) {
    songFixedDocFont.checked = Boolean(state.editingUseFixedDocFont);
  }
};

const profileForScene = (scene) => {
  const sceneTitle = typeof scene?.name === "string" ? scene.name : "";
  const key = normalizeSceneTitleKey(sceneTitle);
  if (!key) {
    return null;
  }

  return state.songProfiles.get(key) ?? null;
};

const profileForSceneIndex = (sceneIndex) => profileForScene(sceneForIndex(sceneIndex));

const docEmbedUrl = () => {
  if (!state.activeDocObjectUrl) {
    return null;
  }

  return `${state.activeDocObjectUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
};

const renderDocMenuButton = () => {
  if (!openDocButton) {
    return;
  }

  const scene = sceneForIndex(state.activeSceneIndex);
  const hasDoc = sceneHasDoc(scene) || Boolean(state.activeDocObjectUrl);
  openDocButton.classList.toggle("hidden", !hasDoc);
  if (!hasDoc) {
    closeDocModal();
  }
  syncDocButtonState();
};

const hydrateSongProfiles = (profiles = []) => {
  const nextProfiles = new Map();
  for (const profile of profiles) {
    const profileKey = normalizeSceneTitleKey(profile?.sceneTitleKey || profile?.sceneTitle);
    if (!profileKey) {
      continue;
    }
    nextProfiles.set(profileKey, profile);
  }
  state.songProfiles = nextProfiles;
};

const renderActiveSongDocument = () => {
  if (!activeSongDocPanel || !activeSongDocTitle || !activeSongDocOpen || !activeSongDocFrame || !activeSongDocFallback) {
    return;
  }

  if (!state.activeDocObjectUrl) {
    activeSongDocPanel.classList.add("hidden");
    clearActiveSongDocument();
    activeSongDocFallback.classList.add("hidden");
    renderDocMenuButton();
    return;
  }

  const scene = Number.isInteger(state.activeSceneIndex) ? sceneForIndex(state.activeSceneIndex) : null;
  const sceneTitle = scene?.name ?? state.activeDocTitle ?? "Song Document";
  const openHref = Number.isInteger(state.activeSceneIndex)
    ? `/api/songs/${state.activeSceneIndex}/document`
    : state.activeDocOpenHref;

  activeSongDocPanel.classList.remove("hidden");
  activeSongDocTitle.textContent = sceneTitle ? `Song Document: ${sceneTitle}` : "Song Document";
  if (openHref) {
    activeSongDocOpen.href = openHref;
  } else {
    activeSongDocOpen.removeAttribute("href");
  }
  activeSongDocOpen.textContent = sceneTitle || "Open in New Tab";
  const embedUrl = docEmbedUrl();
  const nextEmbedUrl = embedUrl || "about:blank";
  if (nextEmbedUrl !== state.activeDocEmbedUrl) {
    activeSongDocFrame.src = nextEmbedUrl;
    state.activeDocEmbedUrl = nextEmbedUrl;
  }
  activeSongDocFallback.classList.add("hidden");
  renderDocMenuButton();
};

const uploadSceneDocument = async (sceneIndex, file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/songs/${sceneIndex}/document`, {
    method: "POST",
    body: formData
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to upload song document");
  }

  await fetchAvailableDocs();
  renderSongMetaModal();
  renderScenes();
  renderLibrarySongs();
  renderActiveSongDocument();
};

const uploadSongDocumentByTitle = async (sceneTitle, file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sceneTitle", sceneTitle);

  const response = await fetch("/api/songs/document/by-title", {
    method: "POST",
    body: formData
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to upload song document");
  }

  await fetchAvailableDocs();
  renderSongMetaModal();
  renderScenes();
  renderLibrarySongs();
  renderActiveSongDocument();
};

const openSongMetaEditor = (sceneIndex) => {
  const scene = sceneForIndex(sceneIndex);
  const sceneTitle = scene?.name ?? "";
  const profile = profileForSceneIndex(sceneIndex) ?? state.songProfiles.get(normalizeSceneTitleKey(sceneTitle));
  state.editingSongSceneIndex = sceneIndex;
  state.editingSongSceneTitle = sceneTitle || null;
  state.editingSongTags = Array.isArray(profile?.tags)
    ? profile.tags.map(normalizeTag).filter(Boolean)
    : [];
  state.editingUseFixedDocFont = Boolean(profile?.useFixedDocFont);

  if (songMetaNotes) {
    songMetaNotes.value = profile?.notes ?? "";
  }

  if (songTagInput) {
    songTagInput.value = "";
  }

  renderSongMetaModal();
  songMetaModal?.classList.remove("hidden");
  songMetaNotes?.focus();
};

const openSongMetaEditorForTitle = (sceneTitle) => {
  const normalizedTitle = String(sceneTitle ?? "").trim();
  if (!normalizedTitle) {
    return;
  }

  const profile = state.songProfiles.get(normalizeSceneTitleKey(normalizedTitle));
  state.editingSongSceneIndex = sceneIndexForTitle(normalizedTitle);
  state.editingSongSceneTitle = normalizedTitle;
  state.editingSongTags = Array.isArray(profile?.tags)
    ? profile.tags.map(normalizeTag).filter(Boolean)
    : [];
  state.editingUseFixedDocFont = Boolean(profile?.useFixedDocFont);

  if (songMetaNotes) {
    songMetaNotes.value = profile?.notes ?? "";
  }

  if (songTagInput) {
    songTagInput.value = "";
  }

  renderSongMetaModal();
  songMetaModal?.classList.remove("hidden");
  songMetaNotes?.focus();
};

const closeSongMetaEditor = () => {
  songMetaModal?.classList.add("hidden");
  state.editingSongSceneIndex = null;
  state.editingSongSceneTitle = null;
  state.editingSongTags = [];
};

const addEditingTagFromInput = () => {
  if (!songTagInput) {
    return;
  }

  const value = normalizeTag(songTagInput.value);
  songTagInput.value = "";
  if (!value) {
    return;
  }

  if (!state.editingSongTags.includes(value)) {
    state.editingSongTags.push(value);
    state.editingSongTags.sort((left, right) => left.localeCompare(right));
    renderSongMetaModal();
  }
};

const saveSongMetaEditor = async () => {
  const hasSceneIndex = Number.isInteger(state.editingSongSceneIndex);
  const hasSceneTitle = typeof state.editingSongSceneTitle === "string" && state.editingSongSceneTitle.trim().length > 0;
  if (!hasSceneIndex && !hasSceneTitle) {
    return;
  }

  const notes = songMetaNotes?.value ?? "";
  const response = hasSceneIndex
    ? await fetch(`/api/songs/${state.editingSongSceneIndex}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, tags: state.editingSongTags, useFixedDocFont: state.editingUseFixedDocFont })
    })
    : await fetch("/api/songs/profile/by-title", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneTitle: state.editingSongSceneTitle,
        notes,
        tags: state.editingSongTags,
        useFixedDocFont: state.editingUseFixedDocFont
      })
    });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to update song details");
  }

  const profileKey = normalizeSceneTitleKey(payload.profile?.sceneTitleKey || payload.profile?.sceneTitle);
  if (profileKey) {
    state.songProfiles.set(profileKey, payload.profile);
  }

  renderScenes();
  renderActiveSongDocument();
  renderLibrarySongs();
  closeSongMetaEditor();
};

const matchesSceneQuery = (sceneName, query, tags = []) => {
  const trimmedQuery = query.trim().toLowerCase();
  const normalizedName = sceneName.toLowerCase();
  const normalizedTags = Array.isArray(tags)
    ? tags.map((tag) => String(tag).toLowerCase())
    : [];

  if (!trimmedQuery) {
    return true;
  }

  const hasWildcard = /[*?.]/.test(trimmedQuery);
  if (!hasWildcard) {
    return normalizedName.includes(trimmedQuery) || normalizedTags.some((tag) => tag.includes(trimmedQuery));
  }

  const wildcardPattern = Array.from(trimmedQuery)
    .map((char) => {
      if (char === "*") {
        return ".+";
      }

      if (char === "?") {
        return ".";
      }

      if (char === ".") {
        return ".";
      }

      return char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    })
    .join("");

  const regex = new RegExp(`^${wildcardPattern}`);
  return regex.test(normalizedName) || normalizedTags.some((tag) => regex.test(tag));
};

const normalizeSceneDisplayName = (sceneName) => {
  const trimmed = sceneName.trim();

  const leadingMatch = trimmed.match(/^(\d{2,3}(?:\.\d+)?)\s*(?:bpm)?\s*[-:|]\s*(.+)$/i);
  if (leadingMatch) {
    const bpm = Number.parseFloat(leadingMatch[1]);
    if (bpm >= 70 && bpm <= 220) {
      const bpmLabel = Number.isInteger(bpm) ? String(bpm) : String(bpm);
      return `${leadingMatch[2].trim()} - ${bpmLabel} bpm`;
    }
  }

  return trimmed;
};

const colorFromTrack = (track) => {
  if (!Number.isInteger(track.colorIndex)) {
    return "rgba(255, 255, 255, 0.12)";
  }

  return abletonIndexedColor(track.colorIndex, "rgba(255, 255, 255, 0.12)");
};

const colorFromScene = (scene) => {
  if (!Number.isInteger(scene.colorIndex)) {
    return "rgba(255, 255, 255, 0.14)";
  }

  return abletonIndexedColor(scene.colorIndex, "rgba(255, 255, 255, 0.14)");
};

const contrastInkForHex = (hexColor) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
  if (!match) {
    return "#eff6ff";
  }

  const red = Number.parseInt(match[1], 16);
  const green = Number.parseInt(match[2], 16);
  const blue = Number.parseInt(match[3], 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? "#10202a" : "#f7fbff";
};

const pinViewportToTop = () => {
  // Temporarily disabled: keep current scroll position when switching pages/songs.
  // window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  // document.documentElement.scrollTop = 0;
  // document.body.scrollTop = 0;
};

const setActivePage = (page) => {
  if (!pages[page]) {
    page = "songs";
  }

  const previousPage = state.activePage;
  const previousContainer = scrollContainerForPage(previousPage);
  if (previousContainer) {
    state.pageScrollTopByPage[previousPage] = previousContainer.scrollTop;
  }

  state.activePage = page;

  pinViewportToTop();
  requestAnimationFrame(() => {
    pinViewportToTop();
    document.body.classList.toggle("mixer-lock-scroll", page === "mixer");
    requestAnimationFrame(() => {
      pinViewportToTop();
    });
    setTimeout(() => {
      pinViewportToTop();
    }, 80);
  });

  for (const [key, element] of Object.entries(pages)) {
    element?.classList.toggle("active", key === page);
  }

  openSongsButton?.classList.toggle("active", page === "songs");
  openLibraryButton?.classList.toggle("active", page === "library");
  openMixerButton?.classList.toggle("active", page === "mixer");
  openLogButton?.classList.toggle("active", page === "log");
  syncDocButtonState();

  const activeContainer = scrollContainerForPage(page);
  const nextScrollTop = state.pageScrollTopByPage[page] ?? 0;
  if (activeContainer) {
    requestAnimationFrame(() => {
      activeContainer.scrollTop = nextScrollTop;
    });
  }
};

const applySceneMixToUiState = (mix) => {
  if (!mix || typeof mix !== "object") {
    return;
  }

  const levelEntries = Object.entries(mix.levels ?? {});
  for (const [trackKey, level] of levelEntries) {
    const trackIndex = Number(trackKey);
    if (!Number.isInteger(trackIndex) || !Number.isFinite(level)) {
      continue;
    }

    state.trackLevels.set(trackIndex, Math.max(0, Math.min(1, Number(level))));
  }

  const muteEntries = Object.entries(mix.mutes ?? {});
  for (const [trackKey, mute] of muteEntries) {
    const trackIndex = Number(trackKey);
    if (!Number.isInteger(trackIndex)) {
      continue;
    }

    state.trackMutes.set(trackIndex, Boolean(mute));
  }

  if (levelEntries.length > 0 || muteEntries.length > 0) {
    renderTracks();
  }
};

// Kept for quick restore after doc-link verification mode.
// eslint-disable-next-line no-unused-vars
const startScene = async (sceneIndex) => {
  clearSceneStopTimer("scene-start");
  console.info("[scene] start requested", { sceneIndex });
  try {
    const response = await fetch(`/api/scenes/${sceneIndex}/start`, { method: "POST" });
    const payload = await response.json();
    writeLog("scene.start", payload);
    console.info("[scene] start response", payload);
    applySceneMixToUiState(payload?.event?.appliedMix);
    state.activeSceneIndex = sceneIndex;
    renderActiveSongDocument();
    void loadSceneDocument(sceneIndex).then((didLoad) => {
      if (didLoad) {
        openDocModal();
      }
    });
    armSceneStopTimer(sceneIndex);
  } catch (error) {
    console.info("[scene] start error", { sceneIndex, message: error.message });
    writeLog("scene.start.error", { message: error.message });
  }
};

const stopSong = async (reason = "manual") => {
  if (reason !== "timer") {
    clearSceneStopTimer(`stop-${reason}`);
  }

  console.info("[song] stop requested", { reason });
  try {
    const response = await fetch("/api/song/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const payload = await response.json();
    writeLog("song.stop", payload);
    console.info("[song] stop response", payload);
  } catch (error) {
    console.info("[song] stop error", { reason, message: error.message });
    writeLog("song.stop.error", { message: error.message });
  }
};

const setTrackLevel = async (trackIndex, level) => {
  const normalizedLevel = Math.max(0, Math.min(1, level));
  state.trackLevels.set(trackIndex, normalizedLevel);

  try {
    const response = await fetch(`/api/tracks/${trackIndex}/volume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: normalizedLevel })
    });
    const payload = await response.json();
    writeLog("track.volume", payload);
  } catch (error) {
    writeLog("track.volume.error", { message: error.message });
  }
};

const adjustTrackLevelByDb = async (trackIndex, slider, deltaDb) => {
  const currentLevel = Number.parseFloat(slider.value);
  if (!Number.isFinite(currentLevel)) {
    return;
  }

  const gainMultiplier = Math.pow(10, deltaDb / 20);
  const nextLevel = Math.max(0, Math.min(1, currentLevel * gainMultiplier));
  slider.value = String(nextLevel);
  await setTrackLevel(trackIndex, nextLevel);
};

const restoreTrackLevel = async (trackIndex, slider) => {
  const originalLevel = state.trackOriginalLevels.get(trackIndex);
  if (!Number.isFinite(originalLevel)) {
    return;
  }

  slider.value = String(originalLevel);
  await setTrackLevel(trackIndex, originalLevel);
};

const toggleTrackMute = async (trackIndex) => {
  const nextMute = !(state.trackMutes.get(trackIndex) ?? false);
  state.trackMutes.set(trackIndex, nextMute);

  try {
    const response = await fetch(`/api/tracks/${trackIndex}/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mute: nextMute })
    });
    const payload = await response.json();
    writeLog("track.mute", payload);
    renderTracks();
  } catch (error) {
    writeLog("track.mute.error", { message: error.message });
  }
};

const renderScenes = () => {
  const previousScrollTop = sceneList.scrollTop;
  sceneList.innerHTML = "";

  const displayScenes = state.scenes.filter((scene) => {
    const profile = profileForScene(scene);
    const name = scene.name.trim();
    if (!name) {
      return false;
    }

    return matchesSceneQuery(name, state.sceneQuery, profile?.tags ?? []);
  });

  for (const scene of displayScenes) {
    const songProfile = profileForScene(scene);

    const li = document.createElement("li");
    li.className = "scene-card";
    const sceneColor = colorFromScene(scene);
    li.style.borderColor = sceneColor;
    li.style.boxShadow = `inset 0 0 0 1px ${sceneColor}33`;
    li.title = "Use Play to start scene";

    const primary = document.createElement("div");
    primary.className = "scene-card-primary";

    const meta = document.createElement("div");
    meta.className = "scene-card-meta";

    const label = document.createElement("span");
    label.className = "scene-card-name";
    label.textContent = normalizeSceneDisplayName(scene.name);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-card-play";
    button.textContent = "Play";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void previewDocModalForScene(scene.index, 2000, button);
    });

    const notesPreview = document.createElement("span");
    notesPreview.className = "scene-card-notes";
    notesPreview.textContent = songProfile?.notes?.trim()
      ? songProfile.notes
      : "";

    primary.append(button, label);
    meta.append(notesPreview);

    const hasAttachment = sceneHasDoc(scene);
    if (Array.isArray(songProfile?.tags) && songProfile.tags.length > 0) {
      const tagsPreview = document.createElement("div");
      tagsPreview.className = "scene-card-tags";
      for (const tag of songProfile.tags) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "scene-tag-chip";
        chip.textContent = `#${tag}`;
        chip.title = `Filter by tag ${tag}`;
        chip.addEventListener("click", (event) => {
          event.stopPropagation();
          state.sceneQuery = tag;
          if (sceneSearch) {
            sceneSearch.value = tag;
          }
          renderSearchClear();
          renderScenes();
        });
        tagsPreview.append(chip);
      }
      meta.append(tagsPreview);
    }

    const actions = document.createElement("div");
    actions.className = "scene-card-actions";
    actions.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    if (hasAttachment) {
      const attachmentButton = document.createElement("button");
      attachmentButton.type = "button";
      attachmentButton.className = "scene-card-attachment";
      attachmentButton.textContent = "♪";
      attachmentButton.title = "Open attached document";
      attachmentButton.setAttribute("aria-label", "Open attached document");
      attachmentButton.addEventListener("click", () => {
        void loadSceneDocument(scene.index, attachmentButton).then((didLoad) => {
          if (didLoad) {
            openDocModal();
          }
        });
      });
      actions.append(attachmentButton);
    }

    const notesButton = document.createElement("button");
    notesButton.type = "button";
    notesButton.className = "scene-card-notes-edit";
    notesButton.textContent = "Notes";
    notesButton.title = "Edit song notes";
    notesButton.addEventListener("click", () => {
      openSongMetaEditor(scene.index);
    });
    actions.append(notesButton);

    li.append(primary, meta, actions);
    sceneList.append(li);
  }

  requestAnimationFrame(() => {
    sceneList.scrollTop = previousScrollTop;
    state.pageScrollTopByPage.songs = sceneList.scrollTop;
  });
};

const orderedLibraryTitles = () => {
  const profileTitles = Array.from(state.songProfiles.values())
    .map((profile) => String(profile?.sceneTitle ?? "").trim())
    .filter(Boolean);

  if (profileTitles.length > 0) {
    return profileTitles;
  }

  return state.scenes
    .map((scene) => String(scene?.name ?? "").trim())
    .filter(Boolean);
};

const renderLibrarySongs = () => {
  if (!librarySongList) {
    return;
  }

  const previousScrollTop = librarySongList.scrollTop;
  librarySongList.innerHTML = "";

  const titles = orderedLibraryTitles();
  if (titles.length === 0) {
    const empty = document.createElement("li");
    empty.className = "library-empty";
    empty.textContent = "No song titles yet.";
    librarySongList.append(empty);
    return;
  }

  for (const title of titles) {
    const li = document.createElement("li");
    li.className = "scene-card library-song-card";

    const primary = document.createElement("div");
    primary.className = "scene-card-primary";

    const label = document.createElement("span");
    label.className = "scene-card-name";
    label.textContent = normalizeSceneDisplayName(title);
    primary.append(label);

    const meta = document.createElement("div");
    meta.className = "scene-card-meta";

    const profile = state.songProfiles.get(normalizeSceneTitleKey(title));
    const notesPreview = document.createElement("span");
    notesPreview.className = "scene-card-notes";
    notesPreview.textContent = profile?.notes?.trim() || "";
    meta.append(notesPreview);

    const actions = document.createElement("div");
    actions.className = "scene-card-actions";

    const hasAttachment = Boolean(findDocBasenameForTitle(title));
    if (hasAttachment) {
      const attachmentButton = document.createElement("button");
      attachmentButton.type = "button";
      attachmentButton.className = "scene-card-attachment";
      attachmentButton.textContent = "♪";
      attachmentButton.title = "Open attached document";
      attachmentButton.setAttribute("aria-label", "Open attached document");
      attachmentButton.addEventListener("click", () => {
        void previewDocModalForTitle(title, 1000, attachmentButton);
      });
      actions.append(attachmentButton);
    }

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "scene-card-notes-edit";
    importButton.textContent = hasAttachment ? "Replace PDF" : "Import PDF";
    importButton.title = "Import attachment";
    importButton.addEventListener("click", () => {
      state.pendingDocSceneIndex = null;
      state.pendingDocSceneTitle = title;
      songDocInput?.click();
    });
    actions.append(importButton);

    const notesButton = document.createElement("button");
    notesButton.type = "button";
    notesButton.className = "scene-card-notes-edit";
    notesButton.textContent = "Notes";
    notesButton.title = "Edit song notes";
    notesButton.addEventListener("click", () => {
      openSongMetaEditorForTitle(title);
    });
    actions.append(notesButton);

    li.append(primary, meta, actions);
    librarySongList.append(li);
  }

  requestAnimationFrame(() => {
    librarySongList.scrollTop = previousScrollTop;
    state.pageScrollTopByPage.library = librarySongList.scrollTop;
  });
};

const renderTracks = () => {
  trackList.innerHTML = "";

  const sortedTracks = [...state.tracks].sort((left, right) => {
    const leftIsBus = /\bbus\b/i.test(left.name);
    const rightIsBus = /\bbus\b/i.test(right.name);

    if (leftIsBus !== rightIsBus) {
      return leftIsBus ? -1 : 1;
    }

    return left.index - right.index;
  });

  for (const track of sortedTracks) {
    const trackColor = colorFromTrack(track);
    const trackInk = contrastInkForHex(trackColor);
    const li = document.createElement("li");
    li.className = "track-card";
    li.style.borderColor = trackColor;
    li.style.boxShadow = `inset 0 0 0 1px ${trackColor}33`;

    const header = document.createElement("div");
    header.className = "track-card-header";
    header.style.background = trackColor;
    header.style.color = trackInk;

    const label = document.createElement("span");
    label.className = "track-name";
    label.textContent = track.name;
    label.style.color = trackInk;

    const muteButton = document.createElement("button");
    muteButton.type = "button";
    muteButton.className = "track-toggle";
    const muted = state.trackMutes.get(track.index) ?? false;
    muteButton.classList.toggle("muted", muted);
    muteButton.textContent = muted ? "Unmute" : "Mute";
    muteButton.addEventListener("click", () => {
      void toggleTrackMute(track.index);
    });

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.01";
    const initialLevel = state.trackLevels.get(track.index) ?? 0.8;
    state.trackLevels.set(track.index, initialLevel);
    if (!state.trackOriginalLevels.has(track.index)) {
      state.trackOriginalLevels.set(track.index, initialLevel);
    }
    slider.value = String(initialLevel);
    slider.className = "track-slider";
    slider.addEventListener("pointerdown", () => {
      state.trackOriginalLevels.set(track.index, Number.parseFloat(slider.value));
    });
    slider.addEventListener("input", () => {
      void setTrackLevel(track.index, Number.parseFloat(slider.value));
    });
    slider.addEventListener("dblclick", () => {
      void restoreTrackLevel(track.index, slider);
    });
    slider.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch") {
        return;
      }

      const now = Date.now();
      const lastTapAt = state.trackLastTouchTapAt.get(track.index) ?? 0;
      state.trackLastTouchTapAt.set(track.index, now);

      if (now - lastTapAt < 320) {
        void restoreTrackLevel(track.index, slider);
      }
    });

    label.title = "Double-click to restore original volume";
    label.addEventListener("dblclick", () => {
      void restoreTrackLevel(track.index, slider);
    });
    label.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch") {
        return;
      }

      const now = Date.now();
      const lastTapAt = state.trackTitleLastTouchTapAt.get(track.index) ?? 0;
      state.trackTitleLastTouchTapAt.set(track.index, now);

      if (now - lastTapAt < 320) {
        void restoreTrackLevel(track.index, slider);
      }
    });

    const sliderStepControls = document.createElement("div");
    sliderStepControls.className = "track-step-controls";

    const lowerButton = document.createElement("button");
    lowerButton.type = "button";
    lowerButton.className = "track-step-button is-down";
    lowerButton.setAttribute("aria-label", `Lower by ${TRACK_DB_STEP} dB`);
    lowerButton.title = `Lower by ${TRACK_DB_STEP} dB`;
    lowerButton.addEventListener("click", () => {
      void adjustTrackLevelByDb(track.index, slider, -TRACK_DB_STEP);
    });

    const raiseButton = document.createElement("button");
    raiseButton.type = "button";
    raiseButton.className = "track-step-button is-up";
    raiseButton.setAttribute("aria-label", `Raise by ${TRACK_DB_STEP} dB`);
    raiseButton.title = `Raise by ${TRACK_DB_STEP} dB`;
    raiseButton.addEventListener("click", () => {
      void adjustTrackLevelByDb(track.index, slider, TRACK_DB_STEP);
    });

    sliderStepControls.append(raiseButton, lowerButton);

    const faderRow = document.createElement("div");
    faderRow.className = "track-fader-row";
    faderRow.append(slider, sliderStepControls);

    header.append(label, muteButton);
    li.append(header, faderRow);
    trackList.append(li);
  }
};

const refreshCache = async () => {
  const [tracksRes, scenesRes, profilesRes, docsRes] = await Promise.all([
    fetch("/api/tracks"),
    fetch("/api/scenes"),
    fetch("/api/songs/profiles"),
    fetch("/api/songs/available-docs")
  ]);

  const [tracksPayload, scenesPayload, profilesPayload, docsPayload] = await Promise.all([
    tracksRes.json(),
    scenesRes.json(),
    profilesRes.json(),
    docsRes.json()
  ]);

  state.tracks = tracksPayload.tracks ?? [];
  state.scenes = scenesPayload.scenes ?? [];
  hydrateSongProfiles(profilesPayload.profiles ?? []);
  state.availablePdfs = new Set(Array.isArray(docsPayload.pdfs) ? docsPayload.pdfs : []);
  renderTracks();
  renderScenes();
  renderLibrarySongs();
  renderActiveSongDocument();
};

const startWs = () => {
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);

  socket.addEventListener("open", () => {
    setWsStatus(true);
    writeLog("ws.open");
  });

  socket.addEventListener("close", () => {
    state.abletonOnline = false;
    setWsStatus(false);
    state.isPlaying = false;
    renderStopButton();
    writeLog("ws.closed");
    setTimeout(startWs, 1200);
  });

  socket.addEventListener("message", (messageEvent) => {
    try {
      const payload = JSON.parse(messageEvent.data);
      writeLog("ws.message", payload);

      if (payload.type === "cache.updated" && payload.payload) {
        state.tracks = payload.payload.tracks ?? state.tracks;
        state.scenes = payload.payload.scenes ?? state.scenes;
        renderTracks();
        renderScenes();
        renderLibrarySongs();
        renderActiveSongDocument();
      }

      if (payload.type === "song.playback.status") {
        state.abletonOnline = true;
        if (Number.isInteger(payload.activeSceneIndex)) {
          state.activeSceneIndex = payload.activeSceneIndex;
          renderActiveSongDocument();
        }
        setWsStatus(state.wsConnected);
        state.isPlaying = Boolean(payload.isPlaying);
        renderStopButton();
      }

      if (payload.type === "osc.connection.status") {
        state.abletonOnline = Boolean(payload.isOnline);
        if (!state.abletonOnline) {
          state.isPlaying = false;
          renderStopButton();
        }
        setWsStatus(state.wsConnected);
      }

      if (payload.type === "song.stop.requested" || payload.type === "song.playback.ended") {
        state.isPlaying = false;
        renderStopButton();
        clearSceneStopTimer(`ws-${payload.type}`);
        setActivePage("songs");

        if (payload.type === "song.stop.requested") {
          console.info("[song] stop confirmed", payload);
        }

        if (payload.type === "song.stop.requested" && payload.reason === "timer") {
          const sceneLabel = Number.isInteger(payload.activeSceneIndex)
            ? `scene ${payload.activeSceneIndex}`
            : "scene";
          showTimerStopToast(`Timer stop triggered for ${sceneLabel}.`);
        }
      }

      if (payload.type === "scene.start.requested" && Number.isInteger(payload.sceneIndex)) {
        applySceneMixToUiState(payload.appliedMix);
        state.activeSceneIndex = payload.sceneIndex;
        renderActiveSongDocument();
      }
    } catch (error) {
      writeLog("ws.parse.error", { message: error.message });
    }
  });
};

(async () => {
  setWsStatus(false);
  renderStopButton();
  try {
    await Promise.all([refreshCache(), fetchConnectionInfo()]);
    if (state.connectionInfo?.status) {
      state.abletonOnline = Boolean(state.connectionInfo.status.abletonOnline);
      state.isPlaying = Boolean(state.connectionInfo.status.isPlaying);
      if (Number.isInteger(state.connectionInfo.status.activeSceneIndex)) {
        state.activeSceneIndex = state.connectionInfo.status.activeSceneIndex;
      }
      setWsStatus(state.wsConnected);
      renderStopButton();
      renderActiveSongDocument();
    }
  } catch (error) {
    writeLog("bootstrap.error", { message: error.message });
  }
  startWs();
})();

stopSongButton?.addEventListener("click", () => {
  void stopSong("manual");
});

wsStatus?.addEventListener("click", () => {
  state.showConnectionAddress = !state.showConnectionAddress;
  void fetchConnectionInfo().then(() => {
    renderConnectionAddress();
  });
});

sceneSearch?.addEventListener("input", () => {
  state.sceneQuery = sceneSearch.value.trim();
  renderSearchClear();
  renderScenes();
});

clearSceneSearch?.addEventListener("click", () => {
  state.sceneQuery = "";
  if (sceneSearch) {
    sceneSearch.value = "";
    sceneSearch.focus();
  }
  renderSearchClear();
  renderScenes();
});

openMixerButton?.addEventListener("click", () => {
  setActivePage("mixer");
});

openLogButton?.addEventListener("click", () => {
  setActivePage("log");
});

openSongsButton?.addEventListener("click", () => {
  setActivePage("songs");
});

openLibraryButton?.addEventListener("click", () => {
  setActivePage("library");
});

openDocButton?.addEventListener("click", () => {
  if (!Number.isInteger(state.activeSceneIndex)) {
    return;
  }

  if (isDocModalOpen()) {
    closeDocModal();
    return;
  }

  void loadSceneDocument(state.activeSceneIndex, openDocButton).then((didLoad) => {
    if (didLoad) {
      openDocModal();
    }
  });
});

closeDocModalButton?.addEventListener("click", () => {
  closeDocModal();
});

recheckDefaultsButton?.addEventListener("click", () => {
  void fetch("/api/tracks/recheck-defaults", { method: "POST" })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to recheck defaults");
      }
      writeLog("track.defaults.recheck", payload);
    })
    .catch((error) => {
      writeLog("track.defaults.recheck.error", { message: error.message });
    });
});

songDocInput?.addEventListener("change", (event) => {
  const [file] = event.target.files ?? [];
  const targetSceneIndex = state.pendingDocSceneIndex;
  const targetSceneTitle = state.pendingDocSceneTitle;
  state.pendingDocSceneIndex = null;
  state.pendingDocSceneTitle = null;
  event.target.value = "";

  if (!file) {
    return;
  }

  if (Number.isInteger(targetSceneIndex)) {
    void uploadSceneDocument(targetSceneIndex, file).catch((error) => {
      writeLog("song.doc.upload.error", { sceneIndex: targetSceneIndex, message: error.message });
    });
    return;
  }

  if (typeof targetSceneTitle === "string" && targetSceneTitle.trim()) {
    void uploadSongDocumentByTitle(targetSceneTitle, file).catch((error) => {
      writeLog("song.doc.upload.error", { sceneTitle: targetSceneTitle, message: error.message });
    });
  }
});

songMetaAttachment?.addEventListener("click", () => {
  if (!Number.isInteger(state.editingSongSceneIndex) && !(typeof state.editingSongSceneTitle === "string" && state.editingSongSceneTitle.trim())) {
    return;
  }

  state.pendingDocSceneIndex = state.editingSongSceneIndex;
  if (Number.isInteger(state.editingSongSceneIndex)) {
    const scene = sceneForIndex(state.editingSongSceneIndex);
    state.pendingDocSceneTitle = scene?.name ?? state.editingSongSceneTitle;
  } else {
    state.pendingDocSceneTitle = state.editingSongSceneTitle;
  }
  songDocInput?.click();
});

songTagAdd?.addEventListener("click", () => {
  addEditingTagFromInput();
  songTagInput?.focus();
});

songTagInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addEditingTagFromInput();
  }
});

songFixedDocFont?.addEventListener("change", () => {
  state.editingUseFixedDocFont = Boolean(songFixedDocFont.checked);
});

songMetaCancel?.addEventListener("click", () => {
  closeSongMetaEditor();
});

songMetaSave?.addEventListener("click", () => {
  void saveSongMetaEditor().catch((error) => {
    writeLog("song.meta.save.error", { message: error.message });
  });
});

songMetaModal?.addEventListener("click", (event) => {
  if (event.target === songMetaModal) {
    closeSongMetaEditor();
  }
});

docModal?.addEventListener("click", (event) => {
  if (event.target === docModal) {
    closeDocModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isDocModalOpen()) {
    closeDocModal();
    return;
  }

  if (event.key === "Escape" && songMetaModal && !songMetaModal.classList.contains("hidden")) {
    closeSongMetaEditor();
  }
});

renderConnectionAddress();
renderStopButton();
renderSearchClear();
closeSongMetaEditor();
renderDocMenuButton();
renderLibrarySongs();
setActivePage(state.activePage);
