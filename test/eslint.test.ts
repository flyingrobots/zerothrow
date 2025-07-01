import { describe, it, expect, vi } from "vitest";
import { noThrowRule } from "../src/eslint/noThrowRule";

describe("no-throw rule", () => {
  it("has correct metadata", () => {
    expect(noThrowRule.meta.type).toBe("problem");
    expect(noThrowRule.meta.messages.disallowThrow).toBe("Use Result<T,E> instead of throw.");
  });

  it("reports throw statements", () => {
    const mockContext = {
      report: vi.fn(),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { type: "ThrowStatement" } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    expect(mockContext.report).toHaveBeenCalledWith({
      node: mockNode,
      messageId: "disallowThrow",
    });
  });
});