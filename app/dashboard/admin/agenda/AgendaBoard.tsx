"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Pencil,
  Plus,
  RefreshCw,
  Radio,
  Trash2,
} from "lucide-react";
import type { PulsoCultural } from "@/lib/types";
import type { EstadoLinha } from "@/lib/radar/agendaLinha";
import LinhaDialog, { type TenantOpcao } from "./LinhaDialog";
import { alternarLinha, excluirLinha, reavaliarPerfis, type MudancaPerfil } from "./actions";

export type { TenantOpcao };

export type DominioResumo = {
  dominio: string;
  linhas: { linha: PulsoCultural; estado: EstadoLinha }[];
  vigentes: number;
  assinantes: string[];
};

const ESTADO_META: Record<EstadoLinha, { rotulo: string; classe: string }> = {
  vigente: { rotulo: "no ar", classe: "text-lime border-lime/30 bg-lime/5" },
  futura: { rotulo: "futura", classe: "text-purple-300 border-purple/40 bg-purple/10" },
  encerrada: { rotulo: "encerrada", classe: "text-muted border-border" },
  desligada: { rotulo: "desligada", classe: "text-muted/60 border-border" },
};

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" strokeWidth={2} />
      <div className="text-[13px] text-amber-100/90 leading-relaxed">{children}</div>
    </div>
  );
}

