import { describe, it, expect } from 'vitest';
import { analyzeImports, buildImportText } from '../../../src/eslint/no-throw/import-utils.js';
import { TSESTree } from '@typescript-eslint/utils';

describe('import-utils', () => {
  describe('analyzeImports', () => {
    it('identifies zerothrow imports correctly', () => {
      const imports: TSESTree.ImportDeclaration[] = [
        {
          type: 'ImportDeclaration',
          source: { type: 'Literal', value: '@zerothrow/zerothrow' },
          specifiers: [
            {
              type: 'ImportSpecifier',
              imported: { type: 'Identifier', name: 'err' },
              local: { type: 'Identifier', name: 'err' },
            },
            {
              type: 'ImportSpecifier',
              imported: { type: 'Identifier', name: 'ok' },
              local: { type: 'Identifier', name: 'ok' },
            },
          ],
        } as TSESTree.ImportDeclaration,
      ];

      const result = analyzeImports(imports);
      expect(result.hasErrImport).toBe(true);
      expect(result.hasZeroErrorImport).toBe(false);
      expect(result.hasResultImport).toBe(false);
      expect(result.zerothrowImport).toBeDefined();
    });

    it('handles no zerothrow imports', () => {
      const imports: TSESTree.ImportDeclaration[] = [
        {
          type: 'ImportDeclaration',
          source: { type: 'Literal', value: 'react' },
          specifiers: [],
        } as TSESTree.ImportDeclaration,
      ];

      const result = analyzeImports(imports);
      expect(result.hasErrImport).toBe(false);
      expect(result.hasZeroErrorImport).toBe(false);
      expect(result.hasResultImport).toBe(false);
      expect(result.zerothrowImport).toBeUndefined();
    });

    it('identifies all zerothrow imports', () => {
      const imports: TSESTree.ImportDeclaration[] = [
        {
          type: 'ImportDeclaration',
          source: { type: 'Literal', value: '@zerothrow/zerothrow' },
          specifiers: [
            {
              type: 'ImportSpecifier',
              imported: { type: 'Identifier', name: 'err' },
              local: { type: 'Identifier', name: 'err' },
            },
            {
              type: 'ImportSpecifier',
              imported: { type: 'Identifier', name: 'ZeroError' },
              local: { type: 'Identifier', name: 'ZeroError' },
            },
            {
              type: 'ImportSpecifier',
              imported: { type: 'Identifier', name: 'Result' },
              local: { type: 'Identifier', name: 'Result' },
            },
          ],
        } as TSESTree.ImportDeclaration,
      ];

      const result = analyzeImports(imports);
      expect(result.hasErrImport).toBe(true);
      expect(result.hasZeroErrorImport).toBe(true);
      expect(result.hasResultImport).toBe(true);
    });
  });

  describe('buildImportText', () => {
    it('creates new import when none exists', () => {
      const result = buildImportText(undefined, ['err', 'Result']);
      expect(result).toBe(`import { err, Result } from '@zerothrow/zerothrow';`);
    });

    it('preserves aliases in existing imports', () => {
      const existingImport: TSESTree.ImportDeclaration = {
        type: 'ImportDeclaration',
        source: { type: 'Literal', value: '@zerothrow/zerothrow' },
        specifiers: [
          {
            type: 'ImportSpecifier',
            imported: { type: 'Identifier', name: 'ok' },
            local: { type: 'Identifier', name: 'success' },
          },
        ],
      } as TSESTree.ImportDeclaration;

      const result = buildImportText(existingImport, ['err']);
      expect(result).toBe(`import { ok as success, err } from '@zerothrow/zerothrow';`);
    });

    it('deduplicates imports', () => {
      const existingImport: TSESTree.ImportDeclaration = {
        type: 'ImportDeclaration',
        source: { type: 'Literal', value: '@zerothrow/zerothrow' },
        specifiers: [
          {
            type: 'ImportSpecifier',
            imported: { type: 'Identifier', name: 'err' },
            local: { type: 'Identifier', name: 'err' },
          },
        ],
      } as TSESTree.ImportDeclaration;

      const result = buildImportText(existingImport, ['err', 'Result']);
      expect(result).toBe(`import { err, Result } from '@zerothrow/zerothrow';`);
    });

    it('handles multiple aliases correctly', () => {
      const existingImport: TSESTree.ImportDeclaration = {
        type: 'ImportDeclaration',
        source: { type: 'Literal', value: '@zerothrow/zerothrow' },
        specifiers: [
          {
            type: 'ImportSpecifier',
            imported: { type: 'Identifier', name: 'ok' },
            local: { type: 'Identifier', name: 'good' },
          },
          {
            type: 'ImportSpecifier',
            imported: { type: 'Identifier', name: 'err' },
            local: { type: 'Identifier', name: 'bad' },
          },
        ],
      } as TSESTree.ImportDeclaration;

      const result = buildImportText(existingImport, ['Result']);
      expect(result).toBe(`import { ok as good, err as bad, Result } from '@zerothrow/zerothrow';`);
    });
  });
});