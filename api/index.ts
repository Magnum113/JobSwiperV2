// Dynamic import for CommonJS module in ES module context
export default async function handler(req: any, res: any) {
    const serverModule = await import('../dist/index.cjs');
    // The compiled bundle should export the app
    return serverModule.app(req, res);
}
