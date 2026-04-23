import fs from 'fs';
import path from 'path';
import logger from './logger';

interface StorageData {
  [date: string]: string[];
}

class StorageService {
  private filePath: string;
  private data: StorageData = {};

  constructor() {
    this.filePath = path.resolve(process.env.STORAGE_PATH || './storage.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(content);
      }
    } catch (error) {
      logger.error('Error loading storage file:', error);
      this.data = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      logger.error('Error saving storage file:', error);
    }
  }

  public isAlreadySent(date: string, timeId: string): boolean {
    return this.data[date]?.includes(timeId) || false;
  }

  public markAsSent(date: string, timeId: string) {
    if (!this.data[date]) {
      this.data[date] = [];
    }
    if (!this.data[date].includes(timeId)) {
      this.data[date].push(timeId);
      this.save();
    }
  }

  /**
   * Cleanup old entries to keep the file small (e.g., keep only last 30 days)
   */
  public cleanup() {
    const dates = Object.keys(this.data);
    if (dates.length > 30) {
      const sortedDates = dates.sort();
      const toRemove = sortedDates.slice(0, sortedDates.length - 30);
      toRemove.forEach(date => delete this.data[date]);
      this.save();
    }
  }
}

export default new StorageService();
