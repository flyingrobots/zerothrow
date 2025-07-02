import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorFormatter, createErrorFormatter } from "../src/dev/error-formatter";
import { ZeroError } from "../src/error";
import { ok, err } from "../src/result";

describe("ErrorFormatter", () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe("formatZeroError", () => {
    it("formats error with colors when enabled", () => {
      const formatter = new ErrorFormatter({ colors: true });
      const error = new ZeroError("API_ERROR", "Request failed", {
        context: { endpoint: "/api/users", statusCode: 404 }
      });
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).toContain("\x1b[31m"); // red color
      expect(formatted).toContain("[API_ERROR]");
      expect(formatted).toContain("Request failed");
      expect(formatted).toContain("Context:");
      expect(formatted).toContain('"endpoint": "/api/users"');
      expect(formatted).toContain('"statusCode": 404');
    });

    it("formats error without colors when disabled", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZeroError("API_ERROR", "Request failed");
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).not.toContain("\x1b[31m");
      expect(formatted).toContain("[API_ERROR] Request failed");
    });

    it("handles symbol error codes", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const symbolCode = Symbol("CUSTOM_ERROR");
      const error = new ZeroError(symbolCode, "Custom error");
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).toContain("[Symbol(CUSTOM_ERROR)] Custom error");
    });

    it("includes statusCode from context", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZeroError("HTTP_ERROR", "Not found", {
        context: { statusCode: 404, path: "/users/123" }
      });
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).toContain("Status Code: 404");
    });

    it("respects stackTrace option", () => {
      const formatter = new ErrorFormatter({ colors: false, stackTrace: false });
      const error = new ZeroError("TEST_ERROR", "Test message");
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).not.toContain("Stack Trace:");
      expect(formatted).not.toContain("at ");
    });

    it("respects details option", () => {
      const formatter = new ErrorFormatter({ colors: false, details: false });
      const error = new ZeroError("TEST_ERROR", "Test message", {
        context: { data: "should not appear" }
      });
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).not.toContain("Context:");
      expect(formatted).not.toContain("should not appear");
    });

    it("respects timestamp option", () => {
      const formatter = new ErrorFormatter({ colors: false, timestamp: false });
      const error = new ZeroError("TEST_ERROR", "Test message");
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).not.toContain("Timestamp:");
    });
  });

  describe("formatResult", () => {
    it("formats Ok result", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const result = ok({ id: 1 });
      
      const formatted = formatter.formatResult(result);
      
      expect(formatted).toBe("✓ Success");
    });

    it("formats Ok result with colors", () => {
      const formatter = new ErrorFormatter({ colors: true });
      const result = ok({ id: 1 });
      
      const formatted = formatter.formatResult(result);
      
      expect(formatted).toContain("\x1b[32m"); // green color
      expect(formatted).toContain("✓ Success");
    });

    it("formats Err result with ZeroError", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZeroError("VALIDATION_ERROR", "Invalid input");
      const result = err(error);
      
      const formatted = formatter.formatResult(result);
      
      expect(formatted).toContain("[VALIDATION_ERROR] Invalid input");
    });

    it("formats Err result with regular Error", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new Error("Generic error");
      const result = err(error);
      
      const formatted = formatter.formatResult(result);
      
      expect(formatted).toBe("✗ Error: Generic error");
    });
  });

  describe("console helpers", () => {
    it("logError logs formatted error to console.error", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZeroError("TEST_ERROR", "Test message");
      
      formatter.logError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("[TEST_ERROR] Test message"));
    });

    it("logResult logs formatted result to console.log", () => {
      const formatter = new ErrorFormatter({ colors: false });
      const result = ok("success");
      
      formatter.logResult(result);
      
      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Success");
    });
  });

  describe("createErrorFormatter", () => {
    it("creates formatter with custom options", () => {
      const formatter = createErrorFormatter({
        colors: false,
        stackTrace: false,
        details: false,
        timestamp: false
      });
      
      const error = new ZeroError("TEST", "Test", {
        context: { data: "test" }
      });
      
      const formatted = formatter.formatZeroError(error);
      
      expect(formatted).toBe("[TEST] Test");
    });
  });
});