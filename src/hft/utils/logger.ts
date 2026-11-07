/**
 * Logger Utility
 * Senior-grade logging for HFT system
 * 
 * Features:
 * - Structured logging (JSON or text format)
 * - Multiple output destinations (console, file)
 * - Log levels (debug, info, warn, error)
 * - Context-aware logging
 * - Performance metrics
 */

import { createWriteStream, WriteStream } from 'fs';
import { format } from 'util';

// ============================================================================
// Types
// ============================================================================

/** Log level */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Log format */
export type LogFormat = 'json' | 'text';

/** Log output destination */
export type LogOutput = 'console' | 'file' | 'both';

/** Log entry */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

/** Logger configuration */
export interface LoggerConfig {
  level: LogLevel;
  format: LogFormat;
  output: LogOutput;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

/** Logger interface */
export interface Logger {
  debug(message: string, metadata?: Record<string, any>): void;
  info(message: string, metadata?: Record<string, any>): void;
  warn(message: string, metadata?: Record<string, any>): void;
  error(message: string | Error, metadata?: Record<string, any>): void;
  child(context: string): Logger;
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;
}

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Logger
 * 
 * A structured logger with support for multiple outputs and formats.
 */
export class HFTLogger implements Logger {
  private level: LogLevel;
  private format: LogFormat;
  private output: LogOutput;
  private context?: string;
  private fileStream?: WriteStream;
  private filePath?: string;
  private maxFileSize: number;
  private maxFiles: number;

  constructor(config: Partial<LoggerConfig> = {}) {
    const defaultConfig: LoggerConfig = {
      level: 'info',
      format: 'text',
      output: 'console',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    };

    const fullConfig = { ...defaultConfig, ...config };

    this.level = fullConfig.level;
    this.format = fullConfig.format;
    this.output = fullConfig.output;
    this.filePath = fullConfig.filePath;
    this.maxFileSize = fullConfig.maxFileSize;
    this.maxFiles = fullConfig.maxFiles;

    // Initialize file stream if needed
    if (this.output === 'file' || this.output === 'both') {
      if (this.filePath) {
        this.initializeFileStream();
      }
    }
  }

  /**
   * Initialize file stream
   */
  private initializeFileStream(): void {
    try {
      this.fileStream = createWriteStream(this.filePath!, { flags: 'a' });
      
      this.fileStream.on('error', (error) => {
        console.error('Logger file stream error:', error);
      });
    } catch (error) {
      console.error('Failed to initialize logger file stream:', error);
    }
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.level);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }

  /**
   * Format log entry as JSON
   */
  private formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Format log entry as text
   */
  private formatText(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? `[${entry.context}]` : '';
    const message = entry.message;
    const error = entry.error ? `\nError: ${entry.error.stack || entry.error.message}` : '';
    const metadata = entry.metadata ? `\nMetadata: ${JSON.stringify(entry.metadata)}` : '';

    return `${timestamp} ${level} ${context} ${message}${error}${metadata}`;
  }

  /**
   * Write log entry
   */
  private write(entry: LogEntry): void {
    const formatted = this.format === 'json' ? this.formatJson(entry) : this.formatText(entry);

    // Write to console
    if (this.output === 'console' || this.output === 'both') {
      const level = entry.level;
      if (level === 'debug') {
        console.debug(formatted);
      } else if (level === 'info') {
        console.info(formatted);
      } else if (level === 'warn') {
        console.warn(formatted);
      } else {
        console.error(formatted);
      }
    }

    // Write to file
    if (this.output === 'file' || this.output === 'both') {
      if (this.fileStream) {
        this.fileStream.write(formatted + '\n');
      }
    }
  }

  /**
   * Create a log entry
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata,
      error,
    };

    this.write(entry);
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  public debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  public error(message: string | Error, metadata?: Record<string, any>): void {
    if (message instanceof Error) {
      this.log('error', message.message, metadata, message);
    } else {
      this.log('error', message, metadata);
    }
  }

  /**
   * Create a child logger with a specific context
   */
  public child(context: string): Logger {
    const child = new HFTLogger({
      level: this.level,
      format: this.format,
      output: this.output,
      filePath: this.filePath,
    });
    child.context = context;
    return child;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Close the logger and clean up resources
   */
  public close(): void {
    if (this.fileStream) {
      this.fileStream.close();
    }
  }
}

// ============================================================================
// Logger Factory
// ============================================================================

/** Global logger configuration */
let globalConfig: Partial<LoggerConfig> = {};

/**
 * Configure global logger settings
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = config;
}

/**
 * Create a logger with the given context
 */
export function createLogger(context?: string): Logger {
  const logger = new HFTLogger(globalConfig);
  if (context) {
    return logger.child(context);
  }
  return logger;
}

/**
 * Create a logger with default HFT configuration
 */
export function createHFTLogger(context: string): Logger {
  return createLogger(context);
}

// ============================================================================
// Performance Metrics Logger
// ============================================================================

/**
 * Performance metrics logger
 */
export class PerformanceLogger {
  private logger: Logger;
  private metrics: Map<string, { count: number; total: number; min: number; max: number }> = new Map();

  constructor(context: string) {
    this.logger = createLogger(`${context}:Performance`);
  }

  /**
   * Record a metric
   */
  public record(name: string, value: number): void {
    const metric = this.metrics.get(name) || { count: 0, total: 0, min: Infinity, max: -Infinity };
    metric.count++;
    metric.total += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    this.metrics.set(name, metric);

    this.logger.debug(`Metric: ${name} = ${value}`);
  }

  /**
   * Get metric statistics
   */
  public getStats(name: string): { count: number; avg: number; min: number; max: number } | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      return null;
    }
    return {
      count: metric.count,
      avg: metric.total / metric.count,
      min: metric.min,
      max: metric.max,
    };
  }

  /**
   * Log all metrics
   */
  public logAll(): void {
    for (const [name, metric] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        this.logger.info(`Metric ${name}: count=${stats.count}, avg=${stats.avg.toFixed(4)}, min=${stats.min.toFixed(4)}, max=${stats.max.toFixed(4)}`);
      }
    }
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics.clear();
  }
}

// ============================================================================
// Default Logger
// ============================================================================

// Create a default logger for the HFT system
export const defaultLogger = createLogger('HFT');
