import dgram from "node:dgram";

const listenHost = process.env.FANOUT_LISTEN_HOST ?? "0.0.0.0";
const listenPort = Number.parseInt(process.env.FANOUT_LISTEN_PORT ?? "11001", 10);
const targetSpec = process.env.FANOUT_TARGETS ?? "127.0.0.1:11003,127.0.0.1:11004";

const targets = targetSpec
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((entry) => {
    const [host, portRaw] = entry.split(":");
    const port = Number.parseInt(portRaw ?? "", 10);

    if (!host || Number.isNaN(port)) {
      throw new Error(`Invalid FANOUT_TARGETS entry: ${entry}`);
    }

    return { host, port };
  });

if (Number.isNaN(listenPort)) {
  throw new Error("Invalid FANOUT_LISTEN_PORT");
}

const inSocket = dgram.createSocket("udp4");
const outSocket = dgram.createSocket("udp4");

inSocket.on("error", (error) => {
  console.error("[fanout:error]", error);
});

outSocket.on("error", (error) => {
  console.error("[fanout:error]", error);
});

inSocket.on("message", (message, remote) => {
  for (const target of targets) {
    outSocket.send(message, target.port, target.host);
  }

  console.log(
    "[fanout:packet]",
    `${remote.address}:${remote.port}`,
    "->",
    targets.map((target) => `${target.host}:${target.port}`).join(",")
  );
});

inSocket.bind(listenPort, listenHost, () => {
  console.log("[fanout:ready]", `${listenHost}:${listenPort}`);
  console.log("[fanout:targets]", targets.map((target) => `${target.host}:${target.port}`).join(","));
});

const shutdown = () => {
  inSocket.close();
  outSocket.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
