
import { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";

export const noThrowRule = ESLintUtils.RuleCreator(
  name => `https://github.com/flyingrobots/ZeroThrow/blob/main/docs/rules/${name}.md`
)({
  name: "no-throw",
  meta: {
    docs: {
      description: "Disallow throw statements in favor of Result types"
    },
    type: "problem",
    messages: { disallowThrow: "Use Result<T,E> instead of throw." },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    return {
      ThrowStatement(node: TSESTree.ThrowStatement) {
        context.report({ node, messageId: "disallowThrow" });
      }
    };
  }
});
