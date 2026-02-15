type RequestHandler = (req: any, res: any) => any;

let appPromise: Promise<RequestHandler> | null = null;

async function getApp(): Promise<RequestHandler> {
  if (!appPromise) {
    appPromise = (async () => {
      const serverModule = await import("../dist/server/index.cjs");

      // In serverless mode, routes/static middleware are not initialized
      // automatically, so we run setup once on cold start.
      if (typeof serverModule.setupApp === "function") {
        await serverModule.setupApp();
      }

      if (typeof serverModule.app !== "function") {
        throw new Error("Invalid server export: app handler is missing");
      }

      return serverModule.app as RequestHandler;
    })().catch((error) => {
      appPromise = null;
      throw error;
    });
  }

  return appPromise;
}

export default async function handler(req: any, res: any) {
  const app = await getApp();
  return app(req, res);
}
