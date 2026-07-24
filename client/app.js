const wsStatus = document.querySelector("#ws-status");
const connectionAddress = document.querySelector("#connection-address");
const timerStopToast = document.querySelector("#timer-stop-toast");
const docNotFoundToast = document.querySelector("#doc-not-found-toast");
const sceneList = document.querySelector("#scene-list");
const trackList = document.querySelector("#track-list");
const eventLog = document.querySelector("#event-log");
const stopSongButton = document.querySelector("#stop-song-button");
const recheckDefaultsButton = document.querySelector("#recheck-defaults-button");
const addGlobalDefaultsButton = document.querySelector("#add-global-defaults-button");
const clearGlobalDefaultsButton = document.querySelector("#clear-global-defaults-button");
const sceneSearch = document.querySelector("#scene-search");
const clearSceneSearch = document.querySelector("#clear-scene-search");
const sceneSort = document.querySelector("#scene-sort");
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
const activeSongDocPages = document.querySelector("#active-song-doc-pages");
const activeSongDocFrame = document.querySelector("#active-song-doc-frame");
const activeSongDocFallback = document.querySelector("#active-song-doc-fallback");
const songMetaModal = document.querySelector("#song-meta-modal");
const songMetaTitle = document.querySelector("#song-meta-title");
const songMetaNotes = document.querySelector("#song-meta-notes");
const songConfidenceRating = document.querySelector("#song-confidence-rating");
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
const SCENE_SORT_STORAGE_KEY = "playable.sceneSortBy";
const SCENE_SORT_OPTIONS = new Set(["unsorted", "title", "tag", "confidence"]);
const DOC_CUE_SAVE_DEBOUNCE_MS = 400;
const DOC_CUE_MATCH_WINDOW_SECONDS = 2;
const DOC_CUE_MIN_SAVE_DELTA_SECONDS = 2;
const DOC_CUE_MIN_SAVE_DELTA_RATIO = 0.03;
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

const isIpadLikeDevice = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform = String(navigator.platform ?? "");
  const userAgent = String(navigator.userAgent ?? "");
  const hasTouch = Number(navigator.maxTouchPoints ?? 0) > 1;

  return hasTouch && (
    /iPad/i.test(userAgent) ||
    /iPad/i.test(platform) ||
    (/Mac/i.test(platform) && /Safari/i.test(userAgent))
  );
};

const state = {
  scenes: [],
  tracks: [],
  sceneQuery: "",
  sceneSortBy: "unsorted",
  activePage: "songs",
  showConnectionAddress: false,
  connectionInfo: null,
  wsConnected: false,
  abletonOnline: false,
  isPlaying: false,
  currentSongTimeSeconds: null,
  activeSceneIndex: null,
  startingSceneIndex: null,
  songProfiles: new Map(),
  availablePdfs: new Set(),
  docBlobCache: new Map(),
  docPreloadPromise: null,
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
  editingSongConfidence: null,
  activeDocObjectUrl: null,
  activeDocRenderUrl: null,
  activeDocEmbedUrl: null,
  activeDocOpenHref: null,
  activeDocTitle: null,
  activeDocCueKey: null,
  activeDocCueRestoreAtSeconds: null,
  docPreviewAutoCloseId: null,
  docCueSaveTimerId: null,
  docCueRestoreFrameId: null,
  suppressDocCueCapture: false,
  docModalCloseViewportBound: false,
  pageScrollTopByPage: {
    songs: 0,
    library: 0,
    mixer: 0,
    log: 0
  },
  cacheSignatures: {
    tracks: ""
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

const readPageScrollTop = (page) => {
  if (state.activePage === page) {
    const container = scrollContainerForPage(page);
    return container?.scrollTop ?? state.pageScrollTopByPage[page] ?? 0;
  }

  return state.pageScrollTopByPage[page] ?? 0;
};

const tracksDataSignature = (tracks = []) => JSON.stringify(
  tracks.map((track) => [track.index, track.name, track.colorIndex ?? null])
);

const writePageScrollTop = (page, scrollTop) => {
  state.pageScrollTopByPage[page] = scrollTop;
  if (state.activePage !== page) {
    return;
  }

  const container = scrollContainerForPage(page);
  if (!container) {
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.scrollTop = scrollTop;
    });
  });
};

const isDocModalOpen = () => Boolean(docModal && !docModal.classList.contains("hidden"));

const clearDocPreviewAutoClose = () => {
  if (!state.docPreviewAutoCloseId) {
    return;
  }

  clearTimeout(state.docPreviewAutoCloseId);
  state.docPreviewAutoCloseId = null;
};

const clearDocCueSaveTimer = () => {
  if (!state.docCueSaveTimerId) {
    return;
  }

  clearTimeout(state.docCueSaveTimerId);
  state.docCueSaveTimerId = null;
};

const clearDocCueRestoreFrame = () => {
  if (!state.docCueRestoreFrameId) {
    return;
  }

  cancelAnimationFrame(state.docCueRestoreFrameId);
  state.docCueRestoreFrameId = null;
};

const resetActiveDocCueRestore = () => {
  state.activeDocCueRestoreAtSeconds = null;
};

const syncDocButtonState = () => {
  openDocButton?.classList.toggle("active", isDocModalOpen());
};

const docModalCloseInsetPx = () => {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return Math.max(rootFontSize * 0.85, 0);
};

const resetDocModalClosePosition = () => {
  if (!closeDocModalButton) {
    return;
  }

  closeDocModalButton.style.top = "";
  closeDocModalButton.style.right = "";
  closeDocModalButton.style.left = "";
};

const syncDocModalClosePosition = () => {
  if (!closeDocModalButton || !docModal || docModal.classList.contains("hidden")) {
    return;
  }

  const visualViewport = window.visualViewport;
  if (!visualViewport) {
    return;
  }

  const zoomed =
    visualViewport.offsetTop !== 0 ||
    visualViewport.offsetLeft !== 0 ||
    Math.abs(visualViewport.scale - 1) > 0.01 ||
    Math.abs(visualViewport.width - window.innerWidth) > 1;

  if (!zoomed) {
    resetDocModalClosePosition();
    return;
  }

  const inset = docModalCloseInsetPx();
  closeDocModalButton.style.top = `${visualViewport.offsetTop + visualViewport.height / 2}px`;
  closeDocModalButton.style.left = `${visualViewport.offsetLeft + inset}px`;
  closeDocModalButton.style.right = "auto";
};

const bindDocModalCloseViewportTracking = () => {
  if (state.docModalCloseViewportBound || !window.visualViewport) {
    return;
  }

  state.docModalCloseViewportBound = true;
  window.visualViewport.addEventListener("resize", syncDocModalClosePosition);
  window.visualViewport.addEventListener("scroll", syncDocModalClosePosition);
  window.addEventListener("resize", syncDocModalClosePosition);
};

const openDocModal = () => {
  if (!docModal) {
    return;
  }

  clearDocPreviewAutoClose();
  docModal.classList.remove("hidden");
  document.body.classList.add("doc-modal-open");
  bindDocModalCloseViewportTracking();
  syncDocModalClosePosition();
  syncDocButtonState();
};

const closeDocModal = () => {
  if (!docModal) {
    return;
  }

  clearDocPreviewAutoClose();
  docModal.classList.add("hidden");
  document.body.classList.remove("doc-modal-open");
  resetDocModalClosePosition();
  syncDocButtonState();
};

const releaseActiveDocObjectUrl = () => {
  if (!state.activeDocObjectUrl) {
    return;
  }

  URL.revokeObjectURL(state.activeDocObjectUrl);
  state.activeDocObjectUrl = null;
  state.activeDocRenderUrl = null;
};

const clearActiveSongDocument = () => {
  releaseActiveDocObjectUrl();
  state.activeDocOpenHref = null;
  state.activeDocTitle = null;
  resetSongDocViewer();
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

const normalizeLoadDocOptions = (options) => {
  if (options instanceof Element) {
    return { anchorElement: options, silent: false, activeSceneIndex: null };
  }

  return {
    anchorElement: options?.anchorElement ?? null,
    silent: Boolean(options?.silent),
    activeSceneIndex: Number.isInteger(options?.activeSceneIndex) ? options.activeSceneIndex : null
  };
};

const DOC_PRELOAD_CONCURRENCY = 6;

const docOpenHrefForBasename = (basename) => {
  const params = new URLSearchParams({ sceneTitle: basename });
  return `/api/songs/document/by-title?${params.toString()}`;
};

const revokeDocBlobCache = () => {
  for (const entry of state.docBlobCache.values()) {
    if (entry?.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
    }
  }

  state.docBlobCache.clear();
};

const showActiveSongDocViewer = () => {
  activeSongDocPanel?.classList.remove("hidden");
  activeSongDocPages?.classList.remove("hidden");
  activeSongDocFrame?.classList.add("hidden");
};

const applyDocEntry = ({ sceneIndex = null, sceneTitle = "Song Document", objectUrl, openHref }) => {
  if (state.activeDocObjectUrl !== objectUrl) {
    releaseActiveDocObjectUrl();
    state.activeDocObjectUrl = objectUrl;
    state.activeDocRenderUrl = null;
  }

  state.activeSceneIndex = Number.isInteger(sceneIndex) ? sceneIndex : null;
  state.activeDocOpenHref = openHref;
  state.activeDocTitle = String(sceneTitle || "Song Document").trim() || "Song Document";
  state.activeDocCueKey = normalizeSceneTitleKey(sceneTitle);
  state.activeDocCueRestoreAtSeconds = null;
  renderActiveSongDocument();
  updateSceneCardStates();
};

const cacheDocBasename = async (basename) => {
  if (!basename || state.docBlobCache.has(basename)) {
    return state.docBlobCache.get(basename) ?? null;
  }

  const openHref = docOpenHrefForBasename(basename);
  const response = await fetch(openHref);
  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();
  const entry = {
    objectUrl: URL.createObjectURL(blob),
    openHref
  };
  state.docBlobCache.set(basename, entry);
  return entry;
};

const preloadDocCache = async () => {
  revokeDocBlobCache();
  const basenames = [...state.availablePdfs];
  if (basenames.length === 0) {
    return;
  }

  let nextIndex = 0;
  const workers = Array.from({ length: DOC_PRELOAD_CONCURRENCY }, async () => {
    while (nextIndex < basenames.length) {
      const basename = basenames[nextIndex];
      nextIndex += 1;
      try {
        await cacheDocBasename(basename);
      } catch (error) {
        writeLog("song.doc.preload.error", { basename, message: error.message });
      }
    }
  });

  await Promise.all(workers);
  writeLog("song.doc.preload.done", { count: state.docBlobCache.size, total: basenames.length });
};

const scheduleDocPreload = () => {
  state.docPreloadPromise = preloadDocCache().catch((error) => {
    writeLog("song.doc.preload.error", { message: error.message });
  });
};

const loadDocForBasename = async (basename, { sceneIndex = null, sceneTitle = "Song Document", anchorElement = null, silent = false } = {}) => {
  if (!basename) {
    if (!silent) {
      showDocNotFoundToast("no attachment", anchorElement);
    }
    return false;
  }

  const cached = state.docBlobCache.get(basename);
  if (cached?.objectUrl) {
    applyDocEntry({
      sceneIndex,
      sceneTitle,
      objectUrl: cached.objectUrl,
      openHref: cached.openHref
    });
    return true;
  }

  if (state.docPreloadPromise) {
    await state.docPreloadPromise;
    const preloaded = state.docBlobCache.get(basename);
    if (preloaded?.objectUrl) {
      applyDocEntry({
        sceneIndex,
        sceneTitle,
        objectUrl: preloaded.objectUrl,
        openHref: preloaded.openHref
      });
      return true;
    }
  }

  try {
    const entry = await cacheDocBasename(basename);
    if (!entry?.objectUrl) {
      if (!silent) {
        await markDocUnavailable(anchorElement);
      }
      return false;
    }

    applyDocEntry({
      sceneIndex,
      sceneTitle,
      objectUrl: entry.objectUrl,
      openHref: entry.openHref
    });
    return true;
  } catch (error) {
    writeLog("song.doc.load.error", { basename, message: error.message });
    if (!silent) {
      await markDocUnavailable(anchorElement);
    }
    return false;
  }
};

const loadSceneDocument = async (sceneIndex, options = {}) => {
  const { anchorElement, silent } = normalizeLoadDocOptions(options);
  const scene = sceneForIndex(sceneIndex);
  const sceneTitle = scene?.name ?? null;
  const basename = sceneTitle ? findDocBasenameForTitle(sceneTitle) : null;

  return loadDocForBasename(basename, {
    sceneIndex,
    sceneTitle,
    anchorElement,
    silent
  });
};

const loadSongDocumentByTitle = async (sceneTitle, options = {}) => {
  const { anchorElement, silent, activeSceneIndex = null } = normalizeLoadDocOptions(options);
  const matchedDocBasename = findDocBasenameForTitle(sceneTitle);

  return loadDocForBasename(matchedDocBasename, {
    sceneIndex: activeSceneIndex,
    sceneTitle,
    anchorElement,
    silent
  });
};

const previewDocModalForTitle = async (sceneTitle, durationMs = 2000, anchorElement = null) => {
  const didLoad = await loadSongDocumentByTitle(sceneTitle, anchorElement);
  if (!didLoad) {
    return;
  }

  openDocModal();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return;
  }

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
  const lanIps = Array.isArray(state.connectionInfo?.network?.lanIps)
    ? state.connectionInfo.network.lanIps
    : [];
  const preferredLanIp = lanIps.find((ip) => typeof ip === "string" && ip.trim().length > 0) ?? null;
  const connectHost = preferredLanIp || (
    osc?.localAddress && osc.localAddress !== "0.0.0.0" && osc.localAddress !== "::"
      ? osc.localAddress
      : window.location.hostname
  );
  const connectUrl = `${window.location.protocol}//${connectHost}${window.location.port ? `:${window.location.port}` : ""}`;
  const oscInfo = osc
    ? `${osc.remoteHost}:${osc.remotePort} (local ${osc.localAddress}:${osc.localPort}, time poll ${osc.songTimePollIntervalMs}ms)`
    : "unknown";
  const statusInfo = status
    ? `Ableton online: ${status.abletonOnline ? "yes" : "no"}, playing: ${status.isPlaying ? "yes" : "no"}`
    : "Ableton status: unknown";
  connectionAddress.textContent = `Connect: ${connectUrl}\nURL: ${httpAddress} | WS: ${wsAddress} | Ableton OSC: ${oscInfo} | ${statusInfo}`;
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

const isMusicalKeyToken = (token) => /^[a-g](?:b|#|♭|♯)?m?$/i.test(token);

const isDescriptorToken = (token) => {
  if (!token) {
    return false;
  }

  if (token === "around" || token === "bpm") {
    return true;
  }

  if (/^\d+(?:\.\d+)?$/.test(token)) {
    return true;
  }

  return isMusicalKeyToken(token);
};

const trimTrailingDescriptors = (normalizedTitleKey) => {
  const words = String(normalizedTitleKey ?? "")
    .split(" ")
    .filter(Boolean);

  while (words.length > 0 && isDescriptorToken(words[words.length - 1])) {
    words.pop();
  }

  return words.join(" ");
};

const findDocBasenameForTitle = (sceneTitle) => {
  const exactSanitized = sanitizeSceneTitle(sceneTitle);
  if (exactSanitized && state.availablePdfs.has(exactSanitized)) {
    return exactSanitized;
  }

  const titleKey = normalizeSceneTitleKey(sceneTitle);
  if (!titleKey) {
    return null;
  }

  const trimmedTitleKey = trimTrailingDescriptors(titleKey);

  let prefixMatch = null;
  let trimmedMatch = null;
  for (const basename of state.availablePdfs) {
    const docKey = normalizeSceneTitleKey(basename);
    if (!docKey) {
      continue;
    }

    const trimmedDocKey = trimTrailingDescriptors(docKey);

    if (docKey === titleKey) {
      return basename;
    }

    if (trimmedTitleKey && trimmedDocKey && trimmedDocKey === trimmedTitleKey) {
      return basename;
    }

    if (!trimmedMatch && trimmedTitleKey && trimmedDocKey && (
      trimmedDocKey.startsWith(trimmedTitleKey) ||
      trimmedTitleKey.startsWith(trimmedDocKey)
    )) {
      trimmedMatch = basename;
    }

    if (!prefixMatch && (docKey.startsWith(titleKey) || titleKey.startsWith(docKey))) {
      prefixMatch = basename;
    }
  }

  return trimmedMatch ?? prefixMatch;
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

const normalizeSongConfidence = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 5) {
    return null;
  }

  return normalized;
};

const readStoredSceneSort = () => {
  try {
    const stored = localStorage.getItem(SCENE_SORT_STORAGE_KEY);
    if (stored && SCENE_SORT_OPTIONS.has(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors.
  }

  return "unsorted";
};

const writeStoredSceneSort = (sortBy) => {
  try {
    localStorage.setItem(SCENE_SORT_STORAGE_KEY, sortBy);
  } catch {
    // Ignore storage access errors.
  }
};

const renderSceneSortControl = () => {
  if (!sceneSort) {
    return;
  }

  sceneSort.value = state.sceneSortBy;
};

const compareScenesForDisplay = (leftScene, rightScene) => {
  const leftProfile = profileForScene(leftScene);
  const rightProfile = profileForScene(rightScene);
  const leftName = leftScene.name.trim().toLowerCase();
  const rightName = rightScene.name.trim().toLowerCase();

  if (state.sceneSortBy === "tag") {
    const leftTag = leftProfile?.tags?.[0]?.toLowerCase() ?? "";
    const rightTag = rightProfile?.tags?.[0]?.toLowerCase() ?? "";
    if (!leftTag && rightTag) {
      return 1;
    }

    if (leftTag && !rightTag) {
      return -1;
    }

    const tagCompare = leftTag.localeCompare(rightTag);
    if (tagCompare !== 0) {
      return tagCompare;
    }
  }

  if (state.sceneSortBy === "confidence") {
    const leftConfidence = normalizeSongConfidence(leftProfile?.confidence);
    const rightConfidence = normalizeSongConfidence(rightProfile?.confidence);
    const leftMissing = leftConfidence === null;
    const rightMissing = rightConfidence === null;
    if (leftMissing && !rightMissing) {
      return 1;
    }

    if (!leftMissing && rightMissing) {
      return -1;
    }

    if (!leftMissing && !rightMissing && leftConfidence !== rightConfidence) {
      return leftConfidence - rightConfidence;
    }
  }

  return leftName.localeCompare(rightName);
};

const renderSongMetaModal = () => {
  if (songMetaTitle) {
    const scene = Number.isInteger(state.editingSongSceneIndex) ? sceneForIndex(state.editingSongSceneIndex) : null;
    songMetaTitle.textContent = normalizeSceneDisplayName(scene?.name ?? state.editingSongSceneTitle ?? "Song");
  }

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

  if (songConfidenceRating) {
    const selectedConfidence = normalizeSongConfidence(state.editingSongConfidence);
    for (const button of songConfidenceRating.querySelectorAll(".modal-confidence-option")) {
      const optionConfidence = normalizeSongConfidence(button.dataset.confidence);
      button.classList.toggle("is-selected", optionConfidence !== null && optionConfidence === selectedConfidence);
      button.setAttribute("aria-checked", String(optionConfidence !== null && optionConfidence === selectedConfidence));
    }
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

const activeDocProfile = () => {
  if (Number.isInteger(state.activeSceneIndex)) {
    return profileForSceneIndex(state.activeSceneIndex);
  }

  if (!state.activeDocCueKey) {
    return null;
  }

  return state.songProfiles.get(state.activeDocCueKey) ?? null;
};

const docScrollMetrics = () => {
  if (!activeSongDocPages) {
    return null;
  }

  const maxScrollTop = Math.max(activeSongDocPages.scrollHeight - activeSongDocPages.clientHeight, 0);
  return {
    scrollTop: activeSongDocPages.scrollTop,
    maxScrollTop,
    scrollRatio: maxScrollTop > 0 ? activeSongDocPages.scrollTop / maxScrollTop : 0
  };
};

const upsertPdfCuePoint = (cuePoints = [], nextCuePoint) => {
  const normalizedAtSeconds = Math.round(Number(nextCuePoint.atSeconds) * 10) / 10;
  const normalizedScrollRatio = Math.max(0, Math.min(1, Number(nextCuePoint.scrollRatio)));
  const nextCuePoints = [];
  let replaced = false;

  for (const cuePoint of cuePoints) {
    const atSeconds = Number(cuePoint?.atSeconds);
    const scrollRatio = Number(cuePoint?.scrollRatio);
    if (!Number.isFinite(atSeconds) || atSeconds < 0 || !Number.isFinite(scrollRatio)) {
      continue;
    }

    if (Math.abs(atSeconds - normalizedAtSeconds) <= DOC_CUE_MATCH_WINDOW_SECONDS) {
      if (!replaced) {
        nextCuePoints.push({ atSeconds: normalizedAtSeconds, scrollRatio: normalizedScrollRatio });
        replaced = true;
      }
      continue;
    }

    nextCuePoints.push({
      atSeconds: Math.round(atSeconds * 10) / 10,
      scrollRatio: Math.max(0, Math.min(1, scrollRatio))
    });
  }

  if (!replaced) {
    nextCuePoints.push({ atSeconds: normalizedAtSeconds, scrollRatio: normalizedScrollRatio });
  }

  return nextCuePoints
    .sort((left, right) => left.atSeconds - right.atSeconds)
    .slice(0, 200);
};

const applyProfileToState = (profile) => {
  const profileKey = normalizeSceneTitleKey(profile?.sceneTitleKey || profile?.sceneTitle);
  if (profileKey) {
    state.songProfiles.set(profileKey, profile);
  }
};

const saveSongProfilePatch = async ({ sceneIndex = null, sceneTitle = null, patch }) => {
  const hasSceneIndex = Number.isInteger(sceneIndex);
  const hasSceneTitle = typeof sceneTitle === "string" && sceneTitle.trim().length > 0;
  if (!hasSceneIndex && !hasSceneTitle) {
    return null;
  }

  const response = hasSceneIndex
    ? await fetch(`/api/songs/${sceneIndex}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    })
    : await fetch("/api/songs/profile/by-title", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneTitle,
        ...patch
      })
    });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to update song details");
  }

  applyProfileToState(payload.profile);
  return payload.profile;
};

const scheduleActiveDocCueSave = () => {
  if (state.suppressDocCueCapture || !state.isPlaying || !Number.isFinite(state.currentSongTimeSeconds)) {
    return;
  }

  const metrics = docScrollMetrics();
  if (!metrics || metrics.maxScrollTop <= 0) {
    return;
  }

  const scene = Number.isInteger(state.activeSceneIndex) ? sceneForIndex(state.activeSceneIndex) : null;
  const sceneTitle = scene?.name ?? state.activeDocTitle;
  if (!sceneTitle) {
    return;
  }

  clearDocCueSaveTimer();
  state.docCueSaveTimerId = setTimeout(() => {
    state.docCueSaveTimerId = null;
    const profile = activeDocProfile();
    const currentCuePoints = Array.isArray(profile?.pdfCuePoints) ? profile.pdfCuePoints : [];
    const atSeconds = Number(state.currentSongTimeSeconds);
    const scrollRatio = metrics.scrollRatio;
    const existingCuePoint = currentCuePoints.find((cuePoint) => Math.abs(Number(cuePoint?.atSeconds) - atSeconds) <= DOC_CUE_MATCH_WINDOW_SECONDS) ?? null;
    if (existingCuePoint) {
      const existingAtSeconds = Number(existingCuePoint.atSeconds);
      const existingScrollRatio = Number(existingCuePoint.scrollRatio);
      if (
        Math.abs(existingAtSeconds - atSeconds) < DOC_CUE_MIN_SAVE_DELTA_SECONDS &&
        Math.abs(existingScrollRatio - scrollRatio) < DOC_CUE_MIN_SAVE_DELTA_RATIO
      ) {
        return;
      }
    }

    const nextCuePoints = upsertPdfCuePoint(currentCuePoints, { atSeconds, scrollRatio });
    void saveSongProfilePatch({
      sceneIndex: Number.isInteger(state.activeSceneIndex) ? state.activeSceneIndex : null,
      sceneTitle,
      patch: {
        notes: profile?.notes ?? "",
        tags: profile?.tags ?? [],
        confidence: normalizeSongConfidence(profile?.confidence),
        useFixedDocFont: Boolean(profile?.useFixedDocFont),
        pdfCuePoints: nextCuePoints
      }
    }).then(() => {
      writeLog("song.doc.cue.saved", {
        sceneTitle,
        atSeconds: Math.round(atSeconds * 10) / 10,
        scrollRatio: Math.round(scrollRatio * 1000) / 1000,
        cueCount: nextCuePoints.length
      });
    }).catch((error) => {
      writeLog("song.doc.cue.save.error", { message: error.message, sceneTitle });
    });
  }, DOC_CUE_SAVE_DEBOUNCE_MS);
};

const restoreActiveDocCuePosition = () => {
  if (!state.isPlaying || !Number.isFinite(state.currentSongTimeSeconds) || !activeSongDocPages || activeSongDocPages.classList.contains("hidden")) {
    return;
  }

  const profile = activeDocProfile();
  const cuePoints = Array.isArray(profile?.pdfCuePoints) ? profile.pdfCuePoints : [];
  if (cuePoints.length === 0) {
    return;
  }

  const currentTime = Number(state.currentSongTimeSeconds);
  let matchedCuePoint = null;
  for (const cuePoint of cuePoints) {
    const atSeconds = Number(cuePoint?.atSeconds);
    if (!Number.isFinite(atSeconds) || atSeconds > currentTime) {
      break;
    }
    matchedCuePoint = cuePoint;
  }

  if (!matchedCuePoint || matchedCuePoint.atSeconds === state.activeDocCueRestoreAtSeconds) {
    return;
  }

  const metrics = docScrollMetrics();
  if (!metrics || metrics.maxScrollTop <= 0) {
    return;
  }

  state.activeDocCueRestoreAtSeconds = matchedCuePoint.atSeconds;
  state.suppressDocCueCapture = true;
  activeSongDocPages.scrollTop = metrics.maxScrollTop * Math.max(0, Math.min(1, Number(matchedCuePoint.scrollRatio) || 0));
  writeLog("song.doc.cue.restored", {
    atSeconds: matchedCuePoint.atSeconds,
    scrollRatio: Math.round((Number(matchedCuePoint.scrollRatio) || 0) * 1000) / 1000
  });
  requestAnimationFrame(() => {
    state.suppressDocCueCapture = false;
  });
};

const PDF_RENDER_SCALE = 2;
let pdfjsLibPromise = null;
let pdfRenderTaskId = 0;

const loadPdfJs = () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("/vendor/pdfjs/pdf.mjs").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";
      return pdfjsLib;
    });
  }

  return pdfjsLibPromise;
};

const resetSongDocViewer = () => {
  pdfRenderTaskId += 1;
  clearDocCueRestoreFrame();
  clearDocCueSaveTimer();
  resetActiveDocCueRestore();
  activeSongDocPages?.classList.add("hidden");
  if (activeSongDocPages) {
    activeSongDocPages.innerHTML = "";
  }
  activeSongDocFrame?.classList.add("hidden");
  if (activeSongDocFrame && state.activeDocEmbedUrl !== "about:blank") {
    activeSongDocFrame.src = "about:blank";
    state.activeDocEmbedUrl = "about:blank";
  }
};

const renderActiveSongPdfPages = async (objectUrl) => {
  if (!activeSongDocPages) {
    return false;
  }

  const taskId = ++pdfRenderTaskId;
  activeSongDocPages.innerHTML = "";
  activeSongDocPages.classList.remove("hidden");
  activeSongDocFrame?.classList.add("hidden");

  try {
    const pdfjsLib = await loadPdfJs();
    if (taskId !== pdfRenderTaskId) {
      return false;
    }

    const pdf = await pdfjsLib.getDocument(objectUrl).promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (taskId !== pdfRenderTaskId) {
        return false;
      }

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const outputScale = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.className = "song-doc-page-canvas";
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D context unavailable");
      }

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      await page.render({ canvasContext: context, viewport }).promise;
      activeSongDocPages.append(canvas);
    }

    clearDocCueRestoreFrame();
    state.docCueRestoreFrameId = requestAnimationFrame(() => {
      state.docCueRestoreFrameId = null;
      restoreActiveDocCuePosition();
    });

    return true;
  } catch (error) {
    writeLog("song.doc.render.error", { message: error.message });
    return false;
  }
};

const docEmbedUrl = () => {
  if (!state.activeDocObjectUrl) {
    return null;
  }

  return `${state.activeDocObjectUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=100`;
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
  if (!activeSongDocPanel || !activeSongDocTitle || !activeSongDocOpen || !activeSongDocFallback) {
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
  const objectUrl = state.activeDocObjectUrl;

  activeSongDocPanel.classList.remove("hidden");
  activeSongDocTitle.textContent = sceneTitle ? `Song Document: ${sceneTitle}` : "Song Document";
  if (openHref) {
    activeSongDocOpen.href = openHref;
  } else {
    activeSongDocOpen.removeAttribute("href");
  }
  activeSongDocOpen.textContent = sceneTitle || "Open in New Tab";
  activeSongDocFallback.classList.add("hidden");
  renderDocMenuButton();

  if (objectUrl === state.activeDocRenderUrl) {
    showActiveSongDocViewer();
    restoreActiveDocCuePosition();
    return;
  }

  state.activeDocRenderUrl = objectUrl;
  void renderActiveSongPdfPages(objectUrl).then((didRender) => {
    if (state.activeDocObjectUrl !== objectUrl) {
      return;
    }

    if (didRender) {
      return;
    }

    if (isIpadLikeDevice()) {
      activeSongDocFallback.classList.remove("hidden");
      activeSongDocFallback.textContent = "PDF preview unavailable on this device. Cue saving requires the rendered preview.";
      activeSongDocPages?.classList.remove("hidden");
      activeSongDocFrame?.classList.add("hidden");
      return;
    }

    const embedUrl = docEmbedUrl();
    const nextEmbedUrl = embedUrl || "about:blank";
    activeSongDocPages?.classList.add("hidden");
    activeSongDocFrame?.classList.remove("hidden");
    if (nextEmbedUrl !== state.activeDocEmbedUrl) {
      activeSongDocFrame.src = nextEmbedUrl;
      state.activeDocEmbedUrl = nextEmbedUrl;
    }
  });
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
  state.editingSongConfidence = normalizeSongConfidence(profile?.confidence);

  if (songMetaNotes) {
    songMetaNotes.value = profile?.notes ?? "";
  }

  if (songTagInput) {
    songTagInput.value = "";
  }

  renderSongMetaModal();
  songMetaModal?.classList.remove("hidden");
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
  state.editingSongConfidence = normalizeSongConfidence(profile?.confidence);

  if (songMetaNotes) {
    songMetaNotes.value = profile?.notes ?? "";
  }

  if (songTagInput) {
    songTagInput.value = "";
  }

  renderSongMetaModal();
  songMetaModal?.classList.remove("hidden");
};

const closeSongMetaEditor = () => {
  songMetaModal?.classList.add("hidden");
  state.editingSongSceneIndex = null;
  state.editingSongSceneTitle = null;
  state.editingSongTags = [];
  state.editingSongConfidence = null;
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
  await saveSongProfilePatch({
    sceneIndex: hasSceneIndex ? state.editingSongSceneIndex : null,
    sceneTitle: hasSceneTitle ? state.editingSongSceneTitle : null,
    patch: {
      notes,
      tags: state.editingSongTags,
      confidence: state.editingSongConfidence,
      useFixedDocFont: state.editingUseFixedDocFont
    }
  });

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

const setActivePage = (page) => {
  if (!pages[page]) {
    page = "songs";
  }

  const previousPage = state.activePage;
  state.pageScrollTopByPage[previousPage] = readPageScrollTop(previousPage);

  state.activePage = page;
  document.body.classList.toggle("mixer-lock-scroll", page === "mixer");

  for (const [key, element] of Object.entries(pages)) {
    element?.classList.toggle("active", key === page);
  }

  openSongsButton?.classList.toggle("active", page === "songs");
  openLibraryButton?.classList.toggle("active", page === "library");
  openMixerButton?.classList.toggle("active", page === "mixer");
  openLogButton?.classList.toggle("active", page === "log");
  syncDocButtonState();

  writePageScrollTop(page, state.pageScrollTopByPage[page] ?? 0);
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

const applyDefaultsToUiState = (defaults) => {
  if (!defaults || typeof defaults !== "object") {
    return;
  }

  const levelEntries = Object.entries(defaults.levels ?? {});
  for (const [trackKey, level] of levelEntries) {
    const trackIndex = Number(trackKey);
    if (!Number.isInteger(trackIndex) || !Number.isFinite(level)) {
      continue;
    }

    state.trackLevels.set(trackIndex, Math.max(0, Math.min(1, Number(level))));
  }

  const muteEntries = Object.entries(defaults.mutes ?? {});
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

const updateSceneCardStates = () => {
  if (!sceneList) {
    return;
  }

  const isPlayLocked = state.startingSceneIndex !== null;
  for (const li of sceneList.querySelectorAll(".scene-card")) {
    const sceneIndex = Number(li.dataset.sceneIndex);
    if (!Number.isInteger(sceneIndex)) {
      continue;
    }

    const isActive = state.activeSceneIndex === sceneIndex;
    li.classList.toggle("is-active", isActive);
    li.setAttribute("aria-current", isActive ? "true" : "false");

    const button = li.querySelector(".scene-card-play");
    if (!button) {
      continue;
    }

    const isStarting = state.startingSceneIndex === sceneIndex;
    button.disabled = isPlayLocked;
    button.classList.toggle("is-processing", isStarting);
    button.setAttribute("aria-busy", String(isStarting));
    button.textContent = isStarting ? "…" : "Play";
  }
};

const setSceneStartProcessing = (sceneIndex) => {
  state.startingSceneIndex = sceneIndex;
  updateSceneCardStates();
};

const clearSceneStartProcessing = () => {
  state.startingSceneIndex = null;
  updateSceneCardStates();
};

const startScene = async (sceneIndex) => {
  if (state.startingSceneIndex !== null) {
    return;
  }

  setSceneStartProcessing(sceneIndex);
  console.info("[scene] start requested", { sceneIndex });

  clearSceneStopTimer("scene-start");

  try {
    const didLoadDoc = await loadSceneDocument(sceneIndex, { silent: true });
    if (didLoadDoc) {
      openDocModal();
    } else {
      clearActiveSongDocument();
      closeDocModal();
    }

    const response = await fetch(`/api/scenes/${sceneIndex}/start`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to start scene");
    }

    writeLog("scene.start", payload);
    console.info("[scene] start response", payload);
    applySceneMixToUiState(payload?.event?.appliedMix);
    state.activeSceneIndex = sceneIndex;
    state.isPlaying = true;
    renderStopButton();
    renderActiveSongDocument();
    updateSceneCardStates();
    armSceneStopTimer(sceneIndex);
  } catch (error) {
    console.info("[scene] start error", { sceneIndex, message: error.message });
    writeLog("scene.start.error", { message: error.message });
  } finally {
    clearSceneStartProcessing();
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
  const scrollTopToKeep = readPageScrollTop("songs");
  sceneList.innerHTML = "";

  const displayScenes = state.scenes.filter((scene) => {
    const profile = profileForScene(scene);
    const name = scene.name.trim();
    if (!name) {
      return false;
    }

    return matchesSceneQuery(name, state.sceneQuery, profile?.tags ?? []);
  });

  if (state.sceneSortBy !== "unsorted") {
    displayScenes.sort(compareScenesForDisplay);
  }

  for (const scene of displayScenes) {
    const songProfile = profileForScene(scene);

    const li = document.createElement("li");
    const isActiveScene = state.activeSceneIndex === scene.index;
    li.className = isActiveScene ? "scene-card is-active" : "scene-card";
    li.dataset.sceneIndex = String(scene.index);
    li.setAttribute("aria-current", isActiveScene ? "true" : "false");
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

    const isStarting = state.startingSceneIndex === scene.index;
    const isPlayLocked = state.startingSceneIndex !== null;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-card-play";
    button.classList.toggle("is-processing", isStarting);
    button.disabled = isPlayLocked;
    button.setAttribute("aria-busy", String(isStarting));
    button.textContent = isStarting ? "…" : "Play";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void startScene(scene.index);
    });

    const confidence = normalizeSongConfidence(songProfile?.confidence);
    const confidenceLabel = document.createElement("span");
    confidenceLabel.className = "scene-card-confidence";
    confidenceLabel.setAttribute("aria-hidden", "true");
    if (confidence !== null) {
      confidenceLabel.textContent = String(confidence);
      confidenceLabel.title = `Confidence ${confidence}`;
      confidenceLabel.removeAttribute("aria-hidden");
    }
    const primaryChildren = [confidenceLabel, button, label];

    const notesPreview = document.createElement("span");
    notesPreview.className = "scene-card-notes";
    notesPreview.textContent = songProfile?.notes?.trim()
      ? songProfile.notes
      : "";

    primary.append(...primaryChildren);
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

  writePageScrollTop("songs", scrollTopToKeep);
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

  const scrollTopToKeep = readPageScrollTop("library");
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

  writePageScrollTop("library", scrollTopToKeep);
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

  for (const [trackIndex, track] of sortedTracks.entries()) {
    const previousTrack = trackIndex > 0 ? sortedTracks[trackIndex - 1] : null;
    const previousIsBus = previousTrack ? /\bbus\b/i.test(previousTrack.name) : false;
    const currentIsBus = /\bbus\b/i.test(track.name);
    if (previousIsBus && !currentIsBus) {
      const rowBreak = document.createElement("li");
      rowBreak.className = "track-row-break";
      rowBreak.setAttribute("aria-hidden", "true");
      trackList.append(rowBreak);
    }

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
  state.cacheSignatures.tracks = tracksDataSignature(state.tracks);
  scheduleDocPreload();
  renderTracks();
  renderScenes();
  renderLibrarySongs();
  renderActiveSongDocument();
};

const applyCacheUpdate = (payload = {}) => {
  // Scenes are fetched once on app open and never change during a session.
  const nextTracks = payload.tracks ?? state.tracks;
  const nextTracksSignature = tracksDataSignature(nextTracks);
  if (nextTracksSignature === state.cacheSignatures.tracks) {
    return;
  }

  state.tracks = nextTracks;
  state.cacheSignatures.tracks = nextTracksSignature;
  renderTracks();
};

const addGlobalDefaults = async () => {
  const response = await fetch("/api/tracks/defaults/add", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to add global defaults");
  }

  applyDefaultsToUiState(payload.defaults);
  writeLog("track.defaults.add", payload);
};

const clearGlobalDefaults = async () => {
  const response = await fetch("/api/tracks/defaults/clear", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to clear global defaults");
  }

  const stateResponse = await fetch("/api/tracks/state");
  const statePayload = await stateResponse.json();
  if (!stateResponse.ok) {
    throw new Error(statePayload.error ?? "Failed to refresh Ableton track state");
  }

  applySceneMixToUiState(statePayload.state);
  writeLog("track.defaults.clear", payload);
};

const resetGlobalDefaults = async () => {
  const response = await fetch("/api/tracks/defaults/reset", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to reset defaults in Ableton");
  }

  applySceneMixToUiState(payload.applied);
  writeLog("track.defaults.reset", payload);
};

const runMixerDefaultsActionWithFeedback = async (button, {
  pendingLabel,
  successLabel,
  action,
  errorLogLabel
}) => {
  if (!button || typeof action !== "function") {
    return;
  }

  const originalLabel = button.dataset.defaultLabel || button.textContent;
  button.dataset.defaultLabel = originalLabel;

  if (button.disabled) {
    return;
  }

  button.disabled = true;
  button.textContent = pendingLabel;

  try {
    await action();
    button.textContent = successLabel;
  } catch (error) {
    button.textContent = "Error";
    writeLog(errorLogLabel, { message: error.message });
  } finally {
    setTimeout(() => {
      button.textContent = button.dataset.defaultLabel || originalLabel;
      button.disabled = false;
    }, 900);
  }
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
        applyCacheUpdate(payload.payload);
      }

      if (payload.type === "song.playback.status") {
        const previousSceneIndex = state.activeSceneIndex;
        const previousSongTimeSeconds = state.currentSongTimeSeconds;
        const previousIsPlaying = state.isPlaying;
        state.abletonOnline = true;
        if (Number.isInteger(payload.activeSceneIndex)) {
          state.activeSceneIndex = payload.activeSceneIndex;
          renderActiveSongDocument();
          updateSceneCardStates();
        }
        state.currentSongTimeSeconds = Number.isFinite(payload.currentSongTimeSeconds)
          ? payload.currentSongTimeSeconds
          : null;
        setWsStatus(state.wsConnected);
        state.isPlaying = Boolean(payload.isPlaying);
        if (
          previousSceneIndex !== state.activeSceneIndex ||
          (Number.isFinite(previousSongTimeSeconds) && Number.isFinite(state.currentSongTimeSeconds) && state.currentSongTimeSeconds + 0.75 < previousSongTimeSeconds) ||
          (!previousIsPlaying && state.isPlaying)
        ) {
          resetActiveDocCueRestore();
        }
        renderStopButton();
        restoreActiveDocCuePosition();
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
        state.currentSongTimeSeconds = null;
        resetActiveDocCueRestore();
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
        state.isPlaying = true;
        renderStopButton();
        renderActiveSongDocument();
        updateSceneCardStates();
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

    try {
      const stateResponse = await fetch("/api/tracks/state");
      if (stateResponse.ok) {
        const statePayload = await stateResponse.json();
        applySceneMixToUiState(statePayload.state);
        writeLog("track.state.load", statePayload);
      }
    } catch (error) {
      writeLog("track.state.load.error", { message: error.message });
    }

    try {
      const defaultsResetResponse = await fetch("/api/tracks/defaults/reset", { method: "POST" });
      if (defaultsResetResponse.ok) {
        const defaultsResetPayload = await defaultsResetResponse.json();
        applySceneMixToUiState(defaultsResetPayload.applied);
        writeLog("track.defaults.reset.load", defaultsResetPayload);
      }
    } catch (error) {
      writeLog("track.defaults.reset.load.error", { message: error.message });
    }

    if (state.connectionInfo?.status) {
      state.abletonOnline = Boolean(state.connectionInfo.status.abletonOnline);
      state.isPlaying = Boolean(state.connectionInfo.status.isPlaying);
      state.currentSongTimeSeconds = Number.isFinite(state.connectionInfo.status.currentSongTimeSeconds)
        ? state.connectionInfo.status.currentSongTimeSeconds
        : null;
      resetActiveDocCueRestore();
      if (Number.isInteger(state.connectionInfo.status.activeSceneIndex)) {
        state.activeSceneIndex = state.connectionInfo.status.activeSceneIndex;
      }
      setWsStatus(state.wsConnected);
      renderStopButton();
      renderActiveSongDocument();
      updateSceneCardStates();
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

sceneSort?.addEventListener("change", () => {
  const nextSort = sceneSort.value;
  state.sceneSortBy = SCENE_SORT_OPTIONS.has(nextSort) ? nextSort : "unsorted";
  writeStoredSceneSort(state.sceneSortBy);
  renderScenes();
});

songConfidenceRating?.addEventListener("click", (event) => {
  const button = event.target.closest(".modal-confidence-option");
  if (!button) {
    return;
  }

  const nextConfidence = normalizeSongConfidence(button.dataset.confidence);
  state.editingSongConfidence = state.editingSongConfidence === nextConfidence ? null : nextConfidence;
  renderSongMetaModal();
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
  closeDocModal();
  setActivePage("mixer");
});

openLogButton?.addEventListener("click", () => {
  closeDocModal();
  setActivePage("log");
});

openSongsButton?.addEventListener("click", () => {
  closeDocModal();
  setActivePage("songs");
});

openLibraryButton?.addEventListener("click", () => {
  closeDocModal();
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

  if (state.activeDocObjectUrl && state.activeDocRenderUrl === state.activeDocObjectUrl) {
    showActiveSongDocViewer();
    openDocModal();
    return;
  }

  void loadSceneDocument(state.activeSceneIndex, openDocButton).then((didLoad) => {
    if (didLoad) {
      openDocModal();
    }
  });
});

activeSongDocPages?.addEventListener("scroll", () => {
  scheduleActiveDocCueSave();
});

closeDocModalButton?.addEventListener("click", () => {
  closeDocModal();
});

recheckDefaultsButton?.addEventListener("click", () => {
  void runMixerDefaultsActionWithFeedback(recheckDefaultsButton, {
    pendingLabel: "Resetting...",
    successLabel: "Reset",
    errorLogLabel: "track.defaults.reset.error",
    action: resetGlobalDefaults
  });
});

addGlobalDefaultsButton?.addEventListener("click", () => {
  void runMixerDefaultsActionWithFeedback(addGlobalDefaultsButton, {
    pendingLabel: "Saving...",
    successLabel: "Saved",
    errorLogLabel: "track.defaults.add.error",
    action: addGlobalDefaults
  });
});

clearGlobalDefaultsButton?.addEventListener("click", () => {
  void runMixerDefaultsActionWithFeedback(clearGlobalDefaultsButton, {
    pendingLabel: "Clearing...",
    successLabel: "Cleared",
    errorLogLabel: "track.defaults.clear.error",
    action: clearGlobalDefaults
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

state.sceneSortBy = readStoredSceneSort();
renderSceneSortControl();
renderConnectionAddress();
renderStopButton();
renderSearchClear();
closeSongMetaEditor();
renderDocMenuButton();
renderLibrarySongs();
setActivePage(state.activePage);
