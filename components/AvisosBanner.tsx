"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Wrench, X, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Banner sticky no topo do workspace. Segunda linha de defesa: o CreditTicker (pill
// de canto) já avisa em tempo real quando os créditos caem/zeram. Este banner NÃO
// repete esse aviso na hora — ele escalona. Só aparece quando o tenant fica parado
// no limite por >=24h sem ninguém resolver, aí sobe com "o volume do plano chegou no
// limite" e uma ação clara. Também cobre avisos globais de manutenção.
//
// O relógio das 24h é do TENANT, não do navegador: vem da rpc credito_limite_desde()
// (início da sequência atual de saldo esgotado, derivado do creditos_ledger). Assim,
// trocar de máquina ou limpar o cache não zera a contagem.
//
// Fontes (aditivo, sem migração de schema):
//  - Limite: rpc credito_resumo() + credito_limite_desde() — resolvidas por tenant.
//  - Manutenção: env NEXT_PUBLIC_AVISO_MANUTENCAO (texto). Vazio = sem aviso.

type Resumo = { saldo: number; creditado: number; consumido: number };

const DISMISS_KEY = "avisos_dismiss";
const MANUTENCAO = (process.env.NEXT_PUBLIC_AVISO_MANUTENCAO || "").trim();
// Janela de escalonamento: 24h no limite antes do banner subir. O ticker cobre o resto.
const LIMITE_ESCALONA_MS = 24 * 60 * 60 * 1000;

const EMAIL_CONTRATO = "contato@theacidtimes.com";
const MAILTO = `mailto:${EMAIL_CONTRATO}?subject=${encodeURIComponent(
  "Revisão de contrato — volume do plano no limite",
)}&body=${encodeURIComponent(
  "Olá, o volume do nosso plano chegou ao limite e o radar está pausado. Gostaríamos de revisar o contrato para ampliar o volume. Podem nos ajudar?",
)}`;

// Hash curto e estável pra assinar a mensagem de manutenção: trocar o texto re-exibe
// o banner mesmo pra quem já tinha descartado o anterior.
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function lerDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

type Aviso = {
  sig: string;
  icone: typeof AlertTriangle;
  texto: string;
  acaoLimite?: boolean; // liga o CTA de contrato (admin) / nota (não-admin)
};

export default function AvisosBanner() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [limiteDesde, setLimiteDesde] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(lerDismissed());
    let ativo = true;
    const supabase = createClient();
    supabase.rpc("credito_resumo").then(({ data, error }) => {
      if (!ativo || error) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setResumo(row as Resumo);
    });
    supabase.rpc("credito_limite_desde").then(({ data, error }) => {
      if (!ativo || error) return;
      setLimiteDesde((data as string | null) ?? null);
    });
    Promise.all([
      supabase.rpc("sou_admin_do_meu_tenant"),
      supabase.rpc("is_acid_admin"),
    ]).then(([a, b]) => {
      if (ativo) setIsAdmin(a.data === true || b.data === true);
    });
    return () => {
      ativo = false;
    };
  }, []);

  // Lista de avisos ativos, em ordem de prioridade. O primeiro não descartado ganha.
  const avisos: Aviso[] = [];

  // Escalonamento do limite: só quando esgotado E parado assim há >=24h (relógio do
  // tenant). Abaixo disso o ticker de canto é suficiente — não duplicamos.
  if (resumo && resumo.saldo <= 0 && limiteDesde) {
    const decorrido = Date.now() - new Date(limiteDesde).getTime();
    if (decorrido >= LIMITE_ESCALONA_MS) {
      avisos.push({
        sig: `limite:${limiteDesde}`,
        icone: AlertTriangle,
        texto: "O volume do plano chegou ao limite. A varredura do radar está pausada.",
        acaoLimite: true,
      });
    }
  }

  if (MANUTENCAO) {
    avisos.push({
      sig: `manutencao:${hash(MANUTENCAO)}`,
      icone: Wrench,
      texto: MANUTENCAO,
    });
  }

  const aviso = avisos.find((a) => !dismissed.has(a.sig));
  if (!aviso) return null;

  const descartar = () => {
    const proximo = new Set(dismissed);
    proximo.add(aviso.sig);
    setDismissed(proximo);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(proximo)));
    } catch {
      /* localStorage indisponível: descarta só nesta sessão */
    }
  };

  const Icone = aviso.icone;

  return (
    <div
      role="status"
      className="relative md:sticky md:top-0 z-50 md:ml-20 print:hidden bg-white text-black border-b border-black/10 shadow-elevated"
    >
      <div className="flex items-center gap-3 px-5 md:px-6 py-2.5 md:pr-44">
        <Icone className="w-4 h-4 shrink-0 text-black" strokeWidth={2.2} />
        <p className="text-xs md:text-sm leading-snug text-black">{aviso.texto}</p>
        {aviso.acaoLimite &&
          (isAdmin ? (
            <a
              href={MAILTO}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs md:text-sm font-semibold text-white hover:bg-black/85 transition-colors"
            >
              Rever contrato
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
            </a>
          ) : (
            <span className="shrink-0 text-xs md:text-sm text-black/60">
              Fale com o gestor da conta.
            </span>
          ))}
        <button
          onClick={descartar}
          aria-label="Dispensar aviso"
          className="ml-auto shrink-0 grid place-items-center w-6 h-6 rounded-md text-black/40 hover:text-black hover:bg-black/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
