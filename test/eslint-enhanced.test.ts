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

  it("adds Result type annotation to function without return type", () => {
    const mockFixer = {
      replaceText: vi.fn().mockImplementation((node, text) => ({ type: 'replace', node, text })),
      insertTextAfter: vi.fn().mockImplementation((node, text) => ({ type: 'insertAfter', node, text })),
      insertTextBefore: vi.fn().mockImplementation((node, text) => ({ type: 'insertBefore', node, text })),
    };
    
    const mockCloseParenToken = { type: 'Punctuator', value: ')' };
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')"),
        getTokenAfter: vi.fn().mockReturnValue(mockCloseParenToken),
        ast: { body: [] }
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
      parent: {
        type: "FunctionDeclaration",
        params: [],
        returnType: null, // No return type
        async: false
      }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Behavior: When fixing a throw in an untyped function, it should add a Result return type
    expect(Array.isArray(fixResult)).toBe(true);
    expect(fixResult.length).toBeGreaterThan(1); // Multiple fixes: replace throw + add type
    
    // The fix should include adding a Result type annotation
    const typeAnnotationAdded = mockFixer.insertTextAfter.mock.calls.some(call => 
      call[1].includes('Result') && call[1].includes('ZeroError')
    );
    expect(typeAnnotationAdded).toBe(true);
  });

  it("adds Promise<Result> type annotation to async function", () => {
    const mockFixer = {
      replaceText: vi.fn().mockImplementation((node, text) => ({ type: 'replace', node, text })),
      insertTextAfter: vi.fn().mockImplementation((node, text) => ({ type: 'insertAfter', node, text })),
      insertTextBefore: vi.fn().mockImplementation((node, text) => ({ type: 'insertBefore', node, text })),
    };
    
    const mockCloseParenToken = { type: 'Punctuator', value: ')' };
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')"),
        getTokenAfter: vi.fn().mockReturnValue(mockCloseParenToken),
        ast: { body: [] }
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "NewExpression",
        callee: { type: "Identifier", name: "Error" },
        arguments: [{ type: "Literal", value: "Database error" }]
      },
      parent: {
        type: "FunctionExpression",
        params: [],
        returnType: null,
        async: true // Async function
      }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Behavior: Async functions should get Promise<Result> return type
    expect(Array.isArray(fixResult)).toBe(true);
    
    // Verify that a Promise-wrapped Result type was added
    const promiseTypeAdded = mockFixer.insertTextAfter.mock.calls.some(call => 
      call[1].includes('Promise') && call[1].includes('Result')
    );
    expect(promiseTypeAdded).toBe(true);
  });

  it("handles arrow functions differently than regular functions", () => {
    const mockFixer = {
      replaceText: vi.fn().mockImplementation((node, text) => ({ type: 'replace', node, text })),
      insertTextAfter: vi.fn().mockImplementation((node, text) => ({ type: 'insertAfter', node, text })),
      insertTextBefore: vi.fn().mockImplementation((node, text) => ({ type: 'insertBefore', node, text })),
    };
    
    const mockArrowToken = { type: 'Punctuator', value: '=>' };
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')"),
        getTokenAfter: vi.fn().mockReturnValue(mockArrowToken),
        ast: { body: [] }
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "NewExpression",
        callee: { type: "Identifier", name: "Error" },
        arguments: [{ type: "Literal", value: "Validation error" }]
      },
      parent: {
        type: "ArrowFunctionExpression",
        params: [],
        returnType: null,
        async: false
      }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Behavior: Arrow functions should place type annotation before the arrow
    expect(Array.isArray(fixResult)).toBe(true);
    
    // For arrow functions, we use insertTextBefore (not insertTextAfter)
    const hasInsertBefore = mockFixer.insertTextBefore.mock.calls.length > 0;
    const hasTypeAnnotation = mockFixer.insertTextBefore.mock.calls.some(call => 
      call[1].includes('Result')
    );
    expect(hasInsertBefore && hasTypeAnnotation).toBe(true);
  });

  it("preserves existing return type annotations", () => {
    const mockFixer = {
      replaceText: vi.fn().mockImplementation((node, text) => ({ type: 'replace', node, text })),
      insertTextAfter: vi.fn().mockImplementation((node, text) => ({ type: 'insertAfter', node, text })),
      insertTextBefore: vi.fn().mockImplementation((node, text) => ({ type: 'insertBefore', node, text })),
    };
    
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')"),
        ast: { body: [] }
      }),
    };
    
    const rule = noThrowRule.create(mockContext as any);
    const mockNode = { 
      type: "ThrowStatement",
      argument: {
        type: "NewExpression",
        callee: { type: "Identifier", name: "Error" },
        arguments: [{ type: "Literal", value: "Already typed" }]
      },
      parent: {
        type: "FunctionDeclaration",
        params: [],
        returnType: { type: "TSTypeAnnotation" }, // Already has return type
        async: false
      }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Behavior: Should not modify functions that already have return types
    expect(Array.isArray(fixResult)).toBe(true);
    
    // Should not attempt to add any type annotations
    const noTypeAnnotationAdded = 
      mockFixer.insertTextAfter.mock.calls.every(call => 
        !call[1]?.includes('Result')
      ) &&
      mockFixer.insertTextBefore.mock.calls.every(call => 
        !call[1]?.includes('Result')
      );
    expect(noTypeAnnotationAdded).toBe(true);
  });

  it("ensures Result type is imported when needed for type annotations", () => {
    const mockFixer = {
      replaceText: vi.fn().mockImplementation((node, text) => ({ type: 'replace', node, text })),
      insertTextAfter: vi.fn().mockImplementation((node, text) => ({ type: 'insertAfter', node, text })),
      insertTextBefore: vi.fn().mockImplementation((node, text) => ({ type: 'insertBefore', node, text })),
    };
    
    const mockCloseParenToken = { type: 'Punctuator', value: ')' };
    const mockContext = {
      report: vi.fn(),
      options: [{}],
      getFilename: vi.fn().mockReturnValue("test.ts"),
      getSourceCode: vi.fn().mockReturnValue({
        getText: vi.fn().mockReturnValue("new Error('test')"),
        getTokenAfter: vi.fn().mockReturnValue(mockCloseParenToken),
        ast: {
          body: [{
            type: "ImportDeclaration",
            source: { value: "@flyingrobots/zerothrow" },
            specifiers: [
              { type: "ImportSpecifier", imported: { name: "err" } }
            ],
            range: [0, 50]
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
        arguments: [{ type: "Literal", value: "Need Result import" }]
      },
      parent: {
        type: "FunctionDeclaration",
        params: [],
        returnType: null,
        async: false
      }
    } as any;
    
    rule.ThrowStatement?.(mockNode);
    
    const reportCall = mockContext.report.mock.calls[0][0];
    const fixResult = reportCall.fix(mockFixer);
    
    // Behavior: When adding Result type annotation, ensure Result is imported
    expect(Array.isArray(fixResult)).toBe(true);
    
    // Should update the import to include all necessary types
    const importUpdated = mockFixer.replaceText.mock.calls.some(call => {
      const importText = call[1];
      return importText.includes('err') && 
             importText.includes('ZeroError') && 
             importText.includes('Result');
    });
    expect(importUpdated).toBe(true);
  });
});