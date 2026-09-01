import { describe, expect, it } from "vitest";
import { blockLook, isPlain, lookColor } from "./look";
import type { Thread } from "@/lib/threads";

const WORK: Thread = { id: "t1", name: "Work", colorIndex: 3, icon: "work" };

describe("blockLook", () => {
  it("uses the block's own colour and icon when it has them", () => {
    const look = blockLook({ colorIndex: 7, icon: "sport" }, WORK);
    expect(look).toEqual({ colorIndex: 7, icon: "sport" });
  });

  it("falls back to the goal so days planned before this look unchanged", () => {
    const look = blockLook({ colorIndex: null, icon: null }, WORK);
    expect(look).toEqual({ colorIndex: 3, icon: "work" });
  });

  it("falls back per field, not all or nothing", () => {
    expect(blockLook({ colorIndex: 12, icon: null }, WORK)).toEqual({
      colorIndex: 12,
      icon: "work",
    });
    expect(blockLook({ colorIndex: null, icon: "music" }, WORK)).toEqual({
      colorIndex: 3,
      icon: "music",
    });
  });

  it("keeps colour zero, which is a colour and not an absence", () => {
    // The bug this guards: `||` reads 0 as unset and hands the block back to
    // its goal, so the first swatch in the palette could never be chosen.
    expect(blockLook({ colorIndex: 0, icon: null }, WORK).colorIndex).toBe(0);
  });

  it("needs no goal at all", () => {
    expect(blockLook({ colorIndex: 5, icon: "gym" }, null)).toEqual({
      colorIndex: 5,
      icon: "gym",
    });
    expect(blockLook({ colorIndex: null, icon: null }, null)).toEqual({
      colorIndex: null,
      icon: null,
    });
  });

  it("treats an absent field the same as an explicit null", () => {
    expect(blockLook({}, null)).toEqual({ colorIndex: null, icon: null });
  });
});

describe("lookColor", () => {
  it("names a palette variable that exists in plain :root", () => {
    expect(lookColor({ colorIndex: 0, icon: null })).toBe("var(--thread-1)");
    expect(lookColor({ colorIndex: 15, icon: null })).toBe("var(--thread-16)");
  });

  it("is null when there is no colour, so callers can choose a default", () => {
    expect(lookColor({ colorIndex: null, icon: "work" })).toBeNull();
  });
});

describe("isPlain", () => {
  it("is true only when nothing at all was said", () => {
    expect(isPlain({ colorIndex: null, icon: null })).toBe(true);
    expect(isPlain({ colorIndex: 0, icon: null })).toBe(false);
    expect(isPlain({ colorIndex: null, icon: "work" })).toBe(false);
  });
});
