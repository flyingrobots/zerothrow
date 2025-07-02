import { ESLintUtils } from '@typescript-eslint/utils';
import { buildFixes } from './no-throw/fix-builder.js';

export const noThrowRule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow throw statements in favor of Result types',
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

    if (
      options.allowedFiles?.some((pattern: string) =>
        filename.includes(pattern)
      )
    ) {
      return {};
    }

    return {
      // Check for TODO_ERROR_CODE in existing code
      Literal(node) {
        if (node.value === 'TODO_ERROR_CODE') {
          context.report({
            node,
            messageId: 'todoErrorCode',
          });
        }
      },

      ThrowStatement(node) {
        context.report({
          node,
          messageId: 'noThrow',
          fix(fixer) {
            const sourceCode = context.getSourceCode();
            return buildFixes({ node, fixer, sourceCode });
          },
        });
      },
    };
  },
});
