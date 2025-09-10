// Logging utility with environment-aware levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  isLovablePreview: boolean;
  enableTelemetryLogs: boolean;
  enableNetworkDiagnostics: boolean;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logCounts = new Map<string, number>();
  private logTimestamps = new Map<string, number>();
  
  constructor() {
    this.config = this.detectEnvironment();
  }
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private detectEnvironment(): LoggerConfig {
    const isLovablePreview = 
      window.location.hostname.includes('lovable.app') ||
      window.location.hostname.includes('preview') ||
      document.querySelector('script[src*="lovable"]') !== null;
    
    // Detect if running in development
    const isDevelopment = import.meta.env.DEV;
    
    // Detect if user has debugging enabled
    const hasDebugFlag = 
      localStorage.getItem('debug-network') === 'true' ||
      window.location.search.includes('debug=true');
    
    return {
      level: hasDebugFlag ? 'debug' : isDevelopment ? 'info' : 'warn',
      isLovablePreview,
      enableTelemetryLogs: hasDebugFlag,
      enableNetworkDiagnostics: hasDebugFlag || isDevelopment
    };
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const targetLevelIndex = levels.indexOf(level);
    
    return targetLevelIndex >= currentLevelIndex;
  }
  
  private throttleLog(key: string, intervalMs = 5000): boolean {
    const now = Date.now();
    const lastLog = this.logTimestamps.get(key) || 0;
    const count = this.logCounts.get(key) || 0;
    
    if (now - lastLog > intervalMs) {
      // Reset throttling
      this.logTimestamps.set(key, now);
      this.logCounts.set(key, 1);
      return true;
    } else {
      // Increment count but don't log
      this.logCounts.set(key, count + 1);
      return false;
    }
  }
  
  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.debug(`🔍 ${message}`, ...args);
    }
  }
  
  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.info(`ℹ️ ${message}`, ...args);
    }
  }
  
  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ ${message}`, ...args);
    }
  }
  
  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(`❌ ${message}`, ...args);
    }
  }
  
  // Throttled logging for repeated messages
  warnThrottled(key: string, message: string, ...args: any[]) {
    if (this.shouldLog('warn') && this.throttleLog(key)) {
      const count = this.logCounts.get(key) || 1;
      if (count > 1) {
        console.warn(`⚠️ ${message} (${count} occurrences)`, ...args);
      } else {
        console.warn(`⚠️ ${message}`, ...args);
      }
    }
  }
  
  errorThrottled(key: string, message: string, ...args: any[]) {
    if (this.shouldLog('error') && this.throttleLog(key)) {
      const count = this.logCounts.get(key) || 1;
      if (count > 1) {
        console.error(`❌ ${message} (${count} occurrences)`, ...args);
      } else {
        console.error(`❌ ${message}`, ...args);
      }
    }
  }
  
  // Grouped logging for diagnostics
  group(label: string, callback: () => void) {
    if (this.config.enableNetworkDiagnostics) {
      console.group(label);
      callback();
      console.groupEnd();
    } else {
      // Just run callback without grouping
      callback();
    }
  }
  
  // Network-specific logging
  network(level: LogLevel, message: string, ...args: any[]) {
    if (this.config.enableNetworkDiagnostics && this.shouldLog(level)) {
      const prefix = level === 'error' ? '🌐❌' : level === 'warn' ? '🌐⚠️' : '🌐ℹ️';
      console[level](`${prefix} ${message}`, ...args);
    }
  }
  
  // Health check specific logging (less verbose)
  health(success: boolean, message: string, consecutiveFailures = 0) {
    if (success) {
      // Only log health success in debug mode
      this.debug(`Health Check: ${message}`);
    } else {
      // Only log health failures after multiple attempts
      if (consecutiveFailures >= 2) {
        this.warnThrottled('health-check', `Health Check Failed: ${message} (${consecutiveFailures} consecutive failures)`);
      } else if (consecutiveFailures >= 5) {
        this.errorThrottled('health-check-critical', `Critical Health Check Failure: ${message} (${consecutiveFailures} consecutive failures)`);
      }
    }
  }
  
  // Telemetry logging (completely silent in production)
  telemetry(level: LogLevel, message: string, ...args: any[]) {
    if (this.config.enableTelemetryLogs && this.shouldLog(level)) {
      console[level](`📊 Telemetry: ${message}`, ...args);
    }
  }
  
  // Environment info
  getConfig() {
    return { ...this.config };
  }
  
  // Allow runtime configuration changes
  setLevel(level: LogLevel) {
    this.config.level = level;
  }
  
  enableNetworkDebug(enable: boolean) {
    this.config.enableNetworkDiagnostics = enable;
    localStorage.setItem('debug-network', enable.toString());
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Convenience functions
export const logDebug = (message: string, ...args: any[]) => logger.debug(message, ...args);
export const logInfo = (message: string, ...args: any[]) => logger.info(message, ...args);
export const logWarn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const logError = (message: string, ...args: any[]) => logger.error(message, ...args);
export const logNetwork = (level: LogLevel, message: string, ...args: any[]) => logger.network(level, message, ...args);
export const logHealth = (success: boolean, message: string, consecutiveFailures = 0) => logger.health(success, message, consecutiveFailures);
export const logTelemetry = (level: LogLevel, message: string, ...args: any[]) => logger.telemetry(level, message, ...args);