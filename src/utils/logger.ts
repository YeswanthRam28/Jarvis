import * as winston from "winston";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private logDir: string;

  private constructor() {
    const homeDir = os.homedir();
    this.logDir = path.join(homeDir, ".jarvis", "logs");

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
      })
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: logFormat,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          ),
        }),
        new winston.transports.File({
          filename: path.join(this.logDir, "jarvis.log"),
          maxsize: 5 * 1024 * 1024,
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(this.logDir, "error.log"),
          level: "error",
          maxsize: 5 * 1024 * 1024,
          maxFiles: 5,
        }),
      ],
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, ...meta: unknown[]): void {
    this.logger.info(message, ...meta);
  }

  public warn(message: string, ...meta: unknown[]): void {
    this.logger.warn(message, ...meta);
  }

  public error(message: string, ...meta: unknown[]): void {
    this.logger.error(message, ...meta);
  }

  public debug(message: string, ...meta: unknown[]): void {
    this.logger.debug(message, ...meta);
  }

  public getLogDir(): string {
    return this.logDir;
  }
}
