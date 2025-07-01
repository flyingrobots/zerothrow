
import { describe, it, expect } from "vitest";
import { ok, err, tryR } from "../src";

describe("Result helpers", () => {
  it("ok()", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });
  it("err()", () => {
    const e = new Error("boom");
    expect(err(e)).toEqual({ ok: false, error: e });
  });
  it("tryR success", async () => {
    const r = await tryR(() => 1);
    expect(r.ok).toBe(true);
  });
  it("tryR failure", async () => {
    const r = await tryR(() => { throw new Error("bad"); });
    expect(r.ok).toBe(false);
  });
});
