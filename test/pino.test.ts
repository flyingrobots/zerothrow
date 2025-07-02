import { describe, it, expect } from "vitest";
import { zerothrowPinoSerializers, createPinoConfig, createPinoLogger } from "../src/loggers/pino";
import { ZeroError } from "../src/error";
import { ok, err } from "../src/result";

describe("Pino serializers", () => {
  describe("err serializer", () => {
    it("serializes ZeroError instances", () => {
      const error = new ZeroError("USER_NOT_FOUND", "User does not exist", {
        context: { userId: 123 }
      });
      
      const serialized = zerothrowPinoSerializers.err!(error);
      
      expect(serialized).toMatchObject({
        type: "ZeroError",
        code: "USER_NOT_FOUND",
        message: "User does not exist",
        context: { userId: 123 },
        timestamp: expect.any(String)
      });
      expect(serialized.stack).toBeDefined();
    });

    it("handles symbol error codes", () => {
      const symbolCode = Symbol("CUSTOM_ERROR");
      const error = new ZeroError(symbolCode, "Custom error");
      
      const serialized = zerothrowPinoSerializers.err!(error);
      
      expect(serialized.code).toBe("Symbol(CUSTOM_ERROR)");
    });

    it("serializes regular Error instances", () => {
      const error = new Error("Standard error");
      
      const serialized = zerothrowPinoSerializers.err!(error);
      
      expect(serialized).toMatchObject({
        type: "Error",
        message: "Standard error",
        timestamp: expect.any(String)
      });
      expect(serialized.stack).toBeDefined();
    });
  });

  describe("result serializer", () => {
    it("serializes Ok results", () => {
      const result = ok({ id: 1, name: "Test" });
      
      const serialized = zerothrowPinoSerializers.result!(result);
      
      expect(serialized).toMatchObject({
        type: "Result",
        status: "ok",
        value: { id: 1, name: "Test" },
        timestamp: expect.any(String)
      });
    });

    it("serializes Err results with ZeroError", () => {
      const error = new ZeroError("VALIDATION_FAILED", "Invalid input");
      const result = err(error);
      
      const serialized = zerothrowPinoSerializers.result!(result);
      
      expect(serialized).toMatchObject({
        type: "Result",
        status: "err",
        error: {
          type: "ZeroError",
          code: "VALIDATION_FAILED",
          message: "Invalid input",
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it("returns non-Result values as-is", () => {
      const nonResult = { foo: "bar" };
      
      const serialized = zerothrowPinoSerializers.result!(nonResult);
      
      expect(serialized).toEqual(nonResult);
    });
  });

  describe("createPinoConfig", () => {
    it("merges serializers with existing options", () => {
      const options = {
        level: "info",
        serializers: {
          custom: (val: any) => val.toString()
        }
      };
      
      const config = createPinoConfig(options);
      
      expect(config).toMatchObject({
        level: "info",
        serializers: {
          custom: expect.any(Function),
          err: expect.any(Function),
          result: expect.any(Function)
        }
      });
    });

    it("works with no options", () => {
      const config = createPinoConfig();
      
      expect(config.serializers).toBeDefined();
      expect(config.serializers.err).toBe(zerothrowPinoSerializers.err);
      expect(config.serializers.result).toBe(zerothrowPinoSerializers.result);
    });
    
    it("createPinoLogger is alias for backward compatibility", () => {
      expect(createPinoLogger).toBe(createPinoConfig);
    });
  });
});