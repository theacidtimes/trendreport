import { Dispatch, SetStateAction, useState } from "react";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Estado compartilhado do briefing: o formulário (esquerda) e o assistente
// (direita) leem e escrevem os mesmos campos, então o que o Claude preenche
// aparece na hora no form.
export interface BriefingState {
  cliente: string;
  setCliente: Dispatch<SetStateAction<string>>;
  tom: string;
  setTom: Dispatch<SetStateAction<string>>;
  data: string;
  setData: Dispatch<SetStateAction<string>>;
  contexto: string;
  setContexto: Dispatch<SetStateAction<string>>;
  memes: string[];
  setMemes: Dispatch<SetStateAction<string[]>>;
  quero: string;
  setQuero: Dispatch<SetStateAction<string>>;
}

// O que o assistente pode preencher. Só campos que ela realmente informou.
export interface BriefingPatch {
  cliente?: string;
  tom?: string;
  data?: string;
  contexto?: string;
  memes?: string[];
  quero?: string;
}

export function useBriefingState(): BriefingState {
  const [cliente, setCliente] = useState("");
  const [tom, setTom] = useState("");
  const [data, setData] = useState(todayISO());
  const [contexto, setContexto] = useState("");
  const [memes, setMemes] = useState<string[]>([""]);
  const [quero, setQuero] = useState("");
  return {
    cliente,
    setCliente,
    tom,
    setTom,
    data,
    setData,
    contexto,
    setContexto,
    memes,
    setMemes,
    quero,
    setQuero,
  };
}

export function applyBriefingPatch(s: BriefingState, p: BriefingPatch) {
  if (typeof p.cliente === "string") s.setCliente(p.cliente);
  if (typeof p.tom === "string") s.setTom(p.tom);
  if (typeof p.data === "string") s.setData(p.data);
  if (typeof p.contexto === "string") s.setContexto(p.contexto);
  if (typeof p.quero === "string") s.setQuero(p.quero);
  if (Array.isArray(p.memes)) s.setMemes(p.memes.length ? p.memes : [""]);
}

// Snapshot limpo dos campos pra enviar ao assistente (memes sem linhas vazias).
export function briefingFields(s: BriefingState): Required<BriefingPatch> {
  return {
    cliente: s.cliente,
    tom: s.tom,
    data: s.data,
    contexto: s.contexto,
    memes: s.memes.map((m) => m.trim()).filter(Boolean),
    quero: s.quero,
  };
}
