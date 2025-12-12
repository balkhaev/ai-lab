/**
 * Structured logging utility for consistent logging across services.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogData = Record<string, unknown>;

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: LogData;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, service, message, data, error } = entry;
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${service}]`;

  let output = `${prefix} ${message}`;

  if (data && Object.keys(data).length > 0) {
    output += ` ${JSON.stringify(data)}`;
  }

  if (error) {
    output += ` | Error: ${error.name}: ${error.message}`;
    if (error.stack) {
      output += `\n${error.stack}`;
    }
  }

  return output;
}

type CreateLogEntryOptions = {
  level: LogLevel;
  service: string;
  message: string;
  data?: LogData;
  error?: Error;
};

function createLogEntry(options: CreateLogEntryOptions): LogEntry {
  const { level, service, message, data, error } = options;
  return {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    data,
    error: error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined,
  };
}

export type Logger = {
  debug: (message: string, data?: LogData) => void;
  info: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
  error: (message: string, error?: Error, data?: LogData) => void;
};

/**
 * Creates a logger instance for a specific service.
 *
 * @param service - Name of the service (e.g., "gateway", "web", "ai-api")
 * @returns Logger instance with debug, info, warn, error methods
 *
 * @example
 * ```ts
 * const log = createLogger("gateway");
 * log.info("Server started", { port: 3000 });
 * log.error("Failed to connect", new Error("Connection refused"), { host: "localhost" });
 * ```
 */
export function createLogger(service: string): Logger {
  const isDebugEnabled =
    process.env.DEBUG === "true" || process.env.NODE_ENV === "development";

  return {
    debug: (message: string, data?: LogData) => {
      if (isDebugEnabled) {
        const entry = createLogEntry({
          level: "debug",
          service,
          message,
          data,
        });
        console.debug(formatLogEntry(entry));
      }
    },

    info: (message: string, data?: LogData) => {
      const entry = createLogEntry({ level: "info", service, message, data });
      console.info(formatLogEntry(entry));
    },

    warn: (message: string, data?: LogData) => {
      const entry = createLogEntry({ level: "warn", service, message, data });
      console.warn(formatLogEntry(entry));
    },

    error: (message: string, error?: Error, data?: LogData) => {
      const entry = createLogEntry({
        level: "error",
        service,
        message,
        data,
        error,
      });
      console.error(formatLogEntry(entry));
    },
  };
}
