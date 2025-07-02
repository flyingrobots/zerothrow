import { describe, it, expect } from 'vitest';
import { 
  isNewErrorCall, 
  extractErrorMessage, 
  buildFixes 
} from '../../../src/eslint/no-throw/fix-builder.js';
import { TSESTree } from '@typescript-eslint/utils';

describe('fix-builder', () => {
  describe('isNewErrorCall', () => {
    it('identifies new Error() calls', () => {
      const newError: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: 'Error' },
        arguments: [],
      } as TSESTree.NewExpression;
      
      expect(isNewErrorCall(newError)).toBe(true);
    });

    it('returns false for non-Error constructors', () => {
      const newCustom: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: 'CustomError' },
        arguments: [],
      } as TSESTree.NewExpression;
      
      expect(isNewErrorCall(newCustom)).toBe(false);
    });

    it('returns false for non-new expressions', () => {
      const literal: TSESTree.Literal = {
        type: 'Literal',
        value: 'error',
      } as TSESTree.Literal;
      
      expect(isNewErrorCall(literal)).toBe(false);
    });

    it('returns false for member expression callee', () => {
      const memberError: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { 
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'global' },
          property: { type: 'Identifier', name: 'Error' },
        },
        arguments: [],
      } as TSESTree.NewExpression;
      
      expect(isNewErrorCall(memberError)).toBe(false);
    });
  });

  describe('extractErrorMessage', () => {
    it('extracts string literal message', () => {
      const errorCall: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: 'Error' },
        arguments: [
          { type: 'Literal', value: 'Test error' } as TSESTree.Literal
        ],
      } as TSESTree.NewExpression;
      
      expect(extractErrorMessage(errorCall)).toBe('Test error');
    });

    it('returns null for non-literal argument', () => {
      const errorCall: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: 'Error' },
        arguments: [
          { type: 'Identifier', name: 'message' } as TSESTree.Identifier
        ],
      } as TSESTree.NewExpression;
      
      expect(extractErrorMessage(errorCall)).toBe(null);
    });

    it('returns null for no arguments', () => {
      const errorCall: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: 'Error' },
        arguments: [],
      } as TSESTree.NewExpression;
      
      expect(extractErrorMessage(errorCall)).toBe(null);
    });

    it('returns null for non-string literal', () => {
      const errorCall: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: 'Error' },
        arguments: [
          { type: 'Literal', value: 42 } as TSESTree.Literal
        ],
      } as TSESTree.NewExpression;
      
      expect(extractErrorMessage(errorCall)).toBe(null);
    });

    it('returns null for template literal', () => {
      const errorCall: TSESTree.NewExpression = {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: 'Error' },
        arguments: [
          { 
            type: 'TemplateLiteral',
            quasis: [],
            expressions: [],
          } as TSESTree.TemplateLiteral
        ],
      } as TSESTree.NewExpression;
      
      expect(extractErrorMessage(errorCall)).toBe(null);
    });
  });
});