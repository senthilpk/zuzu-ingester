export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	FATAL = 4,
}

export interface LogContext {
	[key: string]: any;
}

export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	context?: LogContext;
	error?: Error;
}

class Logger {
	private level: LogLevel;
	private serviceName: string;

	constructor(
		level: LogLevel = LogLevel.INFO,
		serviceName: string = "zuzu-ingester",
	) {
		this.level = level;
		this.serviceName = serviceName;
	}

	private formatMessage(
		level: string,
		message: string,
		context?: LogContext,
		error?: Error,
	): string {
		const timestamp = new Date().toISOString();
		const baseLog = {
			timestamp,
			level,
			service: this.serviceName,
			message,
		};

		if (context) {
			Object.assign(baseLog, context);
		}

		if (error) {
			Object.assign(baseLog, {
				error: {
					name: error.name,
					message: error.message,
					stack: error.stack,
				},
			});
		}

		return JSON.stringify(baseLog);
	}

	private log(
		level: LogLevel,
		levelName: string,
		message: string,
		context?: LogContext,
		error?: Error,
	): void {
		const formattedMessage = this.formatMessage(
			levelName,
			message,
			context,
			error,
		);

		switch (level) {
			case LogLevel.DEBUG:
			case LogLevel.INFO:
				console.log(formattedMessage);
				break;
			case LogLevel.WARN:
				console.warn(formattedMessage);
				break;
			case LogLevel.ERROR:
			case LogLevel.FATAL:
				console.error(formattedMessage);
				break;
		}
	}

	debug(message: string, context?: LogContext): void {
		this.log(LogLevel.DEBUG, "DEBUG", message, context);
	}

	info(message: string, context?: LogContext): void {
		this.log(LogLevel.INFO, "INFO", message, context);
	}

	warn(message: string, context?: LogContext): void {
		this.log(LogLevel.WARN, "WARN", message, context);
	}

	error(message: string, error?: Error, context?: LogContext): void {
		this.log(LogLevel.ERROR, "ERROR", message, context, error);
	}

	fatal(message: string, error?: Error, context?: LogContext): void {
		this.log(LogLevel.FATAL, "FATAL", message, context, error);
	}

	// Method to set log level dynamically
	setLevel(level: LogLevel): void {
		this.level = level;
	}

	// Method to get current log level
	getLevel(): LogLevel {
		return this.level;
	}
}

// Helper function to convert string to LogLevel
const getLogLevelFromEnv = (): LogLevel => {
	const level = process.env.LOG_LEVEL;
	switch (level) {
		case "DEBUG":
			return LogLevel.DEBUG;
		case "INFO":
			return LogLevel.INFO;
		case "WARN":
			return LogLevel.WARN;
		case "ERROR":
			return LogLevel.ERROR;
		case "FATAL":
			return LogLevel.FATAL;
		default:
			return LogLevel.INFO;
	}
};

// Create default logger instance
const defaultLogger = new Logger(
	getLogLevelFromEnv(),
	process.env.SERVICE_NAME || "zuzu-ingester",
);

export { Logger, defaultLogger as logger };
