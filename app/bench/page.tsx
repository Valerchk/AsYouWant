import { Icon, ICON_NAMES } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";

/* Design bench. Not part of the product — this is the reference surface the
   whole system gets checked against on a real phone before anything ships.

   Every swatch reads from a live CSS variable rather than a hard-coded hex,
   so this page tells the truth in both themes instead of drifting out of
   sync with tokens.css. */

const SURFACES = [
  ["paper", "page ground, warm stock"],
  ["sunk", "panels, the input well"],
  ["grid", "graph-paper ruling"],
  ["rule", "borders, hairlines"],
] as const;

const INK = [
  ["faint", "5.2:1"],
  ["ink", "9.0:1"],
  ["deep", "15.6:1"],
] as const;

const STATE = [
  ["accent", "now, and the primary action"],
  ["accent-hi", "pressed / hover"],
  ["accent-soft", "tinted fills"],
  ["over", "running long"],
  ["done", "completed"],
] as const;

const THREADS = [
  "ochre",
  "olive",
  "emerald",
  "steel",
  "purple",
  "fuchsia",
  "crimson",
  "terracotta",
];

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-5 flex items-baseline gap-3 border-b border-rule pb-2">
        <span className="num text-micro text-accent">{n}</span>
        <h2 className="text-micro tracking-[0.18em] text-faint uppercase">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function Bench() {
  return (
    <main className="chrome safe-top safe-bottom mx-auto max-w-3xl px-6 py-12">
      <header className="mb-16 flex items-start justify-between">
        <div>
          <h1 className="display text-display text-deep">Drafting Table</h1>
          <p className="mt-2 text-fine text-faint">
            Design bench · every token in the system, in the theme you are in
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section n="01" title="Surface">
        <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
          {SURFACES.map(([name, note]) => (
            <div key={name} className="bg-paper p-4">
              <div
                className="mb-3 h-16 rounded-edge ring-1 ring-rule"
                style={{ background: `var(--color-${name})` }}
              />
              <div className="text-fine text-ink">{name}</div>
              <div className="mt-1 text-micro text-faint">{note}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section n="02" title="Ink · contrast on paper">
        <div className="space-y-3">
          {INK.map(([name, ratio]) => (
            <div key={name} className="flex items-center gap-4">
              <span className="num w-14 text-micro text-faint">{ratio}</span>
              <span
                className="flex-1 text-base"
                style={{ color: `var(--color-${name})` }}
              >
                The plan is not the day. Handle 90 minutes of thesis.
              </span>
              <span className="num text-micro text-faint">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="03" title="Accent & state">
        <div className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-5">
          {STATE.map(([name, note]) => (
            <div key={name} className="bg-paper p-4">
              <div
                className="mb-3 h-10 rounded-edge ring-1 ring-rule"
                style={{ background: `var(--color-${name})` }}
              />
              <div className="text-fine text-ink">{name}</div>
              <div className="mt-1 text-micro text-faint">{note}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title="Goal threads">
        <div className="flex gap-px bg-rule">
          {THREADS.map((name, i) => (
            <div key={name} className="flex-1 bg-paper pt-3 pb-2 text-center">
              <div
                className="mx-auto mb-2 h-20 w-1.5"
                style={{ background: `var(--thread-${i + 1})` }}
              />
              <div className="text-micro text-faint">{name}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-fine text-faint">
          Saturated, because pastels vanish on warm paper. The purple is pulled
          deliberately clear of the indigo accent, so a thread can never be
          mistaken for &ldquo;now&rdquo;.
        </p>
      </Section>

      <Section n="05" title="Type">
        <div className="space-y-6">
          <div>
            <div className="num mb-2 text-micro text-accent">
              Unbounded · display only, never below 20px
            </div>
            <div className="display text-display text-deep">Deep Work</div>
            <div className="display mt-1 text-title text-ink">
              Thesis · Health · Craft
            </div>
          </div>

          <div>
            <div className="num mb-2 text-micro text-accent">
              Onest · everything readable
            </div>
            <p className="text-lede text-deep">
              You finished eighteen minutes early.
            </p>
            <p className="mt-1 text-base text-ink">
              The ribbon compresses and everything below springs up. Nothing
              about the rest of the day is a lie now.
            </p>
            <p className="mt-1 text-fine text-faint">
              Blocks with an hour hold. Blocks without one move.
            </p>
          </div>

          <div>
            <div className="num mb-2 text-micro text-accent">
              IBM Plex Mono · every digit, always tabular
            </div>
            <div className="num text-mega text-accent">23:07</div>
            <div className="num mt-1 text-base text-ink">
              09:00 → 10:30 · 90 min · +18 free
            </div>
            <div className="num text-fine text-faint">
              1111111111 · 0000000000 — columns must not drift
            </div>
          </div>
        </div>
      </Section>

      <Section n="06" title="Icons · one hand, one weight">
        <div className="grid grid-cols-4 gap-px bg-rule sm:grid-cols-6">
          {ICON_NAMES.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-2 bg-paper px-2 py-4 text-faint"
            >
              <Icon name={name} size={24} className="text-ink" />
              <span className="text-micro break-all text-center">{name}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-6 text-ink">
          {[16, 20, 24, 32, 40].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <Icon name="anchor" size={s} />
              <span className="num text-micro text-faint">{s}</span>
            </div>
          ))}
          <p className="ml-2 flex-1 text-fine text-faint">
            Stroke stays a constant hairline at every size — the set reads as
            one hand rather than five.
          </p>
        </div>
      </Section>

      <Section n="07" title="Depth">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rule rounded-plate bg-sunk p-4">
            <div className="text-fine text-ink">hairline</div>
            <div className="num mt-1 text-micro text-faint">
              inset 0 0 0 1px rule
            </div>
          </div>
          <div className="rounded-plate bg-sunk p-4 shadow-lift">
            <div className="text-fine text-ink">lift</div>
            <div className="num mt-1 text-micro text-faint">
              one sheet on another
            </div>
          </div>
          <div className="rounded-plate bg-accent-soft p-4 ring-1 ring-accent/25">
            <div className="text-fine text-accent">accent fill</div>
            <div className="num mt-1 text-micro text-faint">the day&rsquo;s ask</div>
          </div>
        </div>
        <p className="mt-3 text-fine text-faint">
          No glows anywhere: on paper a halo reads as a smudge. Depth comes
          from a real, shallow shadow and from the weight of the ink.
        </p>
      </Section>

      <Section n="08" title="Graph paper">
        <div
          className="etched rule h-48 rounded-plate"
          style={{ ["--etch-step" as string]: "24px" }}
        >
          <div className="relative h-full">
            <div className="absolute top-24 right-0 left-0 h-[1.5px] bg-accent" />
            <div className="num absolute top-[86px] left-3 text-micro text-accent">
              10:48
            </div>
          </div>
        </div>
        <p className="mt-3 text-fine text-faint">
          Ruled on both axes with gradients rather than elements, so scrolling
          a whole day past it costs nothing.
        </p>
      </Section>
    </main>
  );
}
