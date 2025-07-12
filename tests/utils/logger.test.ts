import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger, LogLevel, logger } from "../../src/utils/logger";

describe("Logger", () => {
	let mockConsole: {
		log: ReturnType<typeof vi.fn>;
		warn: ReturnType<typeof vi.fn>;
		error: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		// Mock console methods
		mockConsole = {
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		};

		// Replace console methods with mocks
		global.console.log = mockConsole.log;
		global.console.warn = mockConsole.warn;
		global.console.error = mockConsole.error;
	});

	afterEach(() => {
		// Restore original console methods
		global.console.log = console.log;
		global.console.warn = console.warn;
		global.console.error = console.error;
	});

	describe("Log Levels", () => {
		it("should log DEBUG messages when level is DEBUG", () => {
			const logger = new Logger(LogLevel.DEBUG);
			logger.debug("Debug message");

			expect(mockConsole.log).toHaveBeenCalledTimes(1);
			const logCall = mockConsole.log.mock.calls[0][0];
			const logData = JSON.parse(logCall);

			expect(logData.level).toBe("DEBUG");
			expect(logData.message).toBe("Debug message");
		});

		it("should log INFO messages when level is INFO", () => {
			const logger = new Logger(LogLevel.INFO);
			logger.info("Info message");

			expect(mockConsole.log).toHaveBeenCalledTimes(1);
			const logCall = mockConsole.log.mock.calls[0][0];
			const logData = JSON.parse(logCall);

			expect(logData.level).toBe("INFO");
			expect(logData.message).toBe("Info message");
		});

		it("should log WARN messages when level is WARN", () => {
			const logger = new Logger(LogLevel.WARN);
			logger.warn("Warning message");

			expect(mockConsole.warn).toHaveBeenCalledTimes(1);
			const logCall = mockConsole.warn.mock.calls[0][0];
			const logData = JSON.parse(logCall);

			expect(logData.level).toBe("WARN");
			expect(logData.message).toBe("Warning message");
		});

		it("should log ERROR messages when level is ERROR", () => {
			const logger = new Logger(LogLevel.ERROR);
			logger.error("Error message");

			expect(mockConsole.error).toHaveBeenCalledTimes(1);
			const logCall = mockConsole.error.mock.calls[0][0];
			const logData = JSON.parse(logCall);

			expect(logData.level).toBe("ERROR");
			expect(logData.message).toBe("Error message");
		});

		it("should log FATAL messages when level is FATAL", () => {
			const logger = new Logger(LogLevel.FATAL);
			logger.fatal("Fatal message");

			expect(mockConsole.error).toHaveBeenCalledTimes(1);
			const logCall = mockConsole.error.mock.calls[0][0];
			const logData = JSON.parse(logCall);

			expect(logData.level).toBe("FATAL");
			expect(logData.message).toBe("Fatal message");
		});

		it("should include service name in log messages", () => {
			const logger = new Logger(LogLevel.INFO, "test-service");
			logger.info("Service message");

			expect(mockConsole.log).toHaveBeenCalledTimes(1);
			const logCall = mockConsole.log.mock.calls[0][0];
			const logData = JSON.parse(logCall);

			expect(logData.service).toBe("test-service");
		});
	});
});
