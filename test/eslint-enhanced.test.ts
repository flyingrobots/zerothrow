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
      insertTextAfter: vi.fn().mockReturnValue("fix"),
      insertTextBefore: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')"),
        ast: {
          body: []
        }
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
    
    // The fixer now returns an array of fixes
    if (Array.isArray(fixResult)) {
      // Find the replaceText fix
      expect(fixResult.some(fix => fix === "fix")).toBe(true);
      expect(mockFixer.replaceText).toHaveBeenCalledWith(
        mockNode,
        'return err(new ZeroError(\'NOT_FOUND\', "User not found"))'
      );
    } else {
      expect(mockFixer.replaceText).toHaveBeenCalledWith(
        mockNode,
        'return err(new ZeroError(\'NOT_FOUND\', "User not found"))'
      );
    }
  });

  it("auto-fixes generic throw statements", () => {
    const mockFixer = {
      replaceText: vi.fn().mockReturnValue("fix"),
      insertTextAfter: vi.fn().mockReturnValue("fix"),
      insertTextBefore: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("someError"),
        ast: {
          body: []
        }
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
    
    // The fixer returns an array of fixes when adding imports
    expect(Array.isArray(fixResult)).toBe(true);
    expect(mockFixer.replaceText).toHaveBeenCalledWith(
      mockNode,
      "return err(someError)"
    );
  });

  it("uses TODO_ERROR_CODE for unknown error patterns", () => {
    const mockFixer = {
      replaceText: vi.fn().mockReturnValue("fix"),
      insertTextAfter: vi.fn().mockReturnValue("fix"),
      insertTextBefore: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('Something unexpected happened')"),
        ast: {
          body: []
        }
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
    
    // The fixer returns an array of fixes when adding imports
    expect(Array.isArray(fixResult)).toBe(true);
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

  it("adds imports to existing zerothrow import", () => {
    const mockFixer = {
      replaceText: vi.fn().mockImplementation((node, text) => ({ type: 'replace', node, text })),
      insertTextAfter: vi.fn().mockReturnValue("fix"),
      insertTextBefore: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')"),
        ast: {
          body: [{
            type: "ImportDeclaration",
            source: { value: "@flyingrobots/zerothrow" },
            specifiers: [
              { type: "ImportSpecifier", imported: { name: "Result" } }
            ]
          }]
        }
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "NewExpression",
        callee: { type: "Identifier", name: "Error" },
        arguments: [{ type: "Literal", value: "Network error" }]
      }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Test behavior: should produce fixes that update the import
    expect(Array.isArray(fixResult)).toBe(true);
    expect(fixResult.length).toBeGreaterThan(0);
    
    // Verify it replaces the import with updated specifiers
    const replaceCall = mockFixer.replaceText.mock.calls.find(call => 
      call[1].includes('import { Result, err, ZeroError }')
    );
    expect(replaceCall).toBeDefined();
  });

  it("adds imports when only err is missing", () => {
    const mockFixer = {
      replaceText: vi.fn().mockImplementation((node, text) => ({ type: 'replace', node, text })),
      insertTextAfter: vi.fn().mockReturnValue("fix"),
      insertTextBefore: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("someError"),
        ast: {
          body: [{
            type: "ImportDeclaration",
            source: { value: "@flyingrobots/zerothrow" },
            specifiers: [
              { type: "ImportSpecifier", imported: { name: "ZeroError" } }
            ]
          }]
        }
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "Identifier",
        name: "someError"
      }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Test behavior: should produce fixes
    expect(Array.isArray(fixResult)).toBe(true);
    expect(fixResult.length).toBeGreaterThan(0);
    
    // Verify it adds err to the existing imports
    const replaceCall = mockFixer.replaceText.mock.calls.find(call => 
      call[1].includes('import { ZeroError, err }')
    );
    expect(replaceCall).toBeDefined();
  });

  it("detects TODO_ERROR_CODE literal values", () => {
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "Literal",
      value: "TODO_ERROR_CODE"
    } as any;
    
    rule.Literal?.(mockNode);
    
    expect(mockContext.report).toHaveBeenCalledWith({
      node: mockNode,
      messageId: "todoErrorCode"
    });
  });

  it("handles throw without argument", () => {
    const mockFixer = {
      replaceText: vi.fn().mockReturnValue("fix"),
      insertTextAfter: vi.fn().mockReturnValue("fix"),
      insertTextBefore: vi.fn().mockReturnValue("fix"),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn(),
        ast: { body: [] }
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: null // No argument
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Should return null when there's no argument
    expect(fixResult).toBeNull();
  });
});