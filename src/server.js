import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import serve from "koa-static";
import { WebSocketServer } from "ws";
import { config } from "./config/index.js";
import { logger as defaultLogger } from "./utils/logger.js";
import { OscTransport } from "./osc/transport.js";
import { AbletonClient } from "./osc/abletonClient.js";
import { CacheStore } from "./domain/cacheStore.js";
import { LiveService } from "./domain/liveService.js";
import { SongProfileStore } from "./domain/songProfileStore.js";
import { BroadcastHub } from "./ws/broadcastHub.js";
import { createApiRouter } from "./api/routes.js";
import { networkUrlsForPort } from "./utils/network.js";

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(runtimeDir, "../client");

export const createRuntime = (overrides = {}) => {
  const runtimeConfig = {
    server: {
      ...config.server,
      ...(overrides.config?.server ?? {})
    },
    storage: {
      ...config.storage,
      ...(overrides.config?.storage ?? {})
    },
    osc: {
      ...config.osc,
      ...(overrides.config?.osc ?? {}),
      addresses: {
        ...config.osc.addresses,
        ...(overrides.config?.osc?.addresses ?? {})
      }
    }
  };
  const logger = overrides.logger ?? defaultLogger;

  const transport = overrides.transport ?? new OscTransport(runtimeConfig.osc, logger);
  const abletonClient = overrides.abletonClient ?? new AbletonClient(transport, runtimeConfig.osc.addresses);
  const cacheStore = overrides.cacheStore ?? new CacheStore();
  const songProfileStore = overrides.songProfileStore ?? new SongProfileStore({
    filePath: runtimeConfig.storage.songProfilesPath,
    logger
  });
  const liveService = overrides.liveService ?? new LiveService({
    abletonClient,
    cacheStore,
    songProfileStore,
    refreshIntervalMs: runtimeConfig.osc.refreshIntervalMs,
    sceneFallbackStopMs: runtimeConfig.osc.sceneFallbackStopMs,
    playingSlotPollIntervalMs: runtimeConfig.osc.playingSlotPollIntervalMs,
    songTimePollIntervalMs: runtimeConfig.osc.songTimePollIntervalMs,
    logger
  });

  const app = new Koa();
  app.use(bodyParser());

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      logger.error("Unhandled API error", error);
      ctx.status = error.status ?? 500;
      ctx.body = { error: "internal server error" };
    }
  });

  const router = createApiRouter({
    liveService,
    oscConfig: runtimeConfig.osc,
    storageConfig: runtimeConfig.storage
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.use(serve(staticRoot, { index: "index.html" }));

  const server = http.createServer(app.callback());
  const wsServer = new WebSocketServer({ server, path: "/ws" });
  const broadcastHub = new BroadcastHub(wsServer, logger);
  broadcastHub.attachService(liveService);

  const start = async () => {
    if (typeof transport.open === "function") {
      await transport.open();
    }

    await songProfileStore.load();
    await fs.mkdir(runtimeConfig.storage.songDocsDir, { recursive: true });

    await liveService.hydrateCache();
    liveService.startAutoRefresh();

    await new Promise((resolve) => {
      server.listen(runtimeConfig.server.port, runtimeConfig.server.host, resolve);
    });

    const address = server.address();
    const port = address?.port ?? runtimeConfig.server.port;
    const localUrl = `http://127.0.0.1:${port}`;
    const networkUrls = networkUrlsForPort(port);

    logger.info("Server ready", { local: localUrl, address });
    for (const networkUrl of networkUrls) {
      logger.info("Network", networkUrl);
    }

    return address;
  };

  const stop = async () => {
    liveService.stopAutoRefresh();
    broadcastHub.close();

    await new Promise((resolve) => {
      wsServer.close(() => resolve());
    });

    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    if (typeof transport.close === "function") {
      transport.close();
    }
  };

  return {
    app,
    server,
    wsServer,
    liveService,
    start,
    stop
  };
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const runtime = createRuntime();
  runtime.start().catch((error) => {
    if (error?.code === "EADDRINUSE" && Number(error?.port) === config.osc.localPort) {
      defaultLogger.error(
        `OSC port ${config.osc.localPort} is already in use. Stop the other playAble instance (npm run server-restart) or change OSC_LOCAL_PORT in .env`
      );
    } else {
      defaultLogger.error("Startup failed", error);
    }
    process.exitCode = 1;
  });
}
