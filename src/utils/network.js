import os from "node:os";

export const lanIpCandidates = () => {
  const interfaces = os.networkInterfaces();
  const ips = new Set();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      ips.add(entry.address);
    }
  }

  return Array.from(ips).sort((left, right) => {
    const leftLinkLocal = left.startsWith("169.254.");
    const rightLinkLocal = right.startsWith("169.254.");
    if (leftLinkLocal !== rightLinkLocal) {
      return leftLinkLocal ? 1 : -1;
    }

    return left.localeCompare(right);
  });
};

export const networkUrlsForPort = (port) => lanIpCandidates()
  .filter((ip) => !ip.startsWith("169.254."))
  .map((ip) => `http://${ip}:${port}`);
