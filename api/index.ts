import { app, setupApp } from "../server/index";

let isSetup = false;

export default async function handler(req: any, res: any) {
    // Initialize app  on first request
    if (!isSetup) {
        await setupApp();
        isSetup = true;
    }

    // Pass request to Express app
    return app(req, res);
}
