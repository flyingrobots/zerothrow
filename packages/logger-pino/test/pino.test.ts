import { describe, it, expect } from 'vitest';
import {
  zerothrowPinoSerializers,
  createPinoConfig,
  createPinoLogger,
} from '../src/loggers/pino.js';
import { ZT, ZeroThrow } from '../src/index.js';

describe('Pino serializers', () => {
  describe('err serializer', () => {
    it('serializes ZeroError instances', () => {
      const error = new ZeroThrow.ZeroError('USER_NOT_FOUND', 'User does not exist', {
        context: { userId: 123 },
      });

      const serialized = zerothrowPinoSerializers.err!(error);

      expect(serialized).toMatchObject({
        type: 'ZeroError',
        code: 'USER_NOT_FOUND',
        message: 'User does not exist',
        context: { userId: 123 },
      });
      // Stack is only included in debug mode
      if (
        process.env.LOG_LEVEL === 'debug' ||
        process.env.LOG_STACK === 'true'
      ) {
        expect(serialized.stack).toBeDefined();
      }
    });

    it('handles symbol error codes', () => {
      const symbolCode = Symbol('CUSTOM_ERROR');
      const error = new ZeroThrow.ZeroError(symbolCode, 'Custom error');

      const serialized = zerothrowPinoSerializers.err!(error);

      expect(serialized.code).toBe('Symbol(CUSTOM_ERROR)');
    });

    it('serializes regular Error instances', () => {
      const error = new Error('Standard error');

      const serialized = zerothrowPinoSerializers.err!(error);

      expect(serialized).toMatchObject({
        type: 'Error',
        message: 'Standard error',
      });
      // Stack is only included in debug mode
      if (
        process.env.LOG_LEVEL === 'debug' ||
        process.env.LOG_STACK === 'true'
      ) {
        expect(serialized.stack).toBeDefined();
      }
    });

    it('handles non-Error types', () => {
      const serialized1 = zerothrowPinoSerializers.err!('string error');
      expect(serialized1).toEqual({
        type: 'Unknown',
        message: 'string error',
      });

      const serialized2 = zerothrowPinoSerializers.err!(123);
      expect(serialized2).toEqual({
        type: 'Unknown',
        message: '123',
      });

      const serialized3 = zerothrowPinoSerializers.err!(null);
      expect(serialized3).toEqual({
        type: 'Unknown',
        message: 'null',
      });
    });
  });

  describe('result serializer', () => {
    it('serializes Ok results', () => {
      const result = ZT.ok({ id: 1, name: 'Test' });

      const serialized = zerothrowPinoSerializers.result!(result);

      expect(serialized).toMatchObject({
        type: 'Result',
        status: 'ok',
        value: { id: 1, name: 'Test' },
      });
    });

    it('serializes Err results with ZeroError', () => {
      const error = new ZeroThrow.ZeroError('VALIDATION_FAILED', 'Invalid input');
      const result = ZT.err(error);

      const serialized = zerothrowPinoSerializers.result!(result);

      expect(serialized).toMatchObject({
        type: 'Result',
        status: 'err',
        error: {
          type: 'ZeroError',
          code: 'VALIDATION_FAILED',
          message: 'Invalid input',
        },
      });
    });

    it('returns non-Result values as-is', () => {
      const nonResult = { foo: 'bar' };

      const serialized = zerothrowPinoSerializers.result!(nonResult);

      expect(serialized).toEqual(nonResult);
    });
  });

  describe('err serializer with debug mode', () => {
    it('includes stack trace when LOG_LEVEL is debug', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';

      try {
        const error = new ZeroThrow.ZeroError('DEBUG_ERROR', 'Debug test');
        const serialized = zerothrowPinoSerializers.err!(error);

        expect(serialized.stack).toBeDefined();
        expect(serialized.stack).toContain('Debug test');
      } finally {
        if (originalLogLevel === undefined) {
          delete process.env.LOG_LEVEL;
        } else {
          process.env.LOG_LEVEL = originalLogLevel;
        }
      }
    });

    it('includes stack trace when LOG_STACK is true', () => {
      const originalLogStack = process.env.LOG_STACK;
      process.env.LOG_STACK = 'true';

      try {
        const error = new Error('Stack test');
        const serialized = zerothrowPinoSerializers.err!(error);

        expect(serialized.stack).toBeDefined();
        expect(serialized.stack).toContain('Stack test');
      } finally {
        if (originalLogStack === undefined) {
          delete process.env.LOG_STACK;
        } else {
          process.env.LOG_STACK = originalLogStack;
        }
      }
    });
  });

  describe('createPinoConfig', () => {
    it('merges serializers with existing options', () => {
      const options = {
        level: 'info',
        serializers: {
          custom: (val: any) => val.toString(),
        },
      };

      const config = createPinoConfig(options);

      expect(config).toMatchObject({
        level: 'info',
        serializers: {
          custom: expect.any(Function),
          err: expect.any(Function),
          result: expect.any(Function),
        },
      });
    });

    it('works with no options', () => {
      const config = createPinoConfig();

      expect(config.serializers).toBeDefined();
      expect(config.serializers.err).toBe(zerothrowPinoSerializers.err);
      expect(config.serializers.result).toBe(zerothrowPinoSerializers.result);
    });

    it('createPinoLogger is alias for backward compatibility', () => {
      expect(createPinoLogger).toBe(createPinoConfig);
    });
  });
});
