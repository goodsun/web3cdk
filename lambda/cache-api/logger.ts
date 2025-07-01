const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class Logger {
  private level: number;

  constructor() {
    this.level = LOG_LEVELS[LOG_LEVEL as keyof typeof LOG_LEVELS] || LOG_LEVELS.info;
  }

  error(message: string, data?: any) {
    if (this.level >= LOG_LEVELS.error) {
      console.error(JSON.stringify({ level: 'error', message, data, timestamp: new Date().toISOString() }));
    }
  }

  warn(message: string, data?: any) {
    if (this.level >= LOG_LEVELS.warn) {
      console.warn(JSON.stringify({ level: 'warn', message, data, timestamp: new Date().toISOString() }));
    }
  }

  info(message: string, data?: any) {
    if (this.level >= LOG_LEVELS.info) {
      console.info(JSON.stringify({ level: 'info', message, data, timestamp: new Date().toISOString() }));
    }
  }

  debug(message: string, data?: any) {
    if (this.level >= LOG_LEVELS.debug) {
      console.debug(JSON.stringify({ level: 'debug', message, data, timestamp: new Date().toISOString() }));
    }
  }
}

export const logger = new Logger();