import path from "path";
import fs from "fs";

// Определяем путь к сертификатам (не блокирует запуск если не найдены)
function getCertPath(): string | undefined {
  const prodPath = path.join(process.cwd(), "dist/certs/russian_trusted_root_ca_pem.crt");
  if (fs.existsSync(prodPath)) return prodPath;
  const devPath = path.join(process.cwd(), "server/certs/russian_trusted_root_ca_pem.crt");
  if (fs.existsSync(devPath)) return devPath;
  console.warn("[Certs] Certificate files not found, continuing without custom CA");
  return undefined;
}

const certPath = getCertPath();
if (certPath) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
}
import "./setupCerts";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Early request logging for debugging
app.use((req, _res, next) => {
  if (req.path.startsWith("/auth")) {
    console.log(`[DEBUG] Incoming request: ${req.method} ${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`);
  }
  next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Health check endpoints for Autoscale
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// Replit Autoscale checks "/" - respond quickly for health probes
app.get("/", (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  // Respond to Replit health checks and curl/wget probes
  if (userAgent.includes("kube-probe") || 
      userAgent.includes("curl") || 
      userAgent.includes("wget") ||
      userAgent.includes("Replit") ||
      !userAgent) {
    return res.status(200).send("OK");
  }
  // For browsers, continue to serve SPA
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path.startsWith("/auth")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error("[Express Error]", err);
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
        console.log("[Startup] Application startup complete - ready to accept requests");
      },
    );
  } catch (err) {
    console.error("[Startup Error]", err);
    process.exit(1);
  }
})();
