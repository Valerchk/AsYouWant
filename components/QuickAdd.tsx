"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { parseQuickAdd, type ParseToken } from "@/lib/parse/quickAdd";
import { formatClock, formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";
import { Icon } from "@/components/icons/Icon";

interface Props {
  threads: Thread[];
  onSubmit: (input: string) => void;
}

const TOKEN_TINT: Record<ParseToken["type"], string> = {
  duration: "color-mix(in oklab, var(--color-accent) 16%, transparent)",
  time: "color-mix(in oklab, var(--color-accent) 26%, transparent)",
  thread: "color-mix(in oklab, var(--color-ink) 14%, transparent)",
};

/* Shared by the input and the highlight layer beneath it. Any divergence
   here — a different size, weight or tracking — makes the tint drift off the
   text it belongs to, so the two read from one constant. */
const FIELD_TYPE =
  "font-[family-name:var(--font-mono)] text-base leading-6 tracking-[-0.01em]";
const FIELD_BOX = "px-3 py-3";

export interface QuickAddHandle {
  /** Drop text into the field and put the cursor after it. */
  prefill: (text: string) => void;
}

export const QuickAdd = forwardRef<QuickAddHandle, Props>(function QuickAdd(
  { threads, onSubmit },
  ref,
) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Exposed imperatively rather than as a prop: tapping an open stretch fills
  // the field and focuses it, which is an event, not a piece of state. Passing
  // it down as a value would need an effect to detect the change and would
  // re-fire whenever the parent re-rendered.
  useImperativeHandle(ref, () => ({
    prefill(text: string) {
      setValue(text);
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      // After React has painted the new value, park the caret at the end.
      requestAnimationFrame(() => {
        el.setSelectionRange(text.length, text.length);
      });
    },
  }));

  const { parsed, tokens } = useMemo(() => parseQuickAdd(value), [value]);

  const matchedThread = useMemo(() => {
    if (!parsed.threadName) return null;
    const needle = parsed.threadName.toLowerCase();
    return (
      threads.find((t) => t.name.toLowerCase() === needle) ??
      threads.find((t) => t.name.toLowerCase().startsWith(needle)) ??
      null
    );
  }, [parsed.threadName, threads]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.title) return;
    onSubmit(value);
    setValue("");
    inputRef.current?.focus();
  }

  /* Rebuild the string as tinted and untinted runs. */
  const runs = useMemo(() => {
    const out: { text: string; type: ParseToken["type"] | null }[] = [];
    let cursor = 0;
    for (const t of tokens) {
      if (t.start > cursor) {
        out.push({ text: value.slice(cursor, t.start), type: null });
      }
      out.push({ text: value.slice(t.start, t.end), type: t.type });
      cursor = t.end;
    }
    if (cursor < value.length) {
      out.push({ text: value.slice(cursor), type: null });
    }
    return out;
  }, [value, tokens]);

  const showPreview = value.trim().length > 0;

  return (
    <form onSubmit={submit} className="w-full">
      <div className="relative rounded-edge bg-sunk ring-1 ring-rule transition-shadow focus-within:ring-accent/40 focus-within:shadow-lift">
        {/* The visible text, tinted where the parser recognised something.
            The input above is transparent apart from its caret, so there is
            exactly one set of glyphs on screen. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-deep ${FIELD_TYPE} ${FIELD_BOX}`}
        >
          {runs.map((r, i) => (
            <span
              key={i}
              style={
                r.type
                  ? {
                      background: TOKEN_TINT[r.type],
                      borderRadius: "var(--radius-hair)",
                    }
                  : undefined
              }
            >
              {r.text}
            </span>
          ))}
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="thesis 90m 9am #study"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Add a block"
          className={`relative w-full bg-transparent outline-none placeholder:text-faint/50 ${FIELD_TYPE} ${FIELD_BOX}`}
          style={{ color: "transparent", caretColor: "var(--color-accent)" }}
        />
      </div>

      {showPreview && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-fine">
          <span className="flex items-center gap-1.5 text-faint">
            <Icon
              name={parsed.kind === "anchor" ? "anchor" : "flow"}
              size={12}
            />
            {parsed.kind === "anchor" ? "anchored" : "flows"}
          </span>

          {parsed.startMin !== null && (
            <span className="num text-accent">
              {formatClock(parsed.startMin)}
            </span>
          )}

          <span className="num text-ink">
            {formatDuration(parsed.plannedMin)}
          </span>

          {parsed.threadName && (
            <span
              className="flex items-center gap-1.5"
              style={{
                color: matchedThread
                  ? threadColor(matchedThread.colorIndex)
                  : "var(--color-faint)",
              }}
            >
              <span
                className="inline-block h-px w-3"
                style={{ background: "currentColor" }}
              />
              {matchedThread ? matchedThread.name : `${parsed.threadName} · new`}
            </span>
          )}

          {parsed.title && (
            <span className="text-faint">
              &ldquo;<span className="text-ink">{parsed.title}</span>&rdquo;
            </span>
          )}
        </div>
      )}
    </form>
  );
});
