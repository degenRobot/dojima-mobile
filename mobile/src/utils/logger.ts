import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogsInMemory = 1000;
  private logToConsole = true;
  private logToFile = true;
  private logFileName = 'app_logs.json';

  private constructor() {
    this.initialize();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async initialize() {
    // Load existing logs from storage
    try {
      const savedLogs = await AsyncStorage.getItem('debug_logs');
      if (savedLogs) {
        this.logs = JSON.parse(savedLogs);
        console.log(`[Logger] Loaded ${this.logs.length} existing logs`);
      }
    } catch (error) {
      console.error('[Logger] Failed to load existing logs:', error);
    }
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
    return `[${timestamp}] [${entry.level}] [${entry.component}] ${entry.message}${dataStr}`;
  }

  private getConsoleMethod(level: LogLevel) {
    switch (level) {
      case 'DEBUG': return console.log;
      case 'INFO': return console.info;
      case 'WARN': return console.warn;
      case 'ERROR': return console.error;
    }
  }

  private async saveToStorage() {
    try {
      // Save to AsyncStorage for quick access
      await AsyncStorage.setItem('debug_logs', JSON.stringify(this.logs));
      
      // Also save to file system for export
      if (this.logToFile && FileSystem.documentDirectory) {
        const filePath = FileSystem.documentDirectory + this.logFileName;
        await FileSystem.writeAsStringAsync(filePath, JSON.stringify(this.logs, null, 2));
      }
    } catch (error) {
      console.error('[Logger] Failed to save logs:', error);
    }
  }

  private log(level: LogLevel, component: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
    };

    // Add to memory
    this.logs.push(entry);
    
    // Trim if too many logs
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Console output - simplified for React Native
    if (this.logToConsole) {
      const consoleMethod = this.getConsoleMethod(level);
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      
      // Simplified format for React Native console
      const prefix = `[${timestamp}] [${level}] [${component}]`;
      
      if (data) {
        consoleMethod(prefix, message, data);
      } else {
        consoleMethod(prefix, message);
      }
    }

    // Save periodically (every 10 logs)
    if (this.logs.length % 10 === 0) {
      this.saveToStorage();
    }
  }

  debug(component: string, message: string, data?: any) {
    this.log('DEBUG', component, message, data);
  }

  info(component: string, message: string, data?: any) {
    this.log('INFO', component, message, data);
  }

  warn(component: string, message: string, data?: any) {
    this.log('WARN', component, message, data);
  }

  error(component: string, message: string, data?: any) {
    this.log('ERROR', component, message, data);
  }

  // Get all logs
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Get logs for specific component
  getComponentLogs(component: string): LogEntry[] {
    return this.logs.filter(log => log.component === component);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Clear all logs
  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem('debug_logs');
    
    if (FileSystem.documentDirectory) {
      const filePath = FileSystem.documentDirectory + this.logFileName;
      try {
        await FileSystem.deleteAsync(filePath);
      } catch (error) {
        // File might not exist
      }
    }
    console.log('[Logger] Logs cleared');
  }

  // Export logs as string
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Get file path for sharing
  async getLogFilePath(): Promise<string | null> {
    if (!FileSystem.documentDirectory) return null;
    
    const filePath = FileSystem.documentDirectory + this.logFileName;
    await this.saveToStorage();
    return filePath;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logDebug = (component: string, message: string, data?: any) => 
  logger.debug(component, message, data);

export const logInfo = (component: string, message: string, data?: any) => 
  logger.info(component, message, data);

export const logWarn = (component: string, message: string, data?: any) => 
  logger.warn(component, message, data);

export const logError = (component: string, message: string, data?: any) => 
  logger.error(component, message, data);