import { EventEmitter } from "node:events";
import oscPackage from "osc";

const { UDPPort } = oscPackage;

const normalizeArg = (value) => {
  if (value && typeof value === "object" && "type" in value && "value" in value) {
    return value;
  }

  if (Number.isInteger(value)) {
    return { type: "i", value };
  }

  if (typeof value === "number") {
    return { type: "f", value };
  }

  if (typeof value === "string") {
    return { type: "s", value };
  }

  if (typeof value === "boolean") {
    return { type: "i", value: value ? 1 : 0 };
  }

  return { type: "s", value: String(value ?? "") };
};

export class OscTransport extends EventEmitter {
  #config;
  #logger;
  #port;
  #ready = false;

  constructor(config, logger) {
    super();
    this.#config = config;
    this.#logger = logger;
  }

  async open() {
    if (this.#port) {
      return;
    }

    this.#port = new UDPPort({
      localAddress: this.#config.localAddress,
      localPort: this.#config.localPort,
      remoteAddress: this.#config.remoteHost,
      remotePort: this.#config.remotePort,
      metadata: true
    });

    this.#port.on("ready", () => {
      this.#ready = true;
      this.#logger.info("OSC ready", {
        localAddress: this.#config.localAddress,
        localPort: this.#config.localPort,
        remoteAddress: this.#config.remoteHost,
        remotePort: this.#config.remotePort
      });
      this.emit("ready");
    });

    this.#port.on("message", (message, timeTag, info) => {
      this.emit("message", { message, timeTag, info });
    });

    this.#port.on("error", (error) => {
      this.#logger.error("OSC error", error);
      this.emit("error", error);
    });

    this.#port.open();

    await new Promise((resolve) => {
      this.once("ready", resolve);
    });
  }

  send(address, args = []) {
    if (!this.#port || !this.#ready) {
      throw new Error("OSC transport is not ready");
    }

    this.#port.send({
      address,
      args: args.map(normalizeArg)
    });
  }

  close() {
    if (!this.#port) {
      return;
    }

    this.#ready = false;
    this.#port.close();
    this.#port = null;
    this.emit("closed");
  }
}
