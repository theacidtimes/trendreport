"use client";

import { useState } from "react";
import { Download, Check } from "lucide-react";

// Célula como chega da RPC public.fabric_trend_cells. Espelho fiel do return
// table da migration 0034 — mantém o shape acoplado à origem (sem massagear).
export interface LakeCell {
  bucket: string;
  periodo_inicio: string;
  setor: string;
  dimensao: string;
  termo: string;
  n_sinais: number;
  n_plataformas: number;
  n_engaj_alto: number;
  momento_derivado: string | null;
  confidence: number | null;
}

// A "torneira" em .md: serializa as células que já estão na tela para um
// markdown baixável — o primeiro formato de ENTREGA da lake (antes de qualquer
// dashboard sofisticado). Roda 100% no client sobre o que a página já buscou;
// não refaz query nem toca a lake (que continua dormente até o ingest ligar).
function toMarkdown(cells: LakeCell[]): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const linhas: string[] = [
    `# Acid Fabric — leitura da lake`,
    ``,
    `Exportado em ${hoje}. ${cells.length} células (k-anonimizadas na origem).`,
    ``,
  ];

  // Agrupa por setor pra o .md ficar legível (a RPC já vem ordenada por período
  // desc, n_sinais desc; preservamos essa ordem dentro de cada setor).
  const porSetor = new Map<string, LakeCell[]>();
  for (const c of cells) {
    const arr = porSetor.get(c.setor) ?? [];
    arr.push(c);
    porSetor.set(c.setor, arr);
  }

  for (const [setor, arr] of Array.from(porSetor.entries())) {
    linhas.push(`## ${setor}`, ``);
    linhas.push(
      `| período | dimensão | termo | sinais | plataformas | engaj. alto | momento | confiança |`
    );
    linhas.push(`| --- | --- | --- | --: | --: | --: | --- | --: |`);
    for (const c of arr) {
      linhas.push(
        `| ${c.periodo_inicio} | ${c.dimensao} | ${c.termo} | ${c.n_sinais} | ${c.n_plataformas} | ${c.n_engaj_alto} | ${c.momento_derivado ?? "—"} | ${c.confidence ?? "—"} |`
      );
    }
    linhas.push(``);
  }

  return linhas.join("\n");
}

export default function LakeExport({ cells }: { cells: LakeCell[] }) {
  const [baixado, setBaixado] = useState(false);
  const vazio = cells.length === 0;

  function baixar() {
    const blob = new Blob([toMarkdown(cells)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acid-fabric-lake-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBaixado(true);
    setTimeout(() => setBaixado(false), 2000);
  }

  return (
    <button
      onClick={baixar}
      disabled={vazio}
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
        vazio
          ? "border-border text-muted-2 cursor-not-allowed"
          : "border-border text-white hover:border-white/20 hover:bg-surface-2/60"
      }`}
    >
      {baixado ? (
        <Check className="w-4 h-4 text-lime" strokeWidth={2.4} />
      ) : (
        <Download className="w-4 h-4" strokeWidth={2} />
      )}
      {baixado ? "Baixado" : "Exportar .md"}
    </button>
  );
}
