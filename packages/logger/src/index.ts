import pino, { type LoggerOptions } from "pino";

export type AppLoggerOptions = LoggerOptions & {
  service: string;
};

export function createLoggerOptions(options: AppLoggerOptions): LoggerOptions {
  return {
    name: options.service,
    level: process.env.LOG_LEVEL ?? "info",
    ...options,
  };
}

export function createLogger(options: AppLoggerOptions) {
  return pino(createLoggerOptions(options));
}
