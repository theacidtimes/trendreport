import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Foundation · cccaramelo",
  description: "Editorial Intelligence Desk · visual language reference",
};

const surfaces = [
  { name: "Background", token: "--bg", value: "#0B0B0B", cls: "bg-bg" },
  { name: "Surface", token: "--surface", value: "#121212", cls: "bg-surface" },
  {
    name: "Surface 2",
    token: "--surface-2",
    value: "#181818",
    cls: "bg-surface-2",
  },
  {
    name: "Surface 3",
    token: "--surface-3",
    value: "#202020",
    cls: "bg-surface-3",
  },
];

const categories = [
  { key: "cat-business", label: "Business", strength: 82 },
  { key: "cat-technology", label: "Technology", strength: 64 },
  { key: "cat-culture", label: "Culture", strength: 91 },
  { key: "cat-sports", label: "Sports", strength: 47 },
  { key: "cat-agro", label: "Agro", strength: 73 },
];

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-hairline pb-4">
      <span className="kicker text-muted-2 tabular-nums">{index}</span>
      <span className="kicker">{title}</span>
    </div>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
        {/* Masthead */}
        <header className="animate-fade-up">
          <div className="flex items-center gap-3">
            <span className="kicker">Editorial Intelligence Desk</span>
            <span className="h-px w-10 bg-hairline" />
            <span className="kicker text-muted-2">Foundation v1</span>
          </div>
          <h1 className="display mt-8 max-w-4xl text-balance">
            A design language built to read, not to decorate.
          </h1>
          <p className="standfirst mt-6 max-w-prose text-pretty">
            A base neutra e quente substitui o preto puro. A tipografia carrega
            a hierarquia. A cor existe apenas para comunicar significado, nunca
            para enfeitar.
          </p>
        </header>

        {/* 01 — Surfaces */}
        <section className="mt-24">
          <SectionLabel index="01" title="Surfaces" />
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {surfaces.map((s) => (
              <div
                key={s.token}
                className="rounded-2xl border border-border bg-surface p-1 shadow-card"
              >
                <div
                  className={`${s.cls} h-28 rounded-xl border border-hairline`}
                />
                <div className="px-3 py-3">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-2">
                    <code>{s.token}</code>
                    <code className="tabular-nums">{s.value}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="h-4 w-8 rounded border border-border bg-surface" />
              border · very subtle
            </span>
            <span className="flex items-center gap-2">
              <span className="h-4 w-8 rounded border border-hairline bg-surface" />
              hairline · barely there
            </span>
          </div>
        </section>

        {/* 02 — Text tones */}
        <section className="mt-24">
          <SectionLabel index="02" title="Text tones" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-2xl font-medium text-white">Warm white</p>
              <p className="mt-2 text-sm text-muted-2">Primary · #F5F3EF</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-2xl font-medium text-muted">Soft gray</p>
              <p className="mt-2 text-sm text-muted-2">Secondary · #A8A29E</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-2xl font-medium text-muted-2">Faint gray</p>
              <p className="mt-2 text-sm text-muted-2">Tertiary · #6E6A66</p>
            </div>
          </div>
        </section>

        {/* 03 — Signature accents */}
        <section className="mt-24">
          <SectionLabel index="03" title="Signature accents" />
          <p className="mt-6 max-w-prose text-sm text-muted">
            O DNA da marca permanece, mas agora como assinatura pontual, não
            como pele da interface. Reservado para seleção, foco e destaques
            editoriais.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-6">
              <span
                className="h-14 w-14 rounded-full"
                style={{ background: "var(--purple)" }}
              />
              <div>
                <div className="font-medium">Purple</div>
                <div className="text-sm text-muted-2">Assinatura · seleção</div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-6">
              <span
                className="h-14 w-14 rounded-full"
                style={{ background: "var(--lime)" }}
              />
              <div>
                <div className="font-medium">Lime</div>
                <div className="text-sm text-muted-2">Sinal positivo · alta</div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 — Category system */}
        <section className="mt-24">
          <SectionLabel index="04" title="Category accents · meaning only" />
          <div className="mt-8 flex flex-wrap gap-3">
            {categories.map((c) => (
              <span key={c.key} className={`chip ${c.key}`}>
                <span className="h-1.5 w-1.5 rounded-full cat-dot" />
                {c.label}
              </span>
            ))}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-5 sm:grid-cols-2">
            {categories.map((c) => (
              <div
                key={c.key}
                className={`${c.key} rounded-2xl border border-border bg-surface p-5`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full cat-dot" />
                  <span className="kicker cat">{c.label}</span>
                </div>
                <div className="mt-6 signal-track">
                  <div
                    className="signal-fill"
                    style={{ width: `${c.strength}%` }}
                  />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-muted-2">Signal</span>
                  <span className="text-sm font-medium tabular-nums cat">
                    {c.strength}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 05 — Typography scale */}
        <section className="mt-24">
          <SectionLabel index="05" title="Typography · the primary voice" />
          <div className="mt-10 space-y-10">
            <div className="border-b border-hairline pb-8">
              <span className="kicker text-muted-2">Kicker · Space Grotesk</span>
              <p className="kicker mt-3">Today&apos;s Brief · Weekly Signals</p>
            </div>
            <div className="border-b border-hairline pb-8">
              <span className="kicker text-muted-2">Display · Libre Caslon</span>
              <p className="display mt-3 text-balance">
                Cultura em movimento
              </p>
            </div>
            <div className="border-b border-hairline pb-8">
              <span className="kicker text-muted-2">Headline · Libre Caslon</span>
              <p className="headline mt-3 text-balance">
                O sinal por trás do ruído
              </p>
            </div>
            <div className="border-b border-hairline pb-8">
              <span className="kicker text-muted-2">Standfirst · Inter</span>
              <p className="standfirst mt-3 max-w-prose">
                Um parágrafo de abertura que dá contexto e convida à leitura,
                com respiro e ritmo de publicação.
              </p>
            </div>
            <div className="border-b border-hairline pb-8">
              <span className="kicker text-muted-2">Body · Inter</span>
              <p className="mt-3 max-w-prose leading-relaxed text-muted">
                O corpo de texto prioriza legibilidade acima de tudo: entrelinha
                generosa, medida controlada e contraste calmo. A leitura deve
                parecer uma publicação premium, não um painel.
              </p>
            </div>
            <div>
              <span className="kicker text-muted-2">Pull quote · Libre Caslon</span>
              <p className="pull-quote mt-4 max-w-prose">
                “A interface deve comunicar confiança, não decoração.”
              </p>
            </div>
          </div>
        </section>

        {/* 06 — Narrative module */}
        <section className="mt-24">
          <SectionLabel index="06" title="Narrative structure" />
          <article className="mt-10 grid gap-12 md:grid-cols-[1fr_260px]">
            <div>
              <span className="chip cat-culture">
                <span className="h-1.5 w-1.5 rounded-full cat-dot" />
                Culture
              </span>
              <h2 className="headline mt-5 text-balance">
                Quando o nicho vira norma
              </h2>
              <p className="standfirst mt-5 max-w-prose text-pretty">
                Um comportamento de comunidade migra para o mainstream em
                semanas. O relatório rastreia o arco, da origem ao pico.
              </p>
              <div className="mt-8 space-y-4 max-w-prose leading-relaxed text-muted">
                <p>
                  <span className="kicker text-muted-2">Context</span>
                  <br />O movimento começou em fóruns fechados antes de escalar
                  para plataformas abertas, ganhando tração cultural.
                </p>
                <p>
                  <span className="kicker text-muted-2">Evidence</span>
                  <br />O volume de menções cresceu de forma consistente,
                  sustentado por criadores de médio alcance.
                </p>
              </div>
              <blockquote className="pull-quote mt-10 border-l-2 border-hairline pl-6 max-w-prose">
                “O sinal mais forte não é o pico, é a consistência antes dele.”
              </blockquote>
            </div>
            <aside className="space-y-6">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <span className="kicker text-muted-2">Recommendation</span>
                <p className="mt-3 text-sm leading-relaxed">
                  Ativar antes do pico. A janela de autenticidade fecha rápido.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5">
                <span className="kicker text-muted-2">Sources</span>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  <li>Instagram · 1.2k menções</li>
                  <li>TikTok · 840 vídeos</li>
                  <li>Reddit · 12 threads</li>
                </ul>
              </div>
            </aside>
          </article>
        </section>

        {/* 07 — Motion */}
        <section className="mt-24">
          <SectionLabel index="07" title="Motion · invisible & calm" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="animate-fade-up rounded-2xl border border-border bg-surface p-6">
              <span className="kicker text-muted-2">fade-up</span>
              <p className="mt-3 text-sm text-muted">Entrada de conteúdo.</p>
            </div>
            <div className="animate-blur-in rounded-2xl border border-border bg-surface p-6">
              <span className="kicker text-muted-2">blur-in</span>
              <p className="mt-3 text-sm text-muted">Revelação suave.</p>
            </div>
            <div className="animate-scale-in rounded-2xl border border-border bg-surface p-6">
              <span className="kicker text-muted-2">scale-in</span>
              <p className="mt-3 text-sm text-muted">Foco / seleção.</p>
            </div>
          </div>
        </section>

        <footer className="mt-24 border-t border-hairline pt-8">
          <p className="kicker text-muted-2">
            cccaramelo · Editorial Intelligence Desk · Foundation reference
          </p>
        </footer>
      </div>
    </div>
  );
}
