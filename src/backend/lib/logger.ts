/**
 * @fileoverview Logger utility for tracing and metrics
 */

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error instanceof Error ? error.message : String(error),
      ...meta,
      timestamp: new Date().toISOString()
    }));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'debug', message, ...meta, timestamp: new Date().toISOString() }));
  },
};
