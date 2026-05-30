import Router from "@koa/router";
import multer from "@koa/multer";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { convertAttachmentToHtml } from "../docs/htmlConverter.js";

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

  const buildHtmlStoredName = ({ sceneIndex, storedName }) => {
    const ext = path.extname(storedName || "");
    const baseName = path.basename(storedName || "", ext || undefined);
    const fallback = `scene-${sceneIndex}-${Date.now()}-song_doc`;
    return `${baseName || fallback}.html`;
  };

  const regenerateHtmlForProfile = async (sceneIndex, profile) => {
    const doc = profile?.doc;
    if (!doc?.storedName) {
      return profile;
    }

    const sourcePath = path.join(storageConfig.songDocsDir, path.basename(doc.storedName));
    const buffer = await fs.readFile(sourcePath);
    const html = await convertAttachmentToHtml({
      buffer,
      originalName: doc.fileName,
      forceMonospace: Boolean(profile?.useFixedDocFont)
    });

    if (typeof html !== "string" || html.length === 0) {
      return profile;
    }

    const htmlStoredName = doc.htmlStoredName || buildHtmlStoredName({ sceneIndex, storedName: doc.storedName });
    const htmlPath = path.join(storageConfig.songDocsDir, htmlStoredName);
    await fs.writeFile(htmlPath, html, "utf8");

    return liveService.setSongDocument(sceneIndex, {
      ...doc,
      htmlStoredName,
      htmlUrl: `/api/songs/${sceneIndex}/document/html`
    });
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

  router.get("/api/songs/:sceneIndex/profile", (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    ctx.body = {
      profile: typeof liveService.getSongProfile === "function"
        ? liveService.getSongProfile(result.data)
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

    let profile = await liveService.setSongNotes(
      result.data,
      notesResult.data.notes,
      notesResult.data.tags,
      notesResult.data.useFixedDocFont
    );

    if (typeof notesResult.data.useFixedDocFont === "boolean" && profile?.doc?.storedName) {
      try {
        profile = await regenerateHtmlForProfile(result.data, profile);
      } catch {
        // Keep notes/tags updates working even when conversion refresh fails.
      }
    }

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

    const allowedExts = new Set([".pdf", ".doc", ".docx"]);
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExts.has(ext)) {
      ctx.status = 400;
      ctx.body = { error: "only .pdf, .doc, and .docx are supported" };
      return;
    }

    const timestamp = Date.now();
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64) || "song_doc";
    const storedName = `scene-${result.data}-${timestamp}-${safeBaseName}${ext}`;
    const targetPath = path.join(storageConfig.songDocsDir, storedName);
    await fs.mkdir(storageConfig.songDocsDir, { recursive: true });
    await fs.writeFile(targetPath, file.buffer);

    let htmlStoredName = "";
    let htmlUrl = "";
    try {
      const profile = liveService.getSongProfile(result.data);
      const html = await convertAttachmentToHtml({
        buffer: file.buffer,
        originalName: file.originalname,
        forceMonospace: Boolean(profile?.useFixedDocFont)
      });

      if (typeof html === "string" && html.length > 0) {
        htmlStoredName = `scene-${result.data}-${timestamp}-${safeBaseName}.html`;
        const htmlPath = path.join(storageConfig.songDocsDir, htmlStoredName);
        await fs.writeFile(htmlPath, html, "utf8");
        htmlUrl = `/api/songs/${result.data}/document/html`;
      }
    } catch {
      // Keep existing upload path working even if HTML conversion fails.
      htmlStoredName = "";
      htmlUrl = "";
    }

    const profile = await liveService.setSongDocument(result.data, {
      fileName: file.originalname,
      mimeType: file.mimetype || "application/octet-stream",
      url: `/api/songs/${result.data}/document`,
      htmlUrl,
      storedName,
      htmlStoredName,
      uploadedAt: new Date().toISOString()
    });

    ctx.body = { ok: true, profile };
  });

  router.get("/api/songs/:sceneIndex/document", async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const profile = liveService.getSongProfile(result.data);
    const storedName = profile?.doc?.storedName;
    if (!storedName) {
      ctx.status = 404;
      ctx.body = { error: "document not found" };
      return;
    }

    const safeName = path.basename(storedName);
    const targetPath = path.join(storageConfig.songDocsDir, safeName);
    try {
      await fs.access(targetPath);
    } catch {
      ctx.status = 404;
      ctx.body = { error: "document not found" };
      return;
    }

    ctx.type = profile.doc.mimeType || "application/octet-stream";
    ctx.set("Content-Disposition", `inline; filename="${encodeURIComponent(profile.doc.fileName || safeName)}"`);
    ctx.body = await fs.readFile(targetPath);
  });

  router.get("/api/songs/:sceneIndex/document/html", async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const profile = liveService.getSongProfile(result.data);
    const htmlStoredName = profile?.doc?.htmlStoredName;
    if (!htmlStoredName) {
      ctx.status = 404;
      ctx.body = { error: "html document not found" };
      return;
    }

    const safeName = path.basename(htmlStoredName);
    const targetPath = path.join(storageConfig.songDocsDir, safeName);
    try {
      await fs.access(targetPath);
    } catch {
      ctx.status = 404;
      ctx.body = { error: "html document not found" };
      return;
    }

    ctx.type = "text/html; charset=utf-8";
    ctx.body = await fs.readFile(targetPath, "utf8");
  });

  router.delete("/api/songs/:sceneIndex/document", async (ctx) => {
    const result = parseIndex(ctx.params.sceneIndex);
    if (!result.success) {
      ctx.status = 400;
      ctx.body = { error: "sceneIndex must be a non-negative integer" };
      return;
    }

    const profile = liveService.getSongProfile(result.data);
    const storedName = profile?.doc?.storedName;
    const htmlStoredName = profile?.doc?.htmlStoredName;
    if (storedName) {
      const targetPath = path.join(storageConfig.songDocsDir, path.basename(storedName));
      await fs.rm(targetPath, { force: true });
    }
    if (htmlStoredName) {
      const targetPath = path.join(storageConfig.songDocsDir, path.basename(htmlStoredName));
      await fs.rm(targetPath, { force: true });
    }

    const updated = await liveService.clearSongDocument(result.data);
    ctx.body = { ok: true, profile: updated };
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
