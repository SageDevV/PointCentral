import fs from 'fs';
import path from 'path';
import logger from './logger';

interface DayLogs {
  entry?: string;
  lunchOut?: string;
  lunchIn?: string;
  exit?: string;
  notifiedLunch?: boolean;
  notifiedExit?: boolean;
}

interface StorageData {
  [date: string]: DayLogs;
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

  public getDayLogs(date: string): DayLogs {
    return this.data[date] || {};
  }

  public updateDayLogs(date: string, logs: Partial<DayLogs>) {
    this.data[date] = { ...this.getDayLogs(date), ...logs };
    this.save();
  }

  public clearOldLogs() {
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
