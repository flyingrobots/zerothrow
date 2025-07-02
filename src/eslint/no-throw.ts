import { ESLintUtils, TSESTree, TSESLint } from '@typescript-eslint/utils';

// Helper to derive error code from error message
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
    },
  },
  defaultOptions: [{ allowInTests: false, allowedFiles: [] }],
  create(context: any) {
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
      ThrowStatement(node: TSESTree.ThrowStatement) {
        context.report({
          node,
          messageId: 'noThrow',
          fix(fixer: TSESLint.RuleFixer) {
            // Check if we're in a function that could use tryR
            let parent = node.parent;
            while (parent && parent.type !== 'FunctionDeclaration' && 
                   parent.type !== 'FunctionExpression' && 
                   parent.type !== 'ArrowFunctionExpression') {
              parent = parent.parent;
            }
            
            // If we're throwing a simple error, suggest a more specific approach
            const argument = node.argument;
            const sourceCode = context.getSourceCode();
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
              
              return fixer.replaceText(
                node,
                `return err(new ZeroError('${errorCode}', ${JSON.stringify(message)}))`
              );
            }
            
            // For other throws, suggest wrapping in tryR at the function level
            // or returning err() with the thrown value
            return fixer.replaceText(
              node,
              `return err(${argumentText})`
            );
          },
        });
      },
    };
  },
});