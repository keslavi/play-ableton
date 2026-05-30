import { WebSocket } from "ws";

export class BroadcastHub {
  #wsServer;
  #logger;
  #heartbeatTimer;

  constructor(wsServer, logger) {
    this.#wsServer = wsServer;
    this.#logger = logger;

    this.#wsServer.on("connection", (socket) => {
      socket.isAlive = true;

      socket.on("pong", () => {
        socket.isAlive = true;
      });

      socket.send(JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString()
      }));
    });

    this.#startHeartbeat();
  }

  #startHeartbeat() {
    this.#heartbeatTimer = setInterval(() => {
      for (const socket of this.#wsServer.clients) {
        if (socket.isAlive === false) {
          socket.terminate();
          continue;
        }

        socket.isAlive = false;
        socket.ping();
      }
    }, 30000);

    this.#heartbeatTimer.unref?.();
  }

  attachService(liveService) {
    liveService.on("cache.updated", (snapshot) => {
      this.broadcast({ type: "cache.updated", payload: snapshot });
    });

    liveService.on("scene.start.requested", (event) => {
      this.broadcast(event);
    });

    liveService.on("song.stop.requested", (event) => {
      this.broadcast(event);
    });

    liveService.on("song.playback.ended", (event) => {
      this.broadcast(event);
    });

    liveService.on("song.playback.status", (event) => {
      this.broadcast(event);
    });

    liveService.on("osc.connection.status", (event) => {
      this.broadcast(event);
    });

    liveService.on("scene.started", (event) => {
      this.broadcast({ type: "scene.started", payload: event });
    });

    liveService.on("osc.error", (event) => {
      this.broadcast({ type: "osc.error", payload: event });
    });
  }

  broadcast(event) {
    const payload = JSON.stringify(event);

    for (const socket of this.#wsServer.clients) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  close() {
    if (this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }

    this.#logger.info("WebSocket hub closed");
  }
}
