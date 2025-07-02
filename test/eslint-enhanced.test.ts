import { describe, it, expect, vi } from "vitest";
import { noThrowRule } from "../src/eslint/no-throw";

describe("enhanced no-throw rule with auto-fix", () => {
  it("has correct metadata with fixable option", () => {
    expect(noThrowRule.meta.type).toBe("problem");
    expect(noThrowRule.meta.fixable).toBe("code");
    expect(noThrowRule.meta.messages.noThrow).toBe("Use Result<T,E> instead of throw statements");
  });

  it("auto-fixes simple Error throw statements", () => {
    const mockFixer = {
      replaceText: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')")
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "NewExpression",
        callee: { type: "Identifier", name: "Error" },
        arguments: [{ type: "Literal", value: "User not found" }]
      },
      parent: { type: "BlockStatement" }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    expect(mockContext.report).toHaveBeenCalled();
    const reportCall = mockContext.report.mock.calls[0][0];
    expect(reportCall.messageId).toBe("noThrow");
    
    // Test the fix function - should derive NOT_FOUND from message
    const fixResult = reportCall.fix(mockFixer);
    expect(mockFixer.replaceText).toHaveBeenCalledWith(
      mockNode,
      'return err(new ZeroError(\'NOT_FOUND\', "User not found"))'
    );
  });

  it("auto-fixes generic throw statements", () => {
    const mockFixer = {
      replaceText: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("someError")
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "Identifier",
        name: "someError"
      },
      parent: { type: "BlockStatement" }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    expect(mockFixer.replaceText).toHaveBeenCalledWith(
      mockNode,
      "return err(someError)"
    );
  });

  it("uses TODO_ERROR_CODE for unknown error patterns", () => {
    const mockFixer = {
      replaceText: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('Something unexpected happened')")
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "NewExpression",
        callee: { type: "Identifier", name: "Error" },
        arguments: [{ type: "Literal", value: "Something unexpected happened" }]
      },
      parent: { type: "BlockStatement" }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    expect(mockFixer.replaceText).toHaveBeenCalledWith(
      mockNode,
      'return err(new ZeroError(\'TODO_ERROR_CODE\', "Something unexpected happened"))'
    );
  });

  it("respects allowInTests option", () => {
    const mockContext = {
      report: vi.fn(),
      options: [{ allowInTests: true }],
      getFilename: vi.fn().mockReturnValue("test.test.ts"),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { type: "ThrowStatement" } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    expect(mockContext.report).not.toHaveBeenCalled();
  });

  it("respects allowedFiles option", () => {
    const mockContext = {
      report: vi.fn(),
      options: [{ allowedFiles: ["config", "setup"] }],
      getFilename: vi.fn().mockReturnValue("app/config/db.ts"),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { type: "ThrowStatement" } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    expect(mockContext.report).not.toHaveBeenCalled();
  });
});