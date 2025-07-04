import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { deriveErrorCode } from './derive-error-code.js';
import { analyzeImports, createImportFixes } from './import-utils.js';
import {
  findParentFunction,
  createReturnTypeFixes,
} from './return-type-utils.js';

export interface FixContext {
  node: TSESTree.ThrowStatement;
  fixer: TSESLint.RuleFixer;
  sourceCode: TSESLint.SourceCode;
}

/**
 * Checks if the thrown expression is a new Error() call
 */
export function isNewErrorCall(
  argument: TSESTree.Expression
): argument is TSESTree.NewExpression {
  return (
    argument.type === 'NewExpression' &&
    argument.callee.type === 'Identifier' &&
    argument.callee.name === 'Error'
  );
}

/**
 * Extracts the error message from a new Error() call if it's a literal
 */
export function extractErrorMessage(
  errorCall: TSESTree.NewExpression
): string | null {
  if (
    errorCall.arguments.length >= 1 &&
    errorCall.arguments[0].type === 'Literal' &&
    typeof errorCall.arguments[0].value === 'string'
  ) {
    return errorCall.arguments[0].value;
  }
  return null;
}

/**
 * Builds all fixes for a throw statement
 */
export function buildFixes(ctx: FixContext): TSESLint.RuleFix[] | null {
  const { node, fixer, sourceCode } = ctx;
  const fixes: TSESLint.RuleFix[] = [];

  if (!node.argument) {
    return null; // Can't fix throw without argument
  }

  const argumentText = sourceCode.getText(node.argument);
  const imports = sourceCode.ast.body.filter(
    (node): node is TSESTree.ImportDeclaration =>
      node.type === 'ImportDeclaration'
  );

  const importInfo = analyzeImports(imports);
  let replacement: string;
  const neededImports: string[] = [];

  // Handle new Error() specially
  if (isNewErrorCall(node.argument)) {
    const message = extractErrorMessage(node.argument);
    if (message) {
      const errorCode = deriveErrorCode(message);
      replacement = `return err(new ZeroError('${errorCode}', ${JSON.stringify(message)}))`;

      if (!importInfo.hasErrImport) neededImports.push('err');
      if (!importInfo.hasZeroErrorImport) neededImports.push('ZeroError');
    } else {
      // new Error() with non-literal message
      replacement = `return err(${argumentText})`;
      if (!importInfo.hasErrImport) neededImports.push('err');
    }
  } else {
    // Non-Error throws
    replacement = `return err(${argumentText})`;
    if (!importInfo.hasErrImport) neededImports.push('err');
  }

  // Add import fixes
  const importFixes = createImportFixes(
    fixer,
    importInfo,
    neededImports,
    sourceCode
  );
  fixes.push(...importFixes);

  // Replace throw with return err(...)
  fixes.push(fixer.replaceText(node, replacement));

  // Add Result return type if needed
  const parentFunc = findParentFunction(node);
  if (parentFunc) {
    const isZeroError =
      isNewErrorCall(node.argument) &&
      extractErrorMessage(node.argument) !== null;

    // Check if we need Result import
    if (!importInfo.hasResultImport) {
      const updatedNeededImports = [...neededImports];
      if (!updatedNeededImports.includes('Result')) {
        updatedNeededImports.push('Result');
      }

      // Update or add new import fix
      const existingImportFixIndex = fixes.findIndex(
        (fix) =>
          fix.range &&
          importInfo.zerothrowImport?.range &&
          fix.range[0] === importInfo.zerothrowImport.range[0] &&
          fix.range[1] === importInfo.zerothrowImport.range[1]
      );

      if (existingImportFixIndex >= 0) {
        // Replace the existing import fix
        fixes.splice(existingImportFixIndex, 1);
        const updatedImportFixes = createImportFixes(
          fixer,
          importInfo,
          updatedNeededImports,
          sourceCode
        );
        fixes.push(...updatedImportFixes);
      } else {
        // Check if we're adding a new import
        const insertFixIndex = fixes.findIndex(
          (fix) => fix.text && fix.text.includes('import {')
        );

        if (insertFixIndex >= 0) {
          // Replace the insert fix
          fixes.splice(insertFixIndex, 1);
          const updatedImportFixes = createImportFixes(
            fixer,
            { ...importInfo, zerothrowImport: undefined },
            updatedNeededImports,
            sourceCode
          );
          fixes.push(...updatedImportFixes);
        }
      }
    }

    const returnTypeFixes = createReturnTypeFixes(
      fixer,
      parentFunc,
      sourceCode,
      isZeroError
    );
    fixes.push(...returnTypeFixes);
  }

  return fixes;
}
