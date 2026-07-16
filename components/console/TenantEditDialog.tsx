"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateTenant } from "@/app/console/actions";
import type { Tenant } from "@/lib/types";

const FIELD =
  "w-full rounded-xl bg-surface border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-purple/50 transition-colors";
const LABEL = "text-muted text-xs uppercase tracking-[0.12em] font-medium";

export default function TenantEditDialog({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
    setError(null);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    if (!nome) {
      setError("Informe o nome do tenant.");
      return;
    }
    setLoading(true);
    try {
      await updateTenant(tenant.id, {
        nome,
        tipo: String(fd.get("tipo") || tenant.tipo),
        status: String(fd.get("status") || tenant.status),
        seats: Number(fd.get("seats")) || tenant.seats,
        cnpj: String(fd.get("cnpj") || ""),
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o tenant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border text-muted hover:text-white hover:border-white/20 text-sm font-medium px-3.5 h-9 transition-colors"
      >
        <Pencil className="w-4 h-4" strokeWidth={2} />
        Editar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-10"
          onClick={close}
        >
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-lg my-auto rounded-3xl bg-bg border border-border p-6 md:p-8 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Editar tenant</span>
                <h2 className="font-serif text-white font-medium text-2xl leading-tight">
                  {tenant.nome}
                </h2>
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

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Nome *</span>
              <input
                name="nome"
                required
                defaultValue={tenant.nome}
                className={FIELD}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Tipo</span>
                <select name="tipo" defaultValue={tenant.tipo} className={FIELD}>
                  <option value="studio">Estúdio</option>
                  <option value="agency">Agência</option>
                  <option value="holding">Holding</option>
                  <option value="company">Empresa</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Status</span>
                <select
                  name="status"
                  defaultValue={tenant.status}
                  className={FIELD}
                >
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Seats</span>
                <input
                  name="seats"
                  type="number"
                  min={1}
                  defaultValue={tenant.seats}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>CNPJ</span>
                <input
                  name="cnpj"
                  defaultValue={tenant.cnpj ?? ""}
                  placeholder="opcional"
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
                {loading ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
