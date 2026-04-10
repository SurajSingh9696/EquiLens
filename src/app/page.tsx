import Link from "next/link";
import {
  ArrowRight,
  ChartNoAxesCombined,
  FlaskConical,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const pillars = [
  {
    title: "Deep Fairness Metrics",
    description:
      "Demographic parity, disparate impact, equal opportunity, FPR parity, and predictive parity in one audit.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Action-Ready Mitigation",
    description:
      "Generate prioritized interventions with practical fixes that teams can implement immediately.",
    icon: ShieldCheck,
  },
  {
    title: "Zero-Friction Demo Mode",
    description:
      "Launch with synthetic challenge data to showcase fairness failure cases in under a minute.",
    icon: FlaskConical,
  },
];

const workflow = [
  "Upload dataset or use sample challenge data",
  "Map protected attributes, outcomes, and model predictions",
  "Run fairness diagnostics and gap visualizations",
  "Export investor-ready reports in JSON and Markdown",
];

export default function Home() {
  return (
    <main className="relative flex-1 overflow-x-clip pb-20 pt-8 md:pt-14">
      <div className="animate-float-slow pointer-events-none absolute -left-20 top-8 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(11,110,79,0.26),rgba(11,110,79,0)_70%)]" />
      <div className="animate-float-fast pointer-events-none absolute -right-16 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.22),rgba(245,158,11,0)_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
        <section className="glass-panel px-6 py-10 md:px-10 md:py-12">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="section-kicker">Google Solution Challenge 2026</p>
              <h1 className="display-title mt-3 text-5xl font-black leading-[1.02] text-[color:var(--color-ink)] md:text-7xl">
                Unbiased AI Decision System
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--color-muted)] md:text-lg">
                EquiLens helps organizations inspect datasets and automated decisions for hidden discrimination, flag high-risk fairness failures, and apply practical mitigation before real people are harmed.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-ink)] px-6 py-3 text-sm font-semibold !text-white transition hover:-translate-y-0.5 hover:bg-[#163d63]"
                >
                  Launch Audit Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#capabilities"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-6 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  Explore Capabilities
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white/75 p-6 shadow-[0_24px_48px_-32px_rgba(16,42,67,0.55)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                Challenge Objective
              </p>
              <h2 className="display-title mt-3 text-2xl font-extrabold text-[color:var(--color-ink)]">
                Detect. Explain. Fix bias.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-muted)]">
                Fairness cannot be a black-box checkbox. Teams need measurable diagnostics, transparent evidence, and concrete interventions to build trustworthy AI.
              </p>

              <div className="mt-5 space-y-2 text-sm text-[color:var(--color-ink)]">
                <div className="flex items-center gap-2 rounded-xl bg-[color:var(--color-sand)] px-3 py-2">
                  <Scale className="h-4 w-4 text-[color:var(--color-accent)]" />
                  <span>Measure fairness across protected groups</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[color:var(--color-sand)] px-3 py-2">
                  <Sparkles className="h-4 w-4 text-[color:var(--color-accent)]" />
                  <span>Highlight hidden risk with visual gap matrices</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[color:var(--color-sand)] px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--color-accent)]" />
                  <span>Export actionable mitigation playbooks</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="mt-10 grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article
                key={pillar.title}
                className="glass-panel h-full rounded-3xl p-5 md:p-6"
              >
                <div className="inline-flex rounded-2xl bg-[color:var(--color-sand)] p-3">
                  <Icon className="h-5 w-5 text-[color:var(--color-accent)]" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[color:var(--color-ink)]">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-muted)]">
                  {pillar.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="glass-panel p-6 md:p-7">
            <p className="section-kicker">How It Works</p>
            <h3 className="display-title mt-2 text-3xl font-extrabold text-[color:var(--color-ink)]">
              From raw CSV to fairness strategy
            </h3>

            <ol className="mt-5 space-y-3">
              {workflow.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-ink)] text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-[color:var(--color-ink)]">{step}</p>
                </li>
              ))}
            </ol>
          </article>

          <article className="glass-panel p-6 md:p-7">
            <p className="section-kicker">Why It Matters</p>
            <h3 className="display-title mt-2 text-3xl font-extrabold text-[color:var(--color-ink)]">
              Responsible AI for high-stakes decisions
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-muted)] md:text-base">
              Hiring, lending, and care decisions should not inherit decades of historical bias. EquiLens helps teams prove fairness readiness with transparent metrics and clear risk communication.
            </p>

            <Link
              href="/studio"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--color-ink)] transition hover:-translate-y-0.5"
            >
              Open EquiLens Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </section>
      </div>
    </main>
  );
}
