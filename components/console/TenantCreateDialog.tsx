"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { provisionarTenant } from "@/app/console/actions";
import { convidarAdminInicial } from "@/app/console/usuarios-actions";
import type { ModuloNome } from "@/lib/types";

const FIELD =
  "w-full rounded-xl bg-surface border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-purple/50 transition-colors";
const LABEL = "text-muted text-xs uppercase tracking-[0.12em] font-medium";

const MODULOS: { id: ModuloNome; label: string }[] = [
  { id: "radar", label: "Radar" },
  { id: "reports", label: "Reports" },
  { id: "dados_semanticos", label: "Dados semânticos" },
];

export default function TenantCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda o id do tenant JA provisionado: se o convite do admin falhar, um novo
  // submit reenvia so o convite em vez de recriar o tenant (evita duplicata).
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [modulos, setModulos] = useState<Set<ModuloNome>>(
    () => new Set<ModuloNome>(["radar", "reports", "dados_semanticos"])
  );

  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
    setError(null);
    setCreatedId(null);
  }, [loading]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  function toggleModulo(m: ModuloNome) {
    setModulos((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    const adminEmail = String(fd.get("admin_email") || "").trim();
    if (!nome) {
      setError("Informe o nome do tenant.");
      return;
    }
    setLoading(true);
    try {
      // Provisiona só se ainda não foi (retry de convite não recria o tenant).
      let id = createdId;
      if (!id) {
        id = await provisionarTenant({
          nome,
          tipo: String(fd.get("tipo") || "agency"),
          seats: Number(fd.get("seats")) || 5,
          plano: String(fd.get("plano") || "mensal"),
          modulos: Array.from(modulos),
          cnpj: String(fd.get("cnpj") || ""),
          creditos: Number(fd.get("creditos")) || 0,
        });
        setCreatedId(id);
      }

      // Convite do 1o admin (best-effort): tenant já existe; se falhar aqui, o
      // próximo submit reenvia só o convite.
      if (adminEmail) {
        await convidarAdminInicial(id, adminEmail);
      }

      setOpen(false);
      setCreatedId(null);
      router.push(`/console/tenants/${id}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao provisionar o tenant.";
      // Tenant já nasceu mas o convite falhou: sinaliza que é só reenviar.
      setError(
        createdId
          ? `Tenant criado, mas o convite falhou: ${msg}. Corrija o e-mail e envie de novo, ou avance sem convidar.`
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full bg-purple hover:bg-purple-mid text-white text-sm font-medium px-4 py-2 transition-colors"
      >
        <span className="w-5 h-5 rounded-full bg-lime text-black flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-3.5 h-3.5" strokeWidth={2.6} />
        </span>
        Novo tenant
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-10"
          onClick={close}
        >
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-xl my-auto rounded-3xl bg-bg border border-border p-6 md:p-8 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Console Acid Fabric</span>
                <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">
                  Provisionar tenant
                </h2>
                <p className="text-muted text-[15px] max-w-md">
                  Cria o tenant, liga os módulos assinados e lança a assinatura
                  inicial numa transação só.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={loading}
                aria-label="Fechar"
                className="shrink-0 w-10 h-10 rounded-full border border-border text-muted hover:text-white hover:border-white/20 transition-colors flex items-center justify-center disabled:opacity-40"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Nome *</span>
                <input name="nome" required placeholder="Estúdio Acme" className={FIELD} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Tipo</span>
                <select name="tipo" defaultValue="agency" className={FIELD}>
                  <option value="studio">Estúdio</option>
                  <option value="agency">Agência</option>
                  <option value="holding">Holding</option>
                  <option value="company">Empresa</option>
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>E-mail do admin inicial</span>
              <input
                name="admin_email"
                type="email"
                placeholder="pessoa@empresa.com"
                className={FIELD}
              />
              <span className="text-muted/70 text-xs">
                Recebe um e-mail de boas-vindas para ativar a conta e definir a senha.
                Vira o primeiro administrador do workspace. Opcional.
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>CNPJ</span>
                <input name="cnpj" placeholder="opcional" className={FIELD} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Seats</span>
                <input
                  name="seats"
                  type="number"
                  min={1}
                  defaultValue={5}
                  className={FIELD}
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className={LABEL}>Módulos assinados</span>
              <div className="flex flex-wrap gap-2">
                {MODULOS.map((m) => {
                  const on = modulos.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModulo(m.id)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        on
                          ? "border-lime/50 bg-lime/10 text-lime"
                          : "border-border bg-surface text-muted hover:text-white"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Plano da assinatura</span>
                <select name="plano" defaultValue="mensal" className={FIELD}>
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Créditos iniciais</span>
                <input
                  name="creditos"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  placeholder="ex. 500"
                  className={FIELD}
                />
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="text-muted hover:text-white text-sm font-medium px-4 py-2 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-lime text-black text-sm font-semibold px-5 py-2.5 hover:brightness-95 transition disabled:opacity-50"
              >
                {loading
                  ? createdId
                    ? "Enviando convite..."
                    : "Provisionando..."
                  : createdId
                    ? "Reenviar convite"
                    : "Provisionar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
