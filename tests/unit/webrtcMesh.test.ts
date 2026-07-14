import { describe, expect, test } from "vitest";
import { isPolite, IceCandidateBuffer } from "../../src/lib/webrtc/mesh";
import type { Id } from "../../convex/_generated/dataModel";

describe("isPolite", () => {
  test("the lexicographically smaller user ID is polite", () => {
    const a = "a-id" as Id<"users">;
    const b = "b-id" as Id<"users">;
    expect(isPolite(a, b)).toBe(true);
    expect(isPolite(b, a)).toBe(false);
  });

  test("is symmetric — exactly one side is polite for any pair", () => {
    const a = "user-1" as Id<"users">;
    const b = "user-2" as Id<"users">;
    expect(isPolite(a, b)).not.toBe(isPolite(b, a));
  });
});

describe("IceCandidateBuffer", () => {
  test("buffers candidates that arrive before the remote description is set", () => {
    const buffer = new IceCandidateBuffer<string>();
    expect(buffer.addOrBuffer("candidate-1")).toBeNull();
    expect(buffer.addOrBuffer("candidate-2")).toBeNull();
  });

  test("applies candidates immediately once the remote description is set", () => {
    const buffer = new IceCandidateBuffer<string>();
    buffer.markRemoteDescriptionSet();
    expect(buffer.addOrBuffer("candidate-1")).toBe("candidate-1");
  });

  test("flush returns buffered candidates in arrival order and marks ready", () => {
    const buffer = new IceCandidateBuffer<string>();
    buffer.addOrBuffer("candidate-1");
    buffer.addOrBuffer("candidate-2");
    expect(buffer.flush()).toEqual(["candidate-1", "candidate-2"]);
    // Now ready — subsequent candidates apply immediately instead of buffering.
    expect(buffer.addOrBuffer("candidate-3")).toBe("candidate-3");
  });

  test("flush clears the buffer so candidates aren't applied twice", () => {
    const buffer = new IceCandidateBuffer<string>();
    buffer.addOrBuffer("candidate-1");
    buffer.flush();
    expect(buffer.flush()).toEqual([]);
  });
});
