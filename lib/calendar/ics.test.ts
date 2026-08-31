import { describe, it, expect } from "vitest";
import { eventsOnDay } from "./ics";

/* Every assertion is anchored to an explicit zone. A test that reads the
   machine's own zone passes in Kyiv and fails in CI, which is the least
   useful way for a timezone bug to be found. */

function ics(...events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...events.flatMap((e) => ["BEGIN:VEVENT", ...e.trim().split("\n"), "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n");
}

const on = (text: string, day: string, zone = "UTC") =>
  eventsOnDay(text, day, zone);

describe("a single event", () => {
  it("lands on the right minutes in UTC", () => {
    const out = on(
      ics(`
UID:a
SUMMARY:Standup
DTSTART:20260827T090000Z
DTEND:20260827T093000Z`),
      "2026-08-27",
    );

    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Standup");
    expect(out[0].startMin).toBe(9 * 60);
    expect(out[0].endMin).toBe(9 * 60 + 30);
  });

  it("shifts with the reader's zone", () => {
    // 09:00 UTC is 12:00 in Kyiv (UTC+3 in August).
    const out = on(
      ics(`
UID:a
DTSTART:20260827T090000Z
DTEND:20260827T100000Z`),
      "2026-08-27",
      "Europe/Kyiv",
    );
    expect(out[0].startMin).toBe(12 * 60);
  });

  it("reads a floating time as the reader's own clock", () => {
    const out = on(
      ics(`
UID:a
DTSTART:20260827T140000
DTEND:20260827T150000`),
      "2026-08-27",
      "Europe/Kyiv",
    );
    expect(out[0].startMin).toBe(14 * 60);
  });

  it("honours the event's own named zone", () => {
    // 14:00 in New York is 21:00 in Kyiv on that date.
    const out = on(
      ics(`
UID:a
DTSTART;TZID=America/New_York:20260827T140000
DTEND;TZID=America/New_York:20260827T150000`),
      "2026-08-27",
      "Europe/Kyiv",
    );
    expect(out[0].startMin).toBe(21 * 60);
  });

  it("takes DURATION when there is no DTEND", () => {
    const out = on(
      ics(`
UID:a
DTSTART:20260827T090000Z
DURATION:PT1H30M`),
      "2026-08-27",
    );
    expect(out[0].endMin - out[0].startMin).toBe(90);
  });

  it("skips all-day events, which occupy no clock time", () => {
    expect(
      on(
        ics(`
UID:a
SUMMARY:Someone's birthday
DTSTART;VALUE=DATE:20260827
DTEND;VALUE=DATE:20260828`),
        "2026-08-27",
      ),
    ).toEqual([]);
  });

  it("says nothing about a day it does not touch", () => {
    const text = ics(`
UID:a
DTSTART:20260827T090000Z
DTEND:20260827T093000Z`);
    expect(on(text, "2026-08-26")).toEqual([]);
    expect(on(text, "2026-08-28")).toEqual([]);
  });
});

describe("events that cross midnight", () => {
  it("shows the tail of last night's event this morning", () => {
    const out = on(
      ics(`
UID:a
SUMMARY:Night shift
DTSTART:20260826T220000Z
DTEND:20260827T060000Z`),
      "2026-08-27",
    );
    expect(out[0].startMin).toBe(0);
    expect(out[0].endMin).toBe(6 * 60);
  });

  it("clamps an event running past the end of the day", () => {
    const out = on(
      ics(`
UID:a
DTSTART:20260827T230000Z
DTEND:20260828T020000Z`),
      "2026-08-27",
    );
    expect(out[0].startMin).toBe(23 * 60);
    expect(out[0].endMin).toBe(1440);
  });
});

describe("recurrence", () => {
  const weekly = ics(`
UID:standup
SUMMARY:Standup
DTSTART:20260803T090000Z
DTEND:20260803T091500Z
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR`);

  it("appears on every named weekday", () => {
    // 3 Aug is a Monday, 5 Aug a Wednesday, 7 Aug a Friday.
    expect(on(weekly, "2026-08-03")).toHaveLength(1);
    expect(on(weekly, "2026-08-05")).toHaveLength(1);
    expect(on(weekly, "2026-08-07")).toHaveLength(1);
  });

  it("stays away on the others", () => {
    expect(on(weekly, "2026-08-04")).toEqual([]);
    expect(on(weekly, "2026-08-08")).toEqual([]);
  });

  it("never appears before it started", () => {
    expect(on(weekly, "2026-07-27")).toEqual([]);
  });

  it("keeps working weeks later", () => {
    expect(on(weekly, "2026-09-14")).toHaveLength(1);
  });

  it("honours INTERVAL", () => {
    const fortnightly = ics(`
UID:retro
DTSTART:20260803T090000Z
DTEND:20260803T100000Z
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO`);

    expect(on(fortnightly, "2026-08-03")).toHaveLength(1);
    expect(on(fortnightly, "2026-08-10")).toEqual([]);
    expect(on(fortnightly, "2026-08-17")).toHaveLength(1);
  });

  it("stops at UNTIL", () => {
    const ending = ics(`
UID:course
DTSTART:20260803T090000Z
DTEND:20260803T100000Z
RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260811T000000Z`);

    expect(on(ending, "2026-08-10")).toHaveLength(1);
    expect(on(ending, "2026-08-17")).toEqual([]);
  });

  it("stops after COUNT occurrences", () => {
    const three = ics(`
UID:series
DTSTART:20260803T090000Z
DTEND:20260803T100000Z
RRULE:FREQ=DAILY;COUNT=3`);

    expect(on(three, "2026-08-03")).toHaveLength(1);
    expect(on(three, "2026-08-05")).toHaveLength(1);
    expect(on(three, "2026-08-06")).toEqual([]);
  });

  it("skips a cancelled occurrence", () => {
    const withHole = ics(`
UID:standup
DTSTART:20260803T090000Z
DTEND:20260803T091500Z
RRULE:FREQ=WEEKLY;BYDAY=MO
EXDATE:20260810T090000Z`);

    expect(on(withHole, "2026-08-03")).toHaveLength(1);
    expect(on(withHole, "2026-08-10")).toEqual([]);
    expect(on(withHole, "2026-08-17")).toHaveLength(1);
  });

  it("ignores monthly rules rather than guessing at them", () => {
    const monthly = ics(`
UID:rent
DTSTART:20260803T090000Z
DTEND:20260803T100000Z
RRULE:FREQ=MONTHLY`);

    expect(on(monthly, "2026-09-03")).toEqual([]);
  });
});

describe("the format's sharp edges", () => {
  it("rejoins a folded line", () => {
    const folded = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:a",
      "SUMMARY:A meeting with a very long name that the",
      "  calendar folded",
      "DTSTART:20260827T090000Z",
      "DTEND:20260827T100000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(on(folded, "2026-08-27")[0].title).toBe(
      "A meeting with a very long name that the calendar folded",
    );
  });

  it("unescapes commas and semicolons", () => {
    const out = on(
      ics(`
UID:a
SUMMARY:Lunch\\, then a walk
DTSTART:20260827T120000Z
DTEND:20260827T130000Z`),
      "2026-08-27",
    );
    expect(out[0].title).toBe("Lunch, then a walk");
  });

  it("survives junk without throwing", () => {
    expect(() => on("not a calendar at all", "2026-08-27")).not.toThrow();
    expect(on("not a calendar at all", "2026-08-27")).toEqual([]);
  });

  it("names an untitled event rather than showing a blank block", () => {
    const out = on(
      ics(`
UID:a
DTSTART:20260827T090000Z
DTEND:20260827T100000Z`),
      "2026-08-27",
    );
    expect(out[0].title).toBe("Busy");
  });

  it("gives each occurrence its own id", () => {
    const daily = ics(`
UID:same
DTSTART:20260803T090000Z
DTEND:20260803T100000Z
RRULE:FREQ=DAILY`);

    const a = on(daily, "2026-08-03")[0].uid;
    const b = on(daily, "2026-08-04")[0].uid;
    expect(a).not.toBe(b);
  });
});
