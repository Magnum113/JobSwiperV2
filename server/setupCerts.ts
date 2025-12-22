import path from "path";
import fs from "fs";

function getCertPath(): string | null {
  try {
    const prodPath = path.join(process.cwd(), "dist/certs/russian_trusted_root_ca_pem.crt");
    if (fs.existsSync(prodPath)) return prodPath;
    const devPath = path.join(process.cwd(), "server/certs/russian_trusted_root_ca_pem.crt");
    if (fs.existsSync(devPath)) return devPath;
  } catch {
    // Ignore errors
  }
  return null;
}

const certPath = getCertPath();
if (certPath) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
  console.log("[Certs] TLS verification enabled.");
}
