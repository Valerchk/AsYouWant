import { describe, it, expect } from "vitest";
import { parseQuickAdd, DEFAULT_DURATION_MIN } from "./quickAdd";

const p = (s: string) => parseQuickAdd(s).parsed;

describe("duration", () => {
  it.each([
    ["90m", 90],
    ["90min", 90],
    ["90 mins", 90],
    ["45 minutes", 45],
    ["1h", 60],
    ["2h", 120],
    ["1h30", 90],
    ["1h30m", 90],
    ["1.5h", 90],
    ["1,5h", 90],
    ["3hrs", 180],
  ])("reads %s as %i minutes", (input, expected) => {
    expect(p(`thesis ${input}`).plannedMin).toBe(expected);
  });

  it("falls back to a default when no length is given", () => {
    expect(p("email").plannedMin).toBe(DEFAULT_DURATION_MIN);
  });

  it("ignores an absurd duration rather than accepting it", () => {
    expect(p("thesis 5000m").plannedMin).toBe(DEFAULT_DURATION_MIN);
  });

  it("ignores a zero duration", () => {
    expect(p("thesis 0m").plannedMin).toBe(DEFAULT_DURATION_MIN);
  });
});

describe("time", () => {
  it.each([
    ["9am", 9 * 60],
    ["9 am", 9 * 60],
    ["9pm", 21 * 60],
    ["9:30am", 9 * 60 + 30],
    ["12am", 0],
    ["12pm", 12 * 60],
    ["09:00", 9 * 60],
    ["18:40", 18 * 60 + 40],
    ["9.30", 9 * 60 + 30],
    ["at 9", 9 * 60],
    ["at 21", 21 * 60],
    ["@7", 7 * 60],
  ])("reads %s as minute %i", (input, expected) => {
    expect(p(`standup ${input}`).startMin).toBe(expected);
  });

  it("leaves a block with no time unscheduled", () => {
    expect(p("email 20m").startMin).toBeNull();
  });

  it("rejects an impossible hour instead of wrapping it", () => {
    expect(p("standup 25:00").startMin).toBeNull();
  });

  it("rejects impossible minutes", () => {
    expect(p("standup 10:75").startMin).toBeNull();
  });
});

describe("kind", () => {
  it("anchors a block that names a time", () => {
    expect(p("standup 9am").kind).toBe("anchor");
  });

  it("lets a block with no time flow", () => {
    expect(p("email 20m").kind).toBe("flow");
  });
});

describe("thread", () => {
  it("picks up a hashtag", () => {
    expect(p("thesis 90m #study").threadName).toBe("study");
  });

  it("accepts hyphens and non-latin names", () => {
    expect(p("draft #deep-work").threadName).toBe("deep-work");
    expect(p("draft #учёба").threadName).toBe("учёба");
  });

  it("reports no thread when none is given", () => {
    expect(p("thesis 90m").threadName).toBeNull();
  });
});

describe("title", () => {
  it("keeps only what the patterns did not claim", () => {
    expect(p("thesis 90m 9am #study").title).toBe("thesis");
  });

  it("survives tokens appearing before the title", () => {
    expect(p("9am 90m #study thesis draft").title).toBe("thesis draft");
  });

  it("keeps interior words intact", () => {
    expect(p("call with bob 30m 3pm").title).toBe("call with bob");
  });

  it("does not mistake 'at' inside a word for a time marker", () => {
    const r = p("chat with sam 30m");
    expect(r.title).toBe("chat with sam");
    expect(r.startMin).toBeNull();
  });

  it("swallows the preposition along with the time it introduces", () => {
    // Regression: "at" used to survive into the title whenever the time was
    // matched as a clock rather than as a bare hour.
    expect(p("gym at 18:40 #health").title).toBe("gym");
    expect(p("gym at 6pm").title).toBe("gym");
    expect(p("gym at 9").title).toBe("gym");
    expect(p("gym @18:40").title).toBe("gym");
  });

  it("still parses the time correctly with the preposition present", () => {
    expect(p("gym at 18:40").startMin).toBe(18 * 60 + 40);
    expect(p("gym at 6pm").startMin).toBe(18 * 60);
  });

  it("returns an empty title for an empty input", () => {
    expect(p("").title).toBe("");
  });

  it("returns an empty title when the input is only tokens", () => {
    expect(p("9am 30m #study").title).toBe("");
  });
});

describe("the two numbers that look alike", () => {
  it("keeps 90m a duration and 9am a time in the same string", () => {
    const r = p("thesis 90m 9am");
    expect(r.plannedMin).toBe(90);
    expect(r.startMin).toBe(9 * 60);
  });

  it("does not read the 30 in 1h30 as a clock time", () => {
    const r = p("thesis 1h30");
    expect(r.plannedMin).toBe(90);
    expect(r.startMin).toBeNull();
  });

  it("handles a clock time and an hours duration together", () => {
    const r = p("workshop 14:00 2h");
    expect(r.startMin).toBe(14 * 60);
    expect(r.plannedMin).toBe(120);
  });
});

describe("junk input", () => {
  it("treats plain text as a titled flow block", () => {
    expect(p("...")).toMatchObject({
      title: "...",
      startMin: null,
      kind: "flow",
      plannedMin: DEFAULT_DURATION_MIN,
    });
  });

  it("does not throw on a lone hash", () => {
    expect(() => parseQuickAdd("#")).not.toThrow();
    expect(p("#").threadName).toBeNull();
  });

  it("does not throw on regex-looking input", () => {
    expect(() => parseQuickAdd("(.*)+[a-z]")).not.toThrow();
  });
});

describe("tokens for highlighting", () => {
  it("reports every claimed range, in source order", () => {
    const { tokens } = parseQuickAdd("thesis 90m 9am #study");
    expect(tokens).toEqual([
      { start: 7, end: 10, type: "duration" },
      { start: 11, end: 14, type: "time" },
      { start: 15, end: 21, type: "thread" },
    ]);
  });

  it("reports ranges that map back onto the original string", () => {
    const input = "call with bob 30m 3pm";
    const { tokens } = parseQuickAdd(input);
    const slices = tokens.map((t) => input.slice(t.start, t.end));
    expect(slices).toEqual(["30m", "3pm"]);
  });

  it("never reports overlapping ranges", () => {
    const { tokens } = parseQuickAdd("thesis 1h30 at 9 #study");
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i].start).toBeGreaterThanOrEqual(tokens[i - 1].end);
    }
  });

  it("does not trail whitespace into a claimed range", () => {
    // Regression: "1h30 write" used to claim "1h30 " and shift the highlight
    // one character to the right of the text it belongs to.
    const input = "1h30 write the intro #thesis";
    const { tokens } = parseQuickAdd(input);
    for (const t of tokens) {
      const slice = input.slice(t.start, t.end);
      expect(slice).toBe(slice.trim());
    }
  });
});
