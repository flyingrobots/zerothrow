import { ESLintUtils, TSESTree, TSESLint } from '@typescript-eslint/utils';

export const noThrowRule = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-throw',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow throw statements in favor of Result types',
      recommended: 'error',
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
  create(context) {
    const options = context.options[0] || {};
    const filename = context.getFilename();
    
    // Check if file is allowed
    if (options.allowInTests && filename.includes('.test.')) {
      return {};
    }
    
    if (options.allowedFiles?.some(pattern => filename.includes(pattern))) {
      return {};
    }

    return {
      ThrowStatement(node: TSESTree.ThrowStatement) {
        context.report({
          node,
          messageId: 'noThrow',
          fix(fixer: TSESLint.RuleFixer) {
            const argument = node.argument;
            
            if (argument.type === 'NewExpression' && 
                argument.callee.type === 'Identifier' && 
                argument.callee.name === 'Error') {
              
              const args = argument.arguments;
              if (args.length === 1 && args[0].type === 'Literal') {
                const message = args[0].value;
                return fixer.replaceText(
                  node,
                  `return err(new ZeroError('OPERATION_FAILED', ${JSON.stringify(message)}))`
                );
              }
            }
            
            // Generic replacement
            const sourceCode = context.getSourceCode();
            const argumentText = sourceCode.getText(argument);
            return fixer.replaceText(
              node,
              `return err(new ZeroError('OPERATION_FAILED', 'Operation failed', { cause: ${argumentText} }))`
            );
          },
        });
      },
    };
  },
});