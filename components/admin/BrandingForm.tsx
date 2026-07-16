"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { salvarBranding } from "@/app/dashboard/admin/marca/actions";
import type { TenantBranding } from "@/lib/types";

const FIELD =
  "w-full rounded-xl bg-surface-2 border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-purple/50 transition-colors";
const LABEL = "text-muted text-xs uppercase tracking-[0.12em] font-medium";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Defaults do chrome (globals.css: --purple / --lime). Marca vazia herda estes.
const FALLBACK_PRIMARIA = "#A063E8"; // roxo (--purple)
const FALLBACK_DESTAQUE = "#81D300"; // verde (--lime)

export default function BrandingForm({
  initial,
}: {
  initial: TenantBranding;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? "");
  const [corPrimaria, setCorPrimaria] = useState(initial.cor_primaria ?? "");
  const [corDestaque, setCorDestaque] = useState(initial.cor_destaque ?? "");

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primariaPreview = HEX.test(corPrimaria)
    ? corPrimaria
    : FALLBACK_PRIMARIA;
  const destaquePreview = HEX.test(corDestaque)
    ? corDestaque
    : FALLBACK_DESTAQUE;
  const nomePreview = displayName.trim() || "Acid Fabric";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setLoading(true);
    try {
      await salvarBranding({
        display_name: displayName,
        logo_url: logoUrl,
        cor_primaria: corPrimaria,
        cor_destaque: corDestaque,
      });
      setOk(true);
      router.refresh();
      setTimeout(() => setOk(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar a marca."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 lg:grid-cols-2 gap-5"
    >
      {/* Campos */}
      <div className="rounded-3xl bg-surface border border-border p-5 md:p-6 flex flex-col gap-4 shadow-card">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Nome de exibição</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Acid Fabric"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Logo (URL)</span>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.svg"
            className={FIELD}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <ColorField
            label="Cor primária"
            value={corPrimaria}
            fallback={FALLBACK_PRIMARIA}
            onChange={setCorPrimaria}
          />
          <ColorField
            label="Cor de destaque"
            value={corDestaque}
            fallback={FALLBACK_DESTAQUE}
            onChange={setCorDestaque}
          />
        </div>
        <p className="text-muted-2 text-[11px] leading-relaxed -mt-1">
          As duas cores substituem os acentos do produto: a primária entra onde
          hoje é roxo, a de destaque onde hoje é verde. O resto do layout
          permanece igual.
        </p>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-lime text-black text-sm font-semibold px-5 py-2.5 hover:brightness-95 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.4} />
            ) : ok ? (
              <Check className="w-4 h-4" strokeWidth={2.6} />
            ) : null}
            {loading ? "Salvando..." : ok ? "Salvo" : "Salvar marca"}
          </button>
          <span className="text-muted-2 text-[11px]">
            Campo em branco herda o padrão da ACID.
          </span>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-3xl bg-surface border border-border p-5 md:p-6 flex flex-col gap-4 shadow-card">
        <span className={LABEL}>Prévia</span>
        <div className="rounded-2xl bg-bg border border-border overflow-hidden">
          {/* Barra topo simulando o chrome */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="w-7 h-7 rounded-md object-contain shrink-0"
              />
            ) : (
              <span
                className="w-7 h-7 rounded-md shrink-0 grid place-items-center text-black text-xs font-bold"
                style={{ background: primariaPreview }}
              >
                {nomePreview.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-white font-bold text-sm truncate">
              {nomePreview}
            </span>
          </div>
          {/* Corpo simulando acentos */}
          <div className="p-4 flex flex-col gap-3">
            <span
              className="inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold text-black"
              style={{ background: destaquePreview }}
            >
              Novo report
            </span>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: primariaPreview }}
              />
              <span className="text-muted text-xs">
                Acento primário em botões e links
              </span>
            </div>
            <div className="flex gap-2">
              <span
                className="h-8 rounded-lg flex-1"
                style={{ background: primariaPreview }}
              />
              <span
                className="h-8 rounded-lg flex-1"
                style={{ background: destaquePreview }}
              />
            </div>
          </div>
        </div>
        <p className="text-muted-2 text-[11px] leading-relaxed">
          Aplicação da marca ao produto inteiro entra na próxima fase. Aqui você
          já define e valida a identidade.
        </p>
      </div>
    </form>
  );
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const valid = HEX.test(value);
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} — seletor`}
          className="h-10 w-10 shrink-0 rounded-lg border border-border bg-surface-2 cursor-pointer p-1"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className={FIELD}
        />
      </div>
    </label>
  );
}
