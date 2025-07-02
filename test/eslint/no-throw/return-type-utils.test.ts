import { describe, it, expect } from 'vitest';
import { 
  findParentFunction, 
  hasReturnType 
} from '../../../src/eslint/no-throw/return-type-utils.js';
import { TSESTree } from '@typescript-eslint/utils';

describe('return-type-utils', () => {
  describe('findParentFunction', () => {
    it('finds immediate parent function declaration', () => {
      const throwNode = { type: 'ThrowStatement' } as TSESTree.ThrowStatement;
      const funcNode = { 
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'test' },
      } as TSESTree.FunctionDeclaration;
      
      throwNode.parent = funcNode;
      
      const result = findParentFunction(throwNode);
      expect(result).toBe(funcNode);
    });

    it('finds parent arrow function', () => {
      const throwNode = { type: 'ThrowStatement' } as TSESTree.ThrowStatement;
      const blockNode = { type: 'BlockStatement' } as TSESTree.BlockStatement;
      const arrowNode = { 
        type: 'ArrowFunctionExpression',
        params: [],
      } as TSESTree.ArrowFunctionExpression;
      
      throwNode.parent = blockNode;
      blockNode.parent = arrowNode;
      
      const result = findParentFunction(throwNode);
      expect(result).toBe(arrowNode);
    });

    it('finds function in method definition', () => {
      const throwNode = { type: 'ThrowStatement' } as TSESTree.ThrowStatement;
      const funcExpr = { 
        type: 'FunctionExpression',
        params: [],
      } as TSESTree.FunctionExpression;
      const methodDef = {
        type: 'MethodDefinition',
        value: funcExpr,
      } as TSESTree.MethodDefinition;
      
      throwNode.parent = funcExpr;
      funcExpr.parent = methodDef;
      
      const result = findParentFunction(throwNode);
      expect(result).toBe(funcExpr);
    });

    it('returns null when no parent function', () => {
      const throwNode = { type: 'ThrowStatement' } as TSESTree.ThrowStatement;
      const programNode = { type: 'Program' } as TSESTree.Program;
      
      throwNode.parent = programNode;
      
      const result = findParentFunction(throwNode);
      expect(result).toBe(null);
    });

    it('finds function through multiple parent levels', () => {
      const throwNode = { type: 'ThrowStatement' } as TSESTree.ThrowStatement;
      const ifNode = { type: 'IfStatement' } as TSESTree.IfStatement;
      const blockNode = { type: 'BlockStatement' } as TSESTree.BlockStatement;
      const funcNode = { 
        type: 'FunctionDeclaration',
      } as TSESTree.FunctionDeclaration;
      
      throwNode.parent = ifNode;
      ifNode.parent = blockNode;
      blockNode.parent = funcNode;
      
      const result = findParentFunction(throwNode);
      expect(result).toBe(funcNode);
    });
  });

  describe('hasReturnType', () => {
    it('returns true when returnType exists', () => {
      const func = {
        type: 'FunctionDeclaration',
        returnType: { type: 'TSTypeAnnotation' },
      } as any;
      
      expect(hasReturnType(func)).toBe(true);
    });

    it('returns false when returnType is undefined', () => {
      const func = {
        type: 'FunctionDeclaration',
        returnType: undefined,
      } as any;
      
      expect(hasReturnType(func)).toBe(false);
    });

    it('returns false when returnType property missing', () => {
      const func = {
        type: 'ArrowFunctionExpression',
      } as any;
      
      expect(hasReturnType(func)).toBe(false);
    });
  });
});