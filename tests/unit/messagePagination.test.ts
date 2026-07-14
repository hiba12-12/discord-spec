import { describe, expect, test } from "vitest";
import { reverseForDisplay } from "../../src/lib/messages";

describe("reverseForDisplay", () => {
  test("reverses a newest-first page into oldest-first display order", () => {
    const newestFirst = [{ id: 3 }, { id: 2 }, { id: 1 }];
    expect(reverseForDisplay(newestFirst)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  test("does not mutate the input array", () => {
    const newestFirst = [{ id: 2 }, { id: 1 }];
    const result = reverseForDisplay(newestFirst);
    expect(result).not.toBe(newestFirst);
    expect(newestFirst).toEqual([{ id: 2 }, { id: 1 }]);
  });

  test("handles an empty page", () => {
    expect(reverseForDisplay([])).toEqual([]);
  });
});