export default function AgendaBoard({
  dominios,
  tenants,
  semPerfil,
  totalMarcas,
}: {
  dominios: DominioResumo[];
  tenants: TenantOpcao[];
  semPerfil: string[];
  totalMarcas: number;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ linha?: PulsoCultural } | null>(null);
  const [reavaliando, setReavaliando] = useState(false);
  const [mudancas, setMudancas] = useState<MudancaPerfil[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const nomes = dominios.map((d) => d.dominio);
  const totalLinhas = dominios.reduce((n, d) => n + d.linhas.length, 0);
  const totalVigentes = dominios.reduce((n, d) => n + d.vigentes, 0);

  async function comLinha(id: string, fn: () => Promise<void>) {
    setErro(null);
    setOcupada(id);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro na operação.");
    } finally {
      setOcupada(null);
    }
  }

  async function handleReavaliar() {
    setErro(null);
    setReavaliando(true);
    try {
      setMudancas(await reavaliarPerfis());
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reavaliar.");
    } finally {
      setReavaliando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2">
          <span className="kicker text-muted-2">Curadoria compartilhada</span>
          <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
            Agenda cultural
          </h1>
          <p className="text-muted text-sm max-w-xl">
            Assuntos que o radar vasculha mesmo quando ninguém citou a marca.
            Curados uma vez, valem para toda marca que assina o domínio — inclusive
            as que ainda não existem. {totalLinhas} linha
            {totalLinhas === 1 ? "" : "s"}, {totalVigentes} no ar hoje.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReavaliar}
            disabled={reavaliando}
            className="inline-flex items-center gap-2 rounded-full border border-border text-muted hover:text-white hover:border-white/20 text-sm font-medium px-4 h-9 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-4 h-4 ${reavaliando ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
            {reavaliando ? "Reavaliando..." : "Reavaliar perfis"}
          </button>
          <button
            type="button"
            onClick={() => setDialog({})}
            className="group inline-flex items-center gap-2 rounded-full bg-purple hover:bg-purple-mid text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            <span className="w-5 h-5 rounded-full bg-lime text-black flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.6} />
            </span>
            Nova linha
          </button>
        </div>
      </div>

      {semPerfil.length > 0 && (
        <Aviso>
          <span className="text-white font-medium">
            {semPerfil.length} de {totalMarcas} marca
            {semPerfil.length === 1 ? "" : "s"} ignora
            {semPerfil.length === 1 ? "" : "m"} a agenda inteira
          </span>{" "}
          ({semPerfil.join(", ")}) — o perfil cultural nunca foi calculado, então
          nenhuma linha desta tela chega até elas. Curar linha antes de resolver
          isso é trabalho que não sai do lugar. Clique em{" "}
          <span className="text-white">Reavaliar perfis</span>.
        </Aviso>
      )}

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
          {erro}
        </p>
      )}

      {mudancas && (
        <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-white text-sm font-medium">
              Reavaliação — {mudancas.filter((m) => m.estado === "mudou").length}{" "}
              de {mudancas.length} mudaram
            </span>
            <button
              type="button"
              onClick={() => setMudancas(null)}
              className="text-muted hover:text-white text-xs transition-colors"
            >
              fechar
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {mudancas.map((m) => (
              <li key={m.marca} className="text-[13px] flex flex-wrap gap-x-2">
                <span
                  className={
                    m.estado === "mudou"
                      ? "text-lime"
                      : m.estado === "erro"
                        ? "text-red-400"
                        : "text-muted"
                  }
                >
                  {m.marca}
                </span>
                <span className="text-muted/70">
                  [{m.antes.join(", ") || "—"}] → [{m.depois.join(", ") || "—"}]
                </span>
                <span className="text-muted/50 basis-full">{m.motivo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dominios.length === 0 ? (
        <div className="rounded-3xl bg-surface border border-border p-10 text-center text-muted text-sm">
          Nenhuma linha na agenda ainda. Crie a primeira — ela vale para todos os
          clientes que assinarem o domínio.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {dominios.map((d) => (
            <section key={d.dominio} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="text-white text-lg font-bold">{d.dominio}</h2>
                <span className="text-muted text-xs">
                  {d.linhas.length} linha{d.linhas.length === 1 ? "" : "s"} ·{" "}
                  {d.vigentes} no ar ·{" "}
                  {d.assinantes.length === 0 ? (
                    <span className="text-amber-400">nenhuma marca assina</span>
                  ) : (
                    `${d.assinantes.join(", ")}`
                  )}
                </span>
              </div>

              {/* Os dois lados de uma curadoria que não roda, separados porque a
                  causa e a correção são opostas: sem linha vigente é problema de
                  janela; sem assinante é problema de perfil de marca. */}
              {d.linhas.length > 0 && d.vigentes === 0 && (
                <Aviso>
                  Todas as linhas de <span className="text-white">{d.dominio}</span>{" "}
                  estão fora de janela hoje. Quem assina este domínio e nenhum
                  outro sai da varredura sem agenda.
                </Aviso>
              )}
              {d.linhas.length === 0 && (
                <Aviso>
                  <span className="text-white">{d.assinantes.join(", ")}</span>{" "}
                  assina{d.assinantes.length === 1 ? "" : "m"}{" "}
                  <span className="text-white">{d.dominio}</span>, mas o domínio
                  não tem nenhuma linha. A vaga fica reservada e volta vazia.
                </Aviso>
              )}

              <ul className="flex flex-col gap-2">
                {d.linhas.map(({ linha, estado }) => {
                  const meta = ESTADO_META[estado];
                  const datada = Boolean(linha.janela_inicio || linha.janela_fim);
                  return (
                    <li
                      key={linha.id}
                      className={`rounded-2xl bg-surface border border-border px-4 py-3 flex items-center gap-3 flex-wrap ${
                        ocupada === linha.id ? "opacity-40" : ""
                      }`}
                    >
                      <span
                        className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg border px-2 py-1 ${meta.classe}`}
                      >
                        {datada ? (
                          <CalendarClock className="w-3.5 h-3.5" strokeWidth={2.2} />
                        ) : (
                          <Radio className="w-3.5 h-3.5" strokeWidth={2.2} />
                        )}
                        {meta.rotulo}
                      </span>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-white text-sm font-medium truncate">
                          {linha.titulo}
                          {linha.tenant_id && (
                            <span className="ml-2 text-purple-300 text-[11px] font-normal">
                              escopo restrito
                            </span>
                          )}
                        </span>
                        <span className="text-muted text-xs truncate">
                          {linha.termos.join(" · ")}
                        </span>
                      </div>

                      <span className="shrink-0 text-muted text-xs tabular-nums">
                        peso {linha.peso} · {linha.pais ?? "universal"}
                        {datada && (
                          <>
                            {" · "}
                            {linha.janela_inicio ?? "…"} a {linha.janela_fim ?? "…"}
                          </>
                        )}
                      </span>

                      <label
                        className="shrink-0 flex items-center gap-2 cursor-pointer"
                        title={linha.ativo ? "Desligar" : "Ligar"}
                      >
                        <input
                          type="checkbox"
                          checked={linha.ativo}
                          disabled={ocupada === linha.id}
                          onChange={(e) =>
                            comLinha(linha.id, () =>
                              alternarLinha(linha.id, e.target.checked)
                            )
                          }
                          className="w-4 h-4 rounded accent-lime"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setDialog({ linha })}
                        aria-label="Editar linha"
                        className="shrink-0 text-muted hover:text-white transition-colors"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={2} />
                      </button>

                      <button
                        type="button"
                        disabled={ocupada === linha.id}
                        onClick={() => {
                          if (
                            !confirm(
                              `Excluir "${linha.titulo}"? Marcas que assinam ${d.dominio} perdem esta linha na próxima varredura.`
                            )
                          )
                            return;
                          comLinha(linha.id, () => excluirLinha(linha.id));
                        }}
                        aria-label="Excluir linha"
                        className="shrink-0 text-muted hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <LinhaDialog
        key={dialog?.linha?.id ?? "nova"}
        linha={dialog?.linha}
        dominiosExistentes={nomes}
        tenants={tenants}
        aberto={dialog !== null}
        onFechar={() => setDialog(null)}
      />
    </div>
  );
}
