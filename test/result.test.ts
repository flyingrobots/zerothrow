
import { describe, it, expect } from "vitest";
import { ok, err, tryR, wrap, ZeroError } from "../src";

describe("Result helpers", () => {
  it("ok()", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });
  it("err()", () => {
    const e = new Error("boom");
    expect(err(e)).toEqual({ ok: false, error: e });
  });
  it("tryR success", async () => {
    const r = await tryR(() => 1);
    expect(r.ok).toBe(true);
  });
  it("tryR failure", async () => {
    const r = await tryR(() => { throw new Error("bad"); });
    expect(r.ok).toBe(false);
  });
});

describe("wrap function", () => {
  it("wraps an error with code and message", () => {
    const cause = new Error("original error");
    const wrapped = wrap(cause, "DB_ERR", "Database connection failed");
    
    expect(wrapped).toBeInstanceOf(ZeroError);
    expect(wrapped.code).toBe("DB_ERR");
    expect(wrapped.message).toBe("Database connection failed");
    expect(wrapped.cause).toBe(cause);
  });

  it("wraps an error with context", () => {
    const cause = new Error("original error");
    const context = { userId: "123", operation: "fetch" };
    const wrapped = wrap(cause, "USER_ERR", "User operation failed", context);
    
    expect(wrapped.context).toEqual(context);
  });

  it("uses cause's message when msg not provided", () => {
    const cause = new Error("original error message");
    const wrapped = wrap(cause, "DB_ERR");
    
    expect(wrapped.message).toBe("original error message");
    expect(wrapped.code).toBe("DB_ERR");
    expect(wrapped.cause).toBe(cause);
  });

  it("extracts code and message from ZeroError cause", () => {
    const cause = new ZeroError("ORIGINAL_CODE", "original message");
    const wrapped = wrap(cause);
    
    expect(wrapped.code).toBe("ORIGINAL_CODE");
    expect(wrapped.message).toBe("original message");
    expect(wrapped.cause).toBe(cause);
  });

  it("uses WRAPPED_ERROR code for regular errors when code not provided", () => {
    const cause = new Error("some error");
    const wrapped = wrap(cause);
    
    expect(wrapped.code).toBe("WRAPPED_ERROR");
    expect(wrapped.message).toBe("some error");
    expect(wrapped.cause).toBe(cause);
  });

  it("preserves stack trace through cause chain", () => {
    const cause = new Error("original error");
    const wrapped = wrap(cause, "WRAP_CODE", "wrapped message");
    
    expect(wrapped.cause).toBe(cause);
    expect(wrapped.stack).toContain("wrap");
    // The original error's stack is preserved via the cause chain
    expect(cause.stack).toBeDefined();
  });

  it("displays full error chain with toString()", () => {
    const originalError = new Error("database connection timeout");
    const dbError = wrap(originalError, "DB_ERROR", "Failed to fetch user", { userId: 123 });
    const apiError = wrap(dbError, "API_ERROR", "User endpoint failed", { endpoint: "/api/user/123" });
    
    const str = apiError.toString();
    
    // Check top-level error
    expect(str).toContain("ZeroError [API_ERROR]: User endpoint failed");
    expect(str).toContain('"endpoint": "/api/user/123"');
    
    // Check middle error
    expect(str).toContain("Caused by: ZeroError: Failed to fetch user");
    expect(str).toContain('"userId": 123');
    
    // Check original error
    expect(str).toContain("Caused by: Error: database connection timeout");
  });

  it("getFullStack includes all stack traces", () => {
    const originalError = new Error("original");
    const wrapped = wrap(originalError, "WRAPPED", "wrapped error");
    
    const fullStack = wrapped.getFullStack();
    
    expect(fullStack).toContain("wrapped error");
    expect(fullStack).toContain("Caused by:");
    expect(fullStack).toContain("original");
  });
});

describe("tryR advanced cases", () => {
  it("handles sync functions", async () => {
    const r = await tryR(() => "sync result");
    expect(r).toEqual({ ok: true, value: "sync result" });
  });

  it("applies map function on error", async () => {
    const r = await tryR(
      () => { throw new Error("original"); },
      (e) => new ZeroError("MAPPED_ERR", "Mapped error", { cause: e })
    );
    
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("MAPPED_ERR");
      expect(r.error.message).toBe("Mapped error");
    }
  });

  it("normalizes non-Error throws to ZeroError", async () => {
    // eslint-disable-next-line no-throw-literal
    const r = await tryR(() => { throw "string error"; });
    
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBeInstanceOf(ZeroError);
      expect(r.error.code).toBe("UNKNOWN_ERR");
      expect(r.error.message).toBe("string error");
    }
  });

  it("preserves ZeroError instances", async () => {
    const originalError = new ZeroError("CUSTOM_ERR", "Custom error");
    const r = await tryR(() => { throw originalError; });
    
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(originalError);
    }
  });

  it("handles null and undefined throws", async () => {
    // eslint-disable-next-line no-throw-literal
    const r1 = await tryR(() => { throw null; });
    // eslint-disable-next-line no-throw-literal
    const r2 = await tryR(() => { throw undefined; });
    
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r1.ok) expect(r1.error.message).toBe("null");
    if (!r2.ok) expect(r2.error.message).toBe("undefined");
  });
});
