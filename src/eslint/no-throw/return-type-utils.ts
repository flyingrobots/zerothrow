import { TSESTree, TSESLint, AST_NODE_TYPES } from '@typescript-eslint/utils';

export type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

/**
 * Finds the parent function of a throw statement
 */
export function findParentFunction(node: TSESTree.Node): FunctionNode | null {
  let parent = node.parent;

  while (parent) {
    if (
      parent.type === AST_NODE_TYPES.FunctionDeclaration ||
      parent.type === AST_NODE_TYPES.FunctionExpression ||
      parent.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return parent;
    }

    if (parent.type === AST_NODE_TYPES.MethodDefinition && parent.value) {
      const func = parent.value;
      if (
        func.type === AST_NODE_TYPES.FunctionExpression ||
        func.type === AST_NODE_TYPES.ArrowFunctionExpression
      ) {
        return func;
      }
      // TSEmptyBodyFunctionExpression doesn't have a body, so no throw statements
    }

    parent = parent.parent;
  }

  return null;
}

/**
 * Checks if a function already has a return type annotation
 */
export function hasReturnType(func: FunctionNode): boolean {
  return 'returnType' in func && func.returnType !== undefined;
}

/**
 * Creates fixes to add Result return type to a function
 */
export function createReturnTypeFixes(
  fixer: TSESLint.RuleFixer,
  func: FunctionNode,
  sourceCode: TSESLint.SourceCode,
  isZeroError: boolean = true
): TSESLint.RuleFix[] {
  const fixes: TSESLint.RuleFix[] = [];

  if (hasReturnType(func)) {
    return fixes;
  }

  const isAsync = func.async ?? false;
  const errorType = isZeroError ? 'ZeroError' : 'unknown';
  const returnType = isAsync
    ? `: Promise<Result<unknown, ${errorType}>>`
    : `: Result<unknown, ${errorType}>`;

  if (func.type === 'ArrowFunctionExpression') {
    // For arrow functions, add before the arrow
    const arrowToken = sourceCode.getTokenAfter(
      func.params[func.params.length - 1] || func,
      (token): token is TSESTree.Token =>
        token.type === 'Punctuator' && token.value === '=>'
    );

    if (arrowToken) {
      fixes.push(fixer.insertTextBefore(arrowToken, returnType + ' '));
    }
  } else {
    // For regular functions, add after the parameters
    const closeParenToken = sourceCode.getTokenAfter(
      func.params[func.params.length - 1] || func,
      (token): token is TSESTree.Token =>
        token.type === 'Punctuator' && token.value === ')'
    );

    if (closeParenToken) {
      fixes.push(fixer.insertTextAfter(closeParenToken, returnType));
    }
  }

  return fixes;
}
