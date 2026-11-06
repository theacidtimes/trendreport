import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Meme, Tendencia, TrendReport } from "@/lib/types";
import { PLATFORM_ICON, PLATFORM_LABEL } from "@/lib/platforms";
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

function ParaMarca({ rotulo = "Para a marca", children }: { rotulo?: string; children: ReactNode }) {
  return (
    <div className="mt-10 bg-surface-2 px-5 md:px-10 py-7 grid gap-2 md:grid-cols-[180px_1fr] md:gap-10 md:items-baseline">
      <span className="kicker text-lime">{rotulo}</span>
      <p className="font-serif text-white text-xl md:text-2xl leading-snug max-w-[60ch]">{children}</p>
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

function CapituloTendencia({
  t,
  n,
  total,
  proximo,
  id,
}: {
  t: Tendencia;
  n: number;
  total: number;
  proximo?: Capitulo;
  id: string;
}) {
  const vertical = t.plataforma === "tiktok";
  // Foto grande só quando ela é do post (ou há vídeo pra tocar). Post só de
  // texto, como tweet e notícia sem imagem, vai pro bentô: abrir o capítulo
  // com uma ilustração da equipe faria parecer que ela veio do post.
  const ilustracao = imagemSubidaAMao(t.imagem_url) ? (t.imagem_url ?? null) : null;
  const temMidia = Boolean((t.imagem_url && !ilustracao) || urlDoPlayer(t.post_url));
  return (
    <section id={id} className="scroll-mt-20 pt-20 md:pt-32">
      <Abertura
        n={n}
        total={total}
        rotulo="Tendência"
        titulo={t.titulo}
        extra={<span className="text-muted">· {STATUS_LABEL[t.status]}</span>}
      />
      {!temMidia ? (
        <BentoSemImagem t={t} ilustracao={ilustracao} />
      ) : vertical ? (
        <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14 items-start">
          <div className="max-w-[380px] w-full">
            <PostMedia
              imagem={t.imagem_url}
              postUrl={t.post_url}
              plataforma={t.plataforma}
              autor={t.autor}
              alt={t.titulo}
              formato="vertical"
            />
          </div>
          <p className="text-standfirst text-white/85 max-w-prose m-0">{t.descricao}</p>
        </div>
      ) : (
        <>
          <div className="mb-10">
            <PostMedia
              imagem={t.imagem_url}
              postUrl={t.post_url}
              plataforma={t.plataforma}
              autor={t.autor}
              alt={t.titulo}
            />
          </div>
          <p className="text-standfirst text-white/85 max-w-prose m-0">{t.descricao}</p>
        </>
      )}
      {temMidia && <ParaMarca>{t.gancho_produto}</ParaMarca>}
      <ASeguir cap={proximo} />
    </section>
  );
}

function BentoSemImagem({ t, ilustracao }: { t: Tendencia; ilustracao: string | null }) {
  const Icone = t.plataforma ? PLATFORM_ICON[t.plataforma] : null;
  const temFonte = Boolean(t.autor || t.post_url);
  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-6">
      {temFonte && (
        <div className="md:col-span-2 bg-surface border border-border p-6 flex flex-col gap-3">
          <span className="kicker text-muted flex items-center gap-2">
            {Icone && <Icone className="w-4 h-4" strokeWidth={1.8} />}
            Post original{t.plataforma ? ` · ${PLATFORM_LABEL[t.plataforma]}` : ""}
          </span>
          {t.autor && <span className="font-serif text-2xl leading-tight text-white break-words">{t.autor}</span>}
          {t.post_url && (
            <a
              href={t.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex items-center gap-1.5 w-fit border border-border rounded-full px-4 py-2 kicker text-white hover:border-lime hover:text-lime transition-colors"
            >
              Ver post original
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </a>
          )}
        </div>
      )}
      <div className={`${temFonte ? "md:col-span-4" : "md:col-span-6"} bg-surface border border-border p-6 md:p-8`}>
        <p className="text-standfirst text-white/85 m-0 max-w-prose">{t.descricao}</p>
      </div>
      {ilustracao && (
        <figure className="md:col-span-2 m-0 bg-surface border border-border p-3 flex flex-col">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
            <SmartImage src={ilustracao} alt={t.titulo} className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <figcaption className="kicker text-muted-2 pt-3">Imagem ilustrativa</figcaption>
        </figure>
      )}
      <div
        className={`${ilustracao ? "md:col-span-4" : "md:col-span-6"} bg-surface-2 p-6 md:p-10 flex flex-col gap-3 justify-center`}
      >
        <span className="kicker text-lime">Para a marca</span>
        <p className="font-serif text-white text-xl md:text-3xl leading-snug m-0 max-w-[40ch]">{t.gancho_produto}</p>
      </div>
    </div>
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
    ...(vozes.length ? [{ id: "vozes", titulo: "Vozes reais" }] : []),
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
  const doPost = (u?: string) => Boolean(u && !imagemSubidaAMao(u));
  const capa = tendencias.find((t) => doPost(t.imagem_url)) ?? memes.find((m) => doPost(m.imagem_url));
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
                <div className="relative aspect-[4/3] lg:aspect-[4/5] max-h-[60vh] lg:max-h-none overflow-hidden bg-surface-2">
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

          {/* EM NÚMEROS */}
          <div className="mt-12 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface border border-border p-5 flex flex-col gap-2">
              <span className="kicker text-muted">Índice de hype</span>
              <span className="font-serif text-5xl leading-none tabular-nums">{hype}</span>
              <span className="block h-2 bg-surface-3 mt-2">
                <span className="block h-full bg-lime" style={{ width: `${hype}%` }} />
              </span>
            </div>
            <div className="bg-surface border border-border p-5 flex flex-col gap-2 lg:col-span-2">
              <span className="kicker text-muted">Próximo gatilho</span>
              <span className="font-serif text-2xl md:text-3xl leading-tight">{meta.proximo_gatilho.evento}</span>
              <span className="text-sm text-lime">
                {meta.proximo_gatilho.data} · {meta.proximo_gatilho.destaque}
              </span>
            </div>
            <div className="bg-surface border border-border p-5 flex flex-col gap-2">
              <span className="kicker text-muted">Neste report</span>
              <span className="font-serif text-5xl leading-none tabular-nums">{tendencias.length}</span>
              <span className="text-sm text-muted">
                tendências{memes.length ? `, ${memes.length} memes` : ""}
                {totalSinais ? ` · ${totalSinais} sinais lidos` : ""}
              </span>
            </div>
          </div>

          {/* SUMÁRIO */}
          {total > 0 && (
            <nav className="mt-14" aria-label="Sumário">
              <p className="kicker text-muted mb-3">Neste report</p>
              <ol className="border-t border-border grid md:grid-cols-2 md:gap-x-10">
                {capitulos.map((c, i) => (
                  <li key={c.id} className="border-b border-border">
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
          return <CapituloTendencia key={id} id={id} t={t} n={pos(id) + 1} total={total} proximo={depois(id)} />;
        })}

        {/* MEMES */}
        {memes.length > 0 && (
          <section id="memes" className="scroll-mt-20 pt-20 md:pt-32">
            <Abertura
              n={pos("memes") + 1}
              total={total}
              rotulo="Linguagem da internet"
              titulo="Memes em alta"
              sub="A linguagem que está circulando agora e que a social media pode levar para o copy."
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
              titulo="Vozes reais"
              sub="O que as pessoas estão dizendo, com link para cada post."
            />
            <div className="grid md:grid-cols-2 gap-x-10">
              {vozes.map((v, i) => (
                <blockquote key={i} className="m-0 border-t border-border py-6 flex flex-col gap-3">
                  <p className="font-serif text-xl md:text-2xl leading-snug text-white">“{v.texto}”</p>
                  <footer className="text-xs text-muted flex flex-wrap gap-x-3 items-center">
                    <span className="text-white/80">{v.autor}</span>
                    <span>{PLATFORM_LABEL[v.plataforma]}</span>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-lime underline underline-offset-4 hover:text-white"
                    >
                      Ver post
                      <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
                    </a>
                  </footer>
                </blockquote>
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
            <ol className="border-t-2 border-white">
              {oportunidades.map((o, i) => (
                <li key={i} className="border-b border-border py-6 grid gap-2 md:grid-cols-[64px_220px_1fr] md:gap-8">
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
