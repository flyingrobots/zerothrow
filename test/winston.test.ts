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
      expect(transformed.message).toBe("[DATABASE_ERROR] Connection failed");
      expect(transformed.timestamp).toBeDefined();
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
      expect(transformed.message).toBe("[Symbol(CUSTOM_ERROR)] Custom error");
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
      expect(transformed.message).toBe("[OK] Operation completed");
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
      expect(transformed.message).toBe("[ERR] Invalid credentials");
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
      expect(transformed.message).toBe("[ERR] Something went wrong");
    });

    it("adds timestamp if not present", () => {
      const info = {
        level: "info",
        message: "Test message"
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.timestamp).toBeDefined();
      expect(new Date(transformed.timestamp)).toBeInstanceOf(Date);
    });

    it("preserves existing timestamp", () => {
      const existingTimestamp = "2025-01-01T00:00:00.000Z";
      const info = {
        level: "info",
        message: "Test message",
        timestamp: existingTimestamp
      };
      
      const transformed = zerothrowWinstonFormat.transform(info);
      
      expect(transformed.timestamp).toBe(existingTimestamp);
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