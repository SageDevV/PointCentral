"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
const scheduler_1 = __importDefault(require("./scheduler"));
const api_routes_1 = __importDefault(require("./api-routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files from public/
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
// API routes
app.use(api_routes_1.default);
// Health check
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
// Fallback: serve index.html for any non-API route (SPA behavior)
app.get('/{*path}', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
app.listen(Number(port), '0.0.0.0', () => {
    logger_1.default.info(`🚀 PointCentral server listening on port ${port}`);
    scheduler_1.default.start();
});
