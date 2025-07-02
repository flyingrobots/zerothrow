import { ESLintUtils, TSESTree, TSESLint } from '@typescript-eslint/utils';

// Helper to derive error code from error message
// Note: This returns string error codes only. While ZeroError supports
// string | number | symbol, the ESLint autofix generates string codes.
function deriveErrorCode(message: string): string {
  // Common patterns to derive error codes
  const patterns = [
    { regex: /not found/i, code: 'NOT_FOUND' },
    { regex: /unauthorized|not authorized/i, code: 'UNAUTHORIZED' },
    { regex: /forbidden|access denied/i, code: 'FORBIDDEN' },
    { regex: /invalid|validation/i, code: 'VALIDATION_ERROR' },
    { regex: /timeout|timed out/i, code: 'TIMEOUT' },
    { regex: /network|connection/i, code: 'NETWORK_ERROR' },
    { regex: /database|db/i, code: 'DATABASE_ERROR' },
    { regex: /conflict/i, code: 'CONFLICT' },
    { regex: /rate limit/i, code: 'RATE_LIMIT' },
    { regex: /not implemented/i, code: 'NOT_IMPLEMENTED' },
  ];
  
  for (const { regex, code } of patterns) {
    if (regex.test(message)) {
      return code;
    }
  }
  
  // If no pattern matches, return TODO placeholder
  return 'TODO_ERROR_CODE';
}

export const noThrowRule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow throw statements in favor of Result types'
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          allowInTests: {
            type: 'boolean',
            default: false,
          },
          allowedFiles: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noThrow: 'Use Result<T,E> instead of throw statements',
      suggestReturn: 'Return err() instead of throw',
      todoErrorCode: 'Replace TODO_ERROR_CODE with a meaningful error code',
    },
  },
  defaultOptions: [{ allowInTests: false, allowedFiles: [] }],
  create(context) {
    const options = context.options[0] || {};
    const filename = context.getFilename();
    
    // Check if file is allowed
    if (options.allowInTests && filename.includes('.test.')) {
      return {};
    }
    
    if (options.allowedFiles?.some((pattern: string) => filename.includes(pattern))) {
      return {};
    }

    return {
      // Check for TODO_ERROR_CODE in existing code
      Literal(node: TSESTree.Literal) {
        if (node.value === 'TODO_ERROR_CODE') {
          context.report({
            node,
            messageId: 'todoErrorCode',
          });
        }
      },
      
      ThrowStatement(node: TSESTree.ThrowStatement) {
        context.report({
          node,
          messageId: 'noThrow',
          fix(fixer: TSESLint.RuleFixer) {
            const fixes: TSESLint.RuleFix[] = [];
            
            // Check what imports we need
            const sourceCode = context.getSourceCode();
            const imports = sourceCode.ast.body.filter(
              (node): node is TSESTree.ImportDeclaration => node.type === 'ImportDeclaration'
            );
            
            const zerothrowImport = imports.find(imp => 
              imp.source.value === '@flyingrobots/zerothrow'
            );
            
            const hasErrImport = zerothrowImport?.specifiers.some(spec => 
              spec.type === 'ImportSpecifier' && spec.imported.name === 'err'
            ) ?? false;
            
            const hasZeroErrorImport = zerothrowImport?.specifiers.some(spec => 
              spec.type === 'ImportSpecifier' && spec.imported.name === 'ZeroError'
            ) ?? false;
            
            // If we're throwing a simple error, suggest a more specific approach
            const argument = node.argument;
            if (!argument) {
              return null; // Can't fix if there's no argument
            }
            const argumentText = sourceCode.getText(argument);
            
            // For new Error() calls, try to derive a better error code
            if (argument.type === 'NewExpression' && 
                argument.callee.type === 'Identifier' && 
                argument.callee.name === 'Error' &&
                argument.arguments.length >= 1 && 
                argument.arguments[0].type === 'Literal') {
              
              const message = String(argument.arguments[0].value);
              // Try to derive error code from message
              const errorCode = deriveErrorCode(message);
              
              // Add imports if needed
              if (!hasErrImport || !hasZeroErrorImport) {
                const missingImports = [];
                if (!hasErrImport) missingImports.push('err');
                if (!hasZeroErrorImport) missingImports.push('ZeroError');
                
                if (zerothrowImport) {
                  // Reconstruct the entire import statement to avoid syntax errors
                  const existingImports = zerothrowImport.specifiers
                    .filter((spec): spec is TSESTree.ImportSpecifier => spec.type === 'ImportSpecifier')
                    .map(spec => spec.imported.name);
                  
                  const allImports = [...existingImports, ...missingImports];
                  const newImportText = `import { ${allImports.join(', ')} } from '@flyingrobots/zerothrow';`;
                  
                  fixes.push(fixer.replaceText(zerothrowImport, newImportText));
                } else {
                  // Add new import at the top
                  const firstNode = sourceCode.ast.body[0];
                  fixes.push(fixer.insertTextBefore(
                    firstNode,
                    `import { ${missingImports.join(', ')} } from '@flyingrobots/zerothrow';\n`
                  ));
                }
              }
              
              // Replace the throw
              fixes.push(fixer.replaceText(
                node,
                `return err(new ZeroError('${errorCode}', ${JSON.stringify(message)}))`
              ));
              
              // Emit warning if TODO_ERROR_CODE is used
              if (errorCode === 'TODO_ERROR_CODE') {
                // Note: We can't emit additional diagnostics from a fixer,
                // but the comment documents this limitation
              }
              
              return fixes;
            }
            
            // For other throws, suggest wrapping in tryR at the function level
            // or returning err() with the thrown value
            if (!hasErrImport) {
              if (zerothrowImport) {
                // Reconstruct the entire import statement to avoid syntax errors
                const existingImports = zerothrowImport.specifiers
                  .filter((spec): spec is TSESTree.ImportSpecifier => spec.type === 'ImportSpecifier')
                  .map(spec => spec.imported.name);
                
                const allImports = [...existingImports, 'err'];
                const newImportText = `import { ${allImports.join(', ')} } from '@flyingrobots/zerothrow';`;
                
                fixes.push(fixer.replaceText(zerothrowImport, newImportText));
              } else {
                // Add new import at the top
                const firstNode = sourceCode.ast.body[0];
                fixes.push(fixer.insertTextBefore(
                  firstNode,
                  `import { err } from '@flyingrobots/zerothrow';\n`
                ));
              }
            }
            
            fixes.push(fixer.replaceText(
              node,
              `return err(${argumentText})`
            ));
            
            return fixes;
          },
        });
      },
    };
  },
});