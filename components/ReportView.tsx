import type { ReactNode } from "react";
import { ArrowUpRight, CalendarClock, Flame, Radio, Snowflake, Sparkles, Waves } from "lucide-react";
import type { Meme, MetricaTendencia, Tendencia, TrendReport } from "@/lib/types";
import { PLATFORM_ICON, PLATFORM_LABEL } from "@/lib/platforms";
import HypeGauge from "./HypeGauge";
import { ShineBorder } from "./ui/shine-border";
import CopyBlock from "./CopyBlock";
import InsightCard from "./InsightCard";
import GlossaryPanel from "./GlossaryPanel";
import NetworkRadar from "./NetworkRadar";
import DataSourceTracker from "./DataSourceTracker";
import BriefingRecap from "./BriefingRecap";
import Logo from "./Logo";
import SmartImage from "./SmartImage";
import ReportHeader, { type Capitulo } from "./report/ReportHeader";
import PostMedia from "./report/PostMedia";
import { imagemSubidaAMao, urlDoPlayer } from "@/lib/reportMidia";

// Formato revista: capa, header fixo com índice, um capítulo por tendência com
// foto grande (ou vídeo pelo player da rede) e o fechamento com oportunidades,
// copy e o acervo de fontes. Fontes e cores são as do app (e do tenant).

const STATUS_LABEL: Record<Tendencia["status"], string> = {
  em_alta: "Em alta",
  subindo: "Subindo",
  estabilizando: "Estabilizando",
  esfriando: "Esfriando",
};

const STATUS_ICON: Record<Tendencia["status"], typeof Flame> = {
  em_alta: Flame,
  subindo: Waves,
  estabilizando: Waves,
  esfriando: Snowflake,
};

// Número grande no degradê roxo do dashboard (o "48" dos drops da semana).
const NUMERO_ROXO = {
  backgroundImage: "linear-gradient(160deg, var(--purple) 0%, var(--purple-mid) 60%, #181818 100%)",
} as const;

const nn = (i: number) => String(i).padStart(2, "0");

function Abertura({
  n,
  total,
  rotulo,
  titulo,
  sub,
  extra,
}: {
  n: number;
  total: number;
  rotulo: string;
  titulo: string;
  sub?: string;
  extra?: ReactNode;
}) {
  return (
    <header className="border-t-2 border-white pt-4 mb-10 md:mb-14">
      <p className="kicker text-white flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-8 md:mb-12">
        <span className="text-lime tabular-nums">{nn(n)}</span>
        <span>{rotulo}</span>
        <span className="text-muted-2">de {total}</span>
        {extra}
      </p>
      <h2 className="font-serif font-medium text-white text-headline max-w-[22ch] text-balance">{titulo}</h2>
      {sub && <p className="mt-4 text-standfirst text-muted max-w-prose text-pretty">{sub}</p>}
    </header>
  );
}

function StatusTag({ status }: { status: Tendencia["status"] }) {
  const Icone = STATUS_ICON[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${status === "em_alta" ? "bg-lime text-black" : "border border-white/20 text-white/70"}`}>
      <Icone className="w-3 h-3" strokeWidth={2.5} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// Fecho do capítulo, em roxo: é a voz de quem assina o report, separada da
// evidência das redes. Reports novos (versao_formato 2) trazem leitura, não ideia.
function PorQueImporta({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="mt-10 rounded-3xl bg-purple-mid text-white px-6 md:px-10 py-6 md:py-8 grid gap-3 md:grid-cols-[200px_1fr] md:gap-10 md:items-baseline shadow-card">
      <span className="kicker text-lime inline-flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
        {rotulo}
      </span>
      <p className="font-serif text-lg md:text-xl leading-snug max-w-[62ch] m-0">{children}</p>
    </div>
  );
}

function ASeguir({ cap }: { cap?: Capitulo }) {
  if (!cap) return null;
  return (
    <p className="mt-16 border-t border-border">
      <a
        href={`#${cap.id}`}
        className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 py-4 text-white no-underline"
      >
        <span className="kicker text-muted-2">A seguir</span>
        <span className="font-serif text-lg group-hover:text-lime transition-colors">{cap.titulo}</span>
        <span className="text-lime">→</span>
      </a>
    </p>
  );
}

const PLATAFORMAS_DE_TEXTO = new Set(["twitter", "reddit", "news"]);

// Imagem que conta como evidência do post. Em rede de texto, imagem subida no
// editor é ilustração da equipe e não entra; em Instagram/TikTok ela costuma
// ser a própria imagem do post re-subida porque o CDN expirou.
function imagemDoPost(t: Tendencia | Meme): string | null {
  if (!t.imagem_url) return null;
  if (imagemSubidaAMao(t.imagem_url) && t.plataforma && PLATAFORMAS_DE_TEXTO.has(t.plataforma)) return null;
  return t.imagem_url;
}

// Reports anteriores à citacao estruturada: o modelo costumava citar o post
// entre aspas dentro da descrição. Melhor isso do que capítulo sem voz.
function citacaoDaDescricao(descricao: string): string | null {
  const m = descricao.match(/['"“‘]([^'"”’]{25,220})['"”’]/);
  return m ? m[1].trim() : null;
}

function Fonte({ t, claro = false }: { t: Tendencia; claro?: boolean }) {
  if (!t.autor && !t.post_url) return null;
  return (
    <p className={`mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${claro ? "text-black/60" : "text-muted"}`}>
      {t.autor && <span className={claro ? "text-black font-medium" : "text-white/80"}>{t.autor}</span>}
      {t.plataforma && <span>{PLATFORM_LABEL[t.plataforma]}</span>}
      {t.post_url && (
        <a
          href={t.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 underline underline-offset-4 ${
            claro ? "text-black hover:text-purple" : "text-lime hover:text-white"
          }`}
        >
          Ver post original
          <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
        </a>
      )}
    </p>
  );
}

function Metrica({ m, grande = false }: { m: MetricaTendencia; grande?: boolean }) {
  return (
    <div className={grande ? "rounded-3xl bg-black border border-border p-6 md:p-10 shadow-card" : "rounded-3xl bg-surface border border-border p-5 shadow-card"}>
      <span
        className={`block font-serif font-medium leading-none tabular-nums text-transparent bg-clip-text ${grande ? "text-[clamp(4rem,12vw,8rem)]" : "text-5xl"}`}
        style={NUMERO_ROXO}
      >
        {m.valor}
      </span>
      <span className={`block mt-3 text-muted ${grande ? "text-lg max-w-[40ch]" : "text-sm max-w-[28ch]"}`}>{m.rotulo}</span>
    </div>
  );
}

// Três moldes, escolhidos pelo que o post tem de evidência: Foto (imagem ou
// vídeo do post), Voz (frase do post em papel claro) e Número (métrica grande).
// Sem nenhum dos três, o capítulo é só texto. Nunca ilustração.
function CapituloTendencia({
  t,
  n,
  total,
  proximo,
  id,
  rotuloImporta,
}: {
  t: Tendencia;
  n: number;
  total: number;
  proximo?: Capitulo;
  id: string;
  rotuloImporta: string;
}) {
  const foto = imagemDoPost(t);
  const temFoto = Boolean(foto || urlDoPlayer(t.post_url));
  const citacao = t.citacao || citacaoDaDescricao(t.descricao);
  const molde = temFoto ? "foto" : citacao ? "voz" : t.metrica ? "numero" : "texto";
  const vertical = t.plataforma === "tiktok";
  const IconeRede = t.plataforma ? PLATFORM_ICON[t.plataforma] : null;

  const texto = (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_220px] md:gap-14 items-start">
      <p className="text-standfirst text-white/85 max-w-prose m-0">{t.descricao}</p>
      {t.metrica && molde !== "numero" && <Metrica m={t.metrica} />}
    </div>
  );

  return (
    <section id={id} className="scroll-mt-20 pt-20 md:pt-32">
      <Abertura
        n={n}
        total={total}
        rotulo="Tendência"
        titulo={t.titulo}
        extra={<StatusTag status={t.status} />}
      />

      {molde === "foto" && vertical && (
        <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14 items-start">
          <div className="max-w-[380px] w-full">
            <PostMedia imagem={foto} postUrl={t.post_url} plataforma={t.plataforma} autor={t.autor} alt={t.titulo} formato="vertical" />
          </div>
          <div className="flex flex-col gap-8">
            <p className="text-standfirst text-white/85 max-w-prose m-0">{t.descricao}</p>
            {t.metrica && <Metrica m={t.metrica} />}
          </div>
        </div>
      )}

      {molde === "foto" && !vertical && (
        <>
          <div className="mb-10">
            <PostMedia imagem={foto} postUrl={t.post_url} plataforma={t.plataforma} autor={t.autor} alt={t.titulo} />
          </div>
          {texto}
        </>
      )}

      {molde === "voz" && (
        <>
          <figure className="m-0 mb-10 rounded-3xl bg-white text-black px-6 py-10 md:px-16 md:py-16 shadow-card">
            <span className="kicker text-black/50 mb-6 inline-flex items-center gap-2">
              {IconeRede && <IconeRede className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />}
              {t.plataforma ? `Direto do ${PLATFORM_LABEL[t.plataforma]}` : "Direto da fonte"}
            </span>
            <blockquote className="m-0 font-serif text-[clamp(1.6rem,4vw,2.9rem)] leading-[1.15] tracking-[-0.01em] max-w-[30ch] text-balance">
              “{citacao}”
            </blockquote>
            <Fonte t={t} claro />
          </figure>
          {texto}
        </>
      )}

      {molde === "numero" && t.metrica && (
        <>
          <div className="mb-10">
            <Metrica m={t.metrica} grande />
            <Fonte t={t} />
          </div>
          <p className="text-standfirst text-white/85 max-w-prose m-0">{t.descricao}</p>
        </>
      )}

      {molde === "texto" && (
        <>
          {texto}
          <Fonte t={t} />
        </>
      )}

      <PorQueImporta rotulo={rotuloImporta}>{t.gancho_produto}</PorQueImporta>
      <ASeguir cap={proximo} />
    </section>
  );
}

function MemeItem({ m }: { m: Meme }) {
  return (
    <article className="break-inside-avoid mb-8 border-t border-border pt-4">
      {(m.imagem_url || m.post_url) && (
        <div className="mb-4">
          <PostMedia
            imagem={m.imagem_url}
            postUrl={m.post_url}
            plataforma={m.plataforma}
            autor={m.autor}
            alt={m.titulo}
            formato="vertical"
          />
        </div>
      )}
      <p className="kicker text-muted-2 mb-2">{STATUS_LABEL[m.status]}</p>
      <h3 className="font-serif text-white text-2xl leading-tight mb-2">{m.titulo}</h3>
      <p className="text-sm text-white/75 leading-relaxed mb-3">{m.descricao}</p>
      <p className="font-serif italic text-lime text-lg leading-snug">“{m.linguagem}”</p>
    </article>
  );
}

export default function ReportView({
  report,
  geradoEm,
  standalone = true,
  briefing,
  logoUrl,
  displayName,
}: {
  report: TrendReport;
  geradoEm?: string;
  standalone?: boolean;
  briefing?: Record<string, unknown> | string | null;
  // Marca white-label do tenant dono do report (Fase 4E). No /r/[slug] publico
  // resolvidos server-side via rpc branding_do_report. Ausentes = fallback ACID.
  logoUrl?: string;
  displayName?: string;
}) {
  const { meta, tendencias = [], memes = [], oportunidades = [], copy = [], radar, insights, glossario, fontes } =
    report;

  const vozes = (radar ?? [])
    .flatMap((item) =>
      (item.sinais ?? [])
        .filter((s) => s.autor && s.url)
        .map((s) => ({ plataforma: item.plataforma, autor: s.autor as string, texto: s.tema, url: s.url as string }))
    )
    .slice(0, 6);

  // Ordem dos capítulos = ordem da página. O índice do header sai daqui.
  const capitulos: Capitulo[] = [
    ...tendencias.map((t, i) => ({ id: `tendencia-${i + 1}`, titulo: t.titulo })),
    ...(memes.length ? [{ id: "memes", titulo: "Memes em alta" }] : []),
    ...(vozes.length ? [{ id: "vozes", titulo: "Posts em destaque" }] : []),
    ...(oportunidades.length ? [{ id: "oportunidades", titulo: `Oportunidades para ${meta.produto}` }] : []),
    ...(copy.length ? [{ id: "angulos", titulo: "Ângulos rápidos" }] : []),
    ...(insights?.length ? [{ id: "insights", titulo: "Insights criativos" }] : []),
    ...(glossario?.length ? [{ id: "glossario", titulo: "Glossário do momento" }] : []),
    ...((radar?.length || fontes) ? [{ id: "fontes", titulo: "Radar e fontes" }] : []),
  ];
  const total = capitulos.length;
  const pos = (id: string) => capitulos.findIndex((c) => c.id === id);
  const depois = (id: string) => capitulos[pos(id) + 1];

  // Capa só com imagem que veio de um post; ilustração da equipe não abre o report.
  const capaItem = [...tendencias, ...memes].find((t) => imagemDoPost(t));
  const capa = capaItem ? { ...capaItem, imagem_url: imagemDoPost(capaItem) ?? undefined } : undefined;
  const rotuloImporta = (meta.versao_formato ?? 1) >= 2 ? "Por que importa" : "Para a marca";
  const totalSinais = fontes ? Object.values(fontes).reduce((s, v) => s + (v ?? 0), 0) : 0;
  const hype = Math.max(0, Math.min(100, meta.indice_hype ?? 0));

  return (
    <div id="report-raiz" className="bg-bg font-body text-white">
      <ReportHeader
        capitulos={capitulos}
        cliente={meta.cliente}
        edicao={meta.edicao}
        standalone={standalone}
        logoUrl={logoUrl}
        displayName={displayName}
      />

      <main className="max-w-6xl mx-auto px-5 md:px-10">
        {/* CAPA */}
        <section id="topo" className="scroll-mt-20 pt-10 md:pt-20">
          <div className={`grid gap-10 ${capa ? "lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16" : ""}`}>
            <div>
              {meta.cor_marca && (
                <span className="block h-1.5 w-20 mb-6" style={{ backgroundColor: meta.cor_marca }} aria-hidden />
              )}
              <p className="kicker text-muted mb-6">
                Trend report · {meta.edicao}
              </p>
              <h1 className="font-serif font-medium text-display text-white text-balance mb-6">
                {meta.titulo_social || `Trends · ${meta.cliente}`}
              </h1>
              <p className="text-standfirst text-white/75 max-w-[44ch] mb-6">{meta.hype_motivo}</p>
              <p className="text-xs text-muted border-t border-border pt-3 max-w-[44ch] flex flex-wrap gap-x-3">
                <span>{meta.cliente}</span>
                <span>· {meta.produto}</span>
                {geradoEm && <span>· gerado em {geradoEm}</span>}
              </p>
            </div>
            {capa && (
              <figure className="m-0">
                <div className="relative aspect-[4/3] lg:aspect-[4/5] max-h-[60vh] lg:max-h-none overflow-hidden rounded-3xl bg-surface-2">
                  <SmartImage
                    src={capa.imagem_url}
                    alt={capa.titulo}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <figcaption className="mt-2 pt-2 border-t border-border text-xs text-muted">
                  {capa.titulo}
                  {capa.autor && ` · ${capa.autor}`}
                </figcaption>
              </figure>
            )}
          </div>

          {briefing && (
            <div className="mt-12">
              <BriefingRecap briefing={briefing} />
            </div>
          )}

          {/* EM NÚMEROS: mesmo bentô do Pulso ao vivo do dashboard */}
          <div className="mt-12 grid gap-4 grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="sm:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-2 via-surface to-black p-7 flex flex-col gap-3 shadow-card">
                <ShineBorder borderWidth={1.5} duration={12} shineColor={["var(--purple)", "var(--lime)"]} />
                <span className="kicker text-purple/70 inline-flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 shrink-0" strokeWidth={2} />
                  Próximo gatilho
                </span>
                <span className="font-serif text-purple text-2xl md:text-3xl leading-tight">{meta.proximo_gatilho.evento}</span>
                <span className="text-sm text-white/70">
                  {meta.proximo_gatilho.data} · {meta.proximo_gatilho.destaque}
                </span>
              </div>
              <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem] shadow-card">
                <span className="kicker text-muted-2 inline-flex items-center gap-2">
                  <Radio className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                  Sinais lidos
                </span>
                <div>
                  <span className="block font-serif text-5xl leading-none tabular-nums">
                    {totalSinais ? totalSinais.toLocaleString("pt-BR") : "—"}
                  </span>
                  <span className="block mt-2 text-sm text-muted">posts, vídeos e notícias desta edição</span>
                </div>
              </div>
              <div className="rounded-3xl bg-black border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem] shadow-card">
                <span className="kicker text-muted-2">Neste report</span>
                <div>
                  <span
                    className="block font-serif font-medium text-7xl leading-none tabular-nums text-transparent bg-clip-text"
                    style={NUMERO_ROXO}
                  >
                    {tendencias.length}
                  </span>
                  <span className="block mt-2 text-sm text-muted">
                    tendências{memes.length ? ` e ${memes.length} memes` : ""}
                  </span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 rounded-3xl bg-surface border border-border p-6 flex flex-col gap-2 min-h-[16rem] shadow-card">
              <span className="kicker text-muted-2">Índice de hype</span>
              <div className="flex-1 flex items-center justify-center">
                <HypeGauge value={hype} />
              </div>
            </div>
          </div>

          {/* SUMÁRIO */}
          {total > 0 && (
            <nav className="mt-14" aria-label="Sumário">
              <p className="kicker text-muted mb-3">Neste report</p>
              <ol className="rounded-3xl bg-surface border border-border px-6 py-2 grid md:grid-cols-2 md:gap-x-10 shadow-card">
                {capitulos.map((c, i) => (
                  <li key={c.id} className="border-b border-border last:border-b-0 md:[&:nth-last-child(2)]:border-b-0">
                    <a
                      href={`#${c.id}`}
                      className="flex gap-4 items-baseline py-3 text-white hover:text-lime transition-colors"
                    >
                      <span className="font-sans text-xs text-lime tabular-nums w-6 shrink-0">{nn(i + 1)}</span>
                      <span className="font-serif text-lg leading-snug">{c.titulo}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </section>

        {/* TENDÊNCIAS: um capítulo cada */}
        {tendencias.map((t, i) => {
          const id = `tendencia-${i + 1}`;
          return <CapituloTendencia key={id} id={id} t={t} n={pos(id) + 1} total={total} proximo={depois(id)} rotuloImporta={rotuloImporta} />;
        })}

        {/* MEMES */}
        {memes.length > 0 && (
          <section id="memes" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("memes") + 1}
              total={total}
              rotulo="Linguagem da internet"
              titulo="Memes em alta"
              sub="A linguagem que está circulando agora nas redes."
            />
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-8">
              {memes.map((m, i) => (
                <MemeItem key={i} m={m} />
              ))}
            </div>
            <ASeguir cap={depois("memes")} />
          </section>
        )}

        {/* VOZES REAIS */}
        {vozes.length > 0 && (
          <section id="vozes" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("vozes") + 1}
              total={total}
              rotulo="Direto da fonte"
              titulo="Posts em destaque"
              sub="Os posts por trás da leitura, com link para cada um."
            />
            {/* O tema do radar é resumo do modelo, não fala do post: sem aspas. */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vozes.map((v, i) => (
                <article key={i} className="m-0 rounded-3xl bg-white text-black p-6 flex flex-col gap-4 shadow-card">
                  <span className="kicker text-black/50 inline-flex items-center gap-2">
                    {(() => {
                      const Icone = PLATFORM_ICON[v.plataforma];
                      return <Icone className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />;
                    })()}
                    {PLATFORM_LABEL[v.plataforma]}
                  </span>
                  <p className="font-serif text-xl leading-snug m-0">{v.texto}</p>
                  <footer className="mt-auto text-xs text-black/60 flex flex-wrap gap-x-3 items-center">
                    <span className="text-black font-medium">{v.autor}</span>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-black underline underline-offset-4 hover:text-purple"
                    >
                      Ver post
                      <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
                    </a>
                  </footer>
                </article>
              ))}
            </div>
            <ASeguir cap={depois("vozes")} />
          </section>
        )}

        {/* OPORTUNIDADES */}
        {oportunidades.length > 0 && (
          <section id="oportunidades" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("oportunidades") + 1}
              total={total}
              rotulo="Onde a marca entra"
              titulo={`Oportunidades para ${meta.produto}`}
            />
            <ol className="grid gap-3">
              {oportunidades.map((o, i) => (
                <li key={i} className="rounded-3xl bg-surface border border-border p-6 grid gap-2 md:grid-cols-[64px_220px_1fr] md:gap-8 shadow-card">
                  <span className="font-serif text-3xl text-lime leading-none tabular-nums">{i + 1}</span>
                  <span className="kicker text-muted md:pt-2">{o.label}</span>
                  <div>
                    <h3 className="font-serif text-2xl leading-tight text-white mb-2">{o.titulo}</h3>
                    <p className="text-white/75 leading-relaxed max-w-prose m-0">{o.descricao}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ASeguir cap={depois("oportunidades")} />
          </section>
        )}

        {/* ÂNGULOS RÁPIDOS */}
        {copy.length > 0 && (
          <section id="angulos" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("angulos") + 1}
              total={total}
              rotulo="Ponto de partida pra criação"
              titulo="Ângulos rápidos"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {copy.map((c, i) => (
                <CopyBlock key={i} copy={c} />
              ))}
            </div>
            <ASeguir cap={depois("angulos")} />
          </section>
        )}

        {/* INSIGHTS */}
        {insights && insights.length > 0 && (
          <section id="insights" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("insights") + 1}
              total={total}
              rotulo="Leitura semântica"
              titulo="Insights criativos"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.map((ins, i) => (
                <InsightCard key={i} insight={ins} index={i + 1} />
              ))}
            </div>
            <ASeguir cap={depois("insights")} />
          </section>
        )}

        {/* GLOSSÁRIO */}
        {glossario && glossario.length > 0 && (
          <section id="glossario" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("glossario") + 1}
              total={total}
              rotulo="Vocabulário que mais apareceu"
              titulo="Glossário do momento"
            />
            <GlossaryPanel termos={glossario} />
            <ASeguir cap={depois("glossario")} />
          </section>
        )}

        {/* RADAR E FONTES */}
        {(radar?.length || fontes) && (
          <section id="fontes" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("fontes") + 1}
              total={total}
              rotulo="Acervo"
              titulo="Radar e fontes"
              sub="O que cada rede está falando e de onde vieram os sinais deste report."
            />
            {fontes && (
              <div className="mb-10">
                <DataSourceTracker fontes={fontes} />
              </div>
            )}
            {radar && radar.length > 0 && <NetworkRadar radar={radar} />}
          </section>
        )}
      </main>

      {/* ASSINATURA */}
      <footer className="mt-24 border-t-2 border-white">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 flex flex-wrap items-center gap-4 justify-between">
          <span className="flex items-center gap-3">
            <Logo size="sm" logoUrl={logoUrl} displayName={displayName} />
          </span>
          <span className="kicker text-muted">
            {meta.cliente} · {meta.edicao}
          </span>
        </div>
      </footer>
    </div>
  );
}
