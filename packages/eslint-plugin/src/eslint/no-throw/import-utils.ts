import { TSESTree, TSESLint } from '@typescript-eslint/utils';

export interface ImportInfo {
  hasErrImport: boolean;
  hasZeroErrorImport: boolean;
  hasResultImport: boolean;
  zerothrowImport: TSESTree.ImportDeclaration | undefined;
}

/**
 * Analyzes existing imports to determine what's already imported from zerothrow
 */
export function analyzeImports(
  imports: TSESTree.ImportDeclaration[]
): ImportInfo {
  const zerothrowImport = imports.find(
    (imp) => imp.source.value === '@zerothrow/zerothrow'
  );

  const hasErrImport =
    zerothrowImport?.specifiers.some(
      (spec) => spec.type === 'ImportSpecifier' && 
        (spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value) === 'err'
    ) ?? false;

  const hasZeroErrorImport =
    zerothrowImport?.specifiers.some(
      (spec) =>
        spec.type === 'ImportSpecifier' && 
        (spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value) === 'ZeroError'
    ) ?? false;

  const hasResultImport =
    zerothrowImport?.specifiers.some(
      (spec) =>
        spec.type === 'ImportSpecifier' && 
        (spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value) === 'Result'
    ) ?? false;

  return {
    hasErrImport,
    hasZeroErrorImport,
    hasResultImport,
    zerothrowImport,
  };
}

/**
 * Builds the import text preserving aliases
 */
export function buildImportText(
  zerothrowImport: TSESTree.ImportDeclaration | undefined,
  neededImports: string[]
): string {
  if (!zerothrowImport) {
    return `import { ${neededImports.join(', ')} } from '@zerothrow/zerothrow';`;
  }

  const existingImports = zerothrowImport.specifiers
    .filter(
      (spec): spec is TSESTree.ImportSpecifier =>
        spec.type === 'ImportSpecifier'
    )
    .map((spec) => {
      const importedName = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
      if (spec.local && spec.local.name !== importedName) {
        return `${importedName} as ${spec.local.name}`;
      }
      return importedName;
    });

  const allImports = Array.from(
    new Set([...existingImports, ...neededImports])
  );
  return `import { ${allImports.join(', ')} } from '@zerothrow/zerothrow';`;
}

/**
 * Creates import fixes based on what's needed
 */
export function createImportFixes(
  fixer: TSESLint.RuleFixer,
  importInfo: ImportInfo,
  neededImports: string[],
  sourceCode: TSESLint.SourceCode
): TSESLint.RuleFix[] {
  const fixes: TSESLint.RuleFix[] = [];

  if (neededImports.length === 0) {
    return fixes;
  }

  const importText = buildImportText(importInfo.zerothrowImport, neededImports);

  if (importInfo.zerothrowImport) {
    fixes.push(fixer.replaceText(importInfo.zerothrowImport, importText));
  } else {
    const firstNode = sourceCode.ast.body[0];
    if (firstNode) {
      fixes.push(fixer.insertTextBefore(firstNode, `${importText}\n`));
    }
  }

  return fixes;
}
