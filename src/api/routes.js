import Router from "@koa/router";
import multer from "@koa/multer";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const indexSchema = z.coerce.number().int().nonnegative();
const volumeSchema = z.coerce.number().min(0).max(1);
const notesSchema = z.object({
  notes: z.string().max(500).default(""),
  tags: z.array(z.string().max(40)).max(20).optional(),
  useFixedDocFont: z.boolean().optional()
});

const parseIndex = (value) => indexSchema.safeParse(value);

export const createApiRouter = ({ liveService, oscConfig, storageConfig }) => {
  const router = new Router();
  const upload = multer({ storage: multer.memoryStorage() });

  const sanitizeSceneTitle = (value) => String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\.$/, "")
    .replace(/ /g, "_")
    .slice(0, 120);

  const sceneTitleForIndex = (sceneIndex) => {
    const scenes = typeof liveService.getScenes === "function" ? liveService.getScenes() : [];
    const scene = scenes.find((item) => item?.index === sceneIndex);
    return sanitizeSceneTitle(scene?.name);
  };

  const fileExists = async (targetPath) => {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  };

  const pdfPathForScene = (sceneIndex) => {
    const sceneTitle = sceneTitleForIndex(sceneIndex);
    if (!sceneTitle) {
      return null;
    }

    return path.join(storageConfig.songDocsDir, `${sceneTitle}.pdf`);
  };

  router.get("/api/health", (ctx) => {
    const status = typeof liveService.getConnectionStatus === "function"
      ? liveService.getConnectionStatus()
      : { abletonOnline: false, isPlaying: false, lastPlaybackResponseAt: null };

    ctx.body = {
      ok: true,
      timestamp: new Date().toISOString(),
      status,
      osc: {
        remoteHost: oscConfig?.remoteHost ?? null,
        remotePort: oscConfig?.remotePort ?? null,
        localAddress: oscConfig?.localAddress ?? null,
        localPort: oscConfig?.localPort ?? null,
        songTimePollIntervalMs: oscConfig?.songTimePollIntervalMs ?? null,
        sceneFallbackStopMs: oscConfig?.sceneFallbackStopMs ?? 0,
        playingSlotPollIntervalMs: oscConfig?.playingSlotPollIntervalMs ?? null
      },
      storage: {
        songDocsDefaultRoot: storageConfig?.songDocsDefaultRoot ?? ""
      }
    };
  });

  router.get("/api/songs/profiles", (ctx) => {
    ctx.body = {
      profiles: typeof liveService.getSongProfiles === "function"
        ? liveService.getSongProfiles()
        : []
    };
  });

  router.get("/api/songs/available-docs", async (ctx) => {
    await fs.mkdir(storageConfig.songDocsDir, { recursive: true });
    let entries;
    try {
      entries = await fs.readdir(storageConfig.songDocsDir, { withFileTypes: true });
    } catch {
      ctx.body = { pdfs: [] };
      return;
    }

    const pdfs = entries
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf")
      .map((entry) => path.basename(entry.name, ".pdf"));

    ctx.body = { pdfs };
  });

  router.get("/api/songs/:sceneIndex/profile", (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    ctx.body = {
      profile: typeof liveService.getSongProfileForScene === "function"
        ? liveService.getSongProfileForScene(result.data)
        : null
    };
  });

  router.patch("/api/songs/:sceneIndex/profile", async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const notesResult = notesSchema.safeParse(ctx.request.body ?? {});
    if (!notesResult.success) {
      ctx.status = 400;
      ctx.body = { error: "notes must be <= 500 chars and tags must be <= 20 values (<=40 chars each)" };
      return;
    }

    const profile = await liveService.setSongNotesForScene(
      result.data,
      notesResult.data.notes,
      notesResult.data.tags,
      notesResult.data.useFixedDocFont
    );

    ctx.body = { ok: true, profile };
  });

  router.post("/api/tracks/recheck-defaults", async (ctx) => {
    const defaults = await liveService.recheckTrackDefaults();
    ctx.body = { ok: true, defaults };
  });

  router.post("/api/songs/:sceneIndex/document", upload.single("file"), async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const file = ctx.file;
    if (!file) {
      ctx.status = 400;
      ctx.body = { error: "file is required" };
      return;
    }

    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext !== ".pdf") {
      ctx.status = 400;
      ctx.body = { error: "only .pdf is supported" };
      return;
    }

    const sceneTitle = sceneTitleForIndex(result.data);
    if (!sceneTitle) {
      ctx.status = 404;
      ctx.body = { error: "scene not found" };
      return;
    }

    const storedName = `${sceneTitle}.pdf`;
    const targetPath = path.join(storageConfig.songDocsDir, storedName);
    await fs.mkdir(storageConfig.songDocsDir, { recursive: true });
    await fs.writeFile(targetPath, file.buffer);

    ctx.body = { ok: true };
  });

  router.get("/api/songs/:sceneIndex/document", async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const filePath = pdfPathForScene(result.data);
    if (!filePath || !await fileExists(filePath)) {
      ctx.status = 404;
      ctx.body = { error: "document not found" };
      return;
    }

    ctx.type = "application/pdf";
    ctx.body = await fs.readFile(filePath);
  });

  router.delete("/api/songs/:sceneIndex/document", async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const filePath = pdfPathForScene(result.data);
    if (filePath) {
      await fs.rm(filePath, { force: true });
    }

    ctx.body = { ok: true };
  });

  router.get("/api/tracks", (ctx) => {
    ctx.body = {
      tracks: liveService.getTracks()
    };
  });

  router.get("/api/scenes", (ctx) => {
    ctx.body = {
      scenes: liveService.getScenes()
    };
  });

  router.post("/api/scenes/:sceneIndex/start", async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const maxSceneIndex = liveService.getScenes().length - 1;
    if (maxSceneIndex >= 0 && result.data > maxSceneIndex) {
      ctx.status = 404;
      ctx.body = { error: "sceneIndex is out of range" };
      return;
    }

    const response = await liveService.startScene(result.data);
    ctx.body = {
      ok: true,
      event: response
    };
  });

  router.post("/api/song/stop", async (ctx) => {
    const inputReason = ctx.request.body?.reason;
    const reason = inputReason === "timer" || inputReason === "playback-ended" || inputReason === "slots-ended"
      ? inputReason
      : "manual";

    const response = await liveService.stopSong(reason);
    ctx.body = {
      ok: true,
      event: response
    };
  });

  router.post("/api/tracks/:trackIndex/mute", async (ctx) => {
    const result = parseIndex(ctx.params.trackIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "trackIndex must be a non-negative integer" };
      return;
    }

    const mute = ctx.request.body?.mute;
    if (typeof mute !== "boolean") {
      ctx.status = 400;
      ctx.body = { error: "mute must be a boolean" };
      return;
    }

    const response = await liveService.setTrackMute(result.data, mute);
    ctx.body = {
      ok: true,
      event: response
    };
  });

  router.post("/api/tracks/:trackIndex/volume", async (ctx) => {
    const result = parseIndex(ctx.params.trackIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "trackIndex must be a non-negative integer" };
      return;
    }

    const levelResult = volumeSchema.safeParse(ctx.request.body?.level);
    if (!levelResult.success) {
      ctx.status = 400;
      ctx.body = { error: "level must be a number between 0 and 1" };
      return;
    }

    const response = await liveService.setTrackVolume(result.data, levelResult.data);
    ctx.body = {
      ok: true,
      event: response
    };
  });

  return router;
};
