import { describe, it, expect, vi } from "vitest";
import { zerothrowWinstonFormat, createWinstonLogger } from "../src/loggers/winston";
import { ZeroError } from "../src/error";
import { ok, err } from "../src/result";

describe("Winston formatter", () => {
  describe("transform function", () => {
    it("formats ZeroError instances", () => {
      const error = new ZeroError("DATABASE_ERROR", "Connection failed", {
        context: { host: "localhost", port: 5432 }
      });
      
      const info = {
        level: "error",
        message: "Database operation failed",
        error
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.zerothrow).toMatchObject({
        type: "ZeroError",
        code: "DATABASE_ERROR",
        message: "Connection failed",
        context: { host: "localhost", port: 5432 }
      });
      expect(transformed.formattedMessage).toBe("[DATABASE_ERROR] Connection failed");
    });

    it("includes stack trace when debug mode is enabled", () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';
      
      try {
        const error = new ZeroError("DEBUG_ERROR", "Debug test");
        const info = {
          level: "error",
          message: "Error in debug mode",
          error
        };
        
        const transformed = zerothrowWinstonFormat.transform(info);
        
        expect(transformed.zerothrow.stack).toBeDefined();
      } finally {
        if (originalLogLevel === undefined) {
          delete process.env.LOG_LEVEL;
        } else {
          process.env.LOG_LEVEL = originalLogLevel;
        }
      }
    });

    it("handles symbol error codes", () => {
      const symbolCode = Symbol("CUSTOM_ERROR");
      const error = new ZeroError(symbolCode, "Custom error");
      
      const info = {
        level: "error",
        message: "Error occurred",
        error
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.zerothrow.code).toBe("Symbol(CUSTOM_ERROR)");
      expect(transformed.formattedMessage).toBe("[Symbol(CUSTOM_ERROR)] Custom error");
    });

    it("formats Ok results", () => {
      const result = ok({ success: true });
      
      const info = {
        level: "info",
        message: "Operation completed",
        result
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.zerothrow).toMatchObject({
        type: "Result",
        status: "ok",
        value: { success: true }
      });
      expect(transformed.formattedMessage).toBe("[OK] Operation completed");
    });

    it("formats Ok results with default message when none provided", () => {
      const result = ok({ data: "test" });
      
      const info = {
        level: "info",
        message: "", // Empty message
        result
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.formattedMessage).toBe("[OK] Operation succeeded");
    });

    it("formats Err results with ZeroError", () => {
      const error = new ZeroError("AUTH_FAILED", "Invalid credentials");
      const result = err(error);
      
      const info = {
        level: "error",
        message: "",
        result
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.zerothrow).toMatchObject({
        type: "Result",
        status: "err",
        error: {
          code: "AUTH_FAILED",
          message: "Invalid credentials"
        }
      });
      expect(transformed.formattedMessage).toBe("[ERR] Invalid credentials");
    });

    it("formats Err results with regular Error", () => {
      const error = new Error("Generic error");
      const result = err(error);
      
      const info = {
        level: "error",
        message: "Something went wrong",
        result
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.zerothrow).toMatchObject({
        type: "Result",
        status: "err",
        error: {
          message: "Generic error"
        }
      });
      expect(transformed.formattedMessage).toBe("[ERR] Something went wrong");
    });

    it("does not mutate original info object", () => {
      const originalInfo = {
        level: "error",
        message: "Original message",
        error: new ZeroError("TEST_ERROR", "Test error")
      };
      
      // Create a deep copy to compare later
      const infoCopy = JSON.parse(JSON.stringify(originalInfo));
      
      const transformed = zerothrowWinstonFormat.transform(originalInfo);
      
      // Check that original wasn't mutated
      expect(originalInfo.message).toBe("Original message");
      expect(originalInfo.zerothrow).toBeUndefined();
      
      // Check that transformed has the changes
      expect(transformed.message).toBe("Original message"); // Original message preserved
      expect(transformed.formattedMessage).toBe("[TEST_ERROR] Test error");
      expect(transformed.zerothrow).toBeDefined();
    });

    it("formats Err results with non-Error values", () => {
      const result = err("string error");
      
      const info = {
        level: "error",
        message: "",
        result
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.zerothrow).toMatchObject({
        type: "Result",
        status: "err",
        error: {
          message: "string error"
        }
      });
      expect(transformed.formattedMessage).toBe("[ERR] Operation failed");
    });

    it("uses info.message for non-ZeroError errors", () => {
      const error = new Error("Generic error");
      const result = err(error);
      
      const info = {
        level: "error",
        message: "Custom error message",
        result
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.formattedMessage).toBe("[ERR] Custom error message");
    });

    it("formats Err results with ZeroError having symbol code", () => {
      const symbolCode = Symbol("SYMBOL_ERROR");
      const error = new ZeroError(symbolCode, "Symbol error test");
      const result = err(error);
      
      const info = {
        level: "error",
        message: "",
        result
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.zerothrow.error.code).toBe("Symbol(SYMBOL_ERROR)");
    });
  });

  describe("createWinstonLogger", () => {
    it("creates logger with zerothrow format", () => {
      const mockWinston = {
        format: {
          combine: vi.fn().mockReturnValue("combined"),
          timestamp: vi.fn().mockReturnValue("timestamp"),
          json: vi.fn().mockReturnValue("json")
        },
        createLogger: vi.fn().mockReturnValue("logger")
      };
      
      const logger = createWinstonLogger(mockWinston);
      
      expect(mockWinston.createLogger).toHaveBeenCalledWith({
        format: "combined"
      });
      expect(mockWinston.format.combine).toHaveBeenCalledWith(
        "timestamp",
        zerothrowWinstonFormat,
        "json"
      );
    });

    it("respects custom options and format", () => {
      const mockWinston = {
        format: {
          combine: vi.fn().mockReturnValue("combined"),
          timestamp: vi.fn().mockReturnValue("timestamp"),
          json: vi.fn().mockReturnValue("json"),
          simple: vi.fn().mockReturnValue("simple")
        },
        createLogger: vi.fn().mockReturnValue("logger")
      };
      
      const options = {
        level: "debug",
        format: "simple"
      };
      
      const logger = createWinstonLogger(mockWinston, options);
      
      expect(mockWinston.createLogger).toHaveBeenCalledWith({
        level: "debug",
        format: "combined"
      });
      expect(mockWinston.format.combine).toHaveBeenCalledWith(
        "timestamp",
        zerothrowWinstonFormat,
        "simple"
      );
    });
  });
});