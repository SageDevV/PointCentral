"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
class StorageService {
    constructor() {
        this.data = {};
        this.filePath = path_1.default.resolve(process.env.STORAGE_PATH || './storage.json');
        this.load();
    }
    load() {
        try {
            if (fs_1.default.existsSync(this.filePath)) {
                const content = fs_1.default.readFileSync(this.filePath, 'utf-8');
                this.data = JSON.parse(content);
            }
        }
        catch (error) {
            logger_1.default.error('Error loading storage file:', error);
            this.data = {};
        }
    }
    save() {
        try {
            fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        }
        catch (error) {
            logger_1.default.error('Error saving storage file:', error);
        }
    }
    wasSent(date, timeId) {
        return this.data[date]?.includes(timeId) || false;
    }
    markAsSent(date, timeId) {
        if (!this.data[date]) {
            this.data[date] = [];
        }
        if (!this.data[date].includes(timeId)) {
            this.data[date].push(timeId);
            this.save();
        }
    }
}
exports.default = new StorageService();
