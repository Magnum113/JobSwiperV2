// Import the compiled server bundle
const serverModule = require('../dist/index.cjs');

export default async function handler(req: any, res: any) {
    // The compiled bundle auto-initializes, just use it
    // In serverless, we rely on the bundled Express app
    return serverModule.app(req, res);
}
