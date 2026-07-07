"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Admin = { email: string; created_at: string };

export default function AdminManager({
  currentEmail,
}: {
  currentEmail?: string;
}) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("app_admins")
      .select("email, created_at")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setAdmins((data ?? []) as Admin[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = novo.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("E-mail inválido.");
      return;
    }
    if (admins.some((a) => a.email === email)) {
      setError("Esse e-mail já é admin.");
      return;
    }
    setError("");
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_admins")
      .insert({ email, added_by: currentEmail ?? null });
    if (error) setError(error.message);
    else {
      setNovo("");
      await load();
    }
    setAdding(false);
  }

  async function handleRemove(email: string) {
    if (email === currentEmail) {
      setError("Você não pode remover a si mesmo.");
      return;
    }
    if (!window.confirm(`Remover ${email} da lista de admins?`)) return;
    setError("");
    setRemoving(email);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_admins")
      .delete()
      .eq("email", email);
    if (error) setError(error.message);
    else await load();
    setRemoving(null);
  }

  return (
    <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted">
        <ShieldCheck className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
        <span className="text-xs uppercase tracking-[0.14em] font-medium">
          Admins do app
        </span>
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="email"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="email@dominio.com"
          className="flex-1 bg-bg border border-border text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-lime transition-colors placeholder:text-muted/60"
        />
        <button
          type="submit"
          disabled={adding}
          className="bg-lime text-black font-bold text-sm rounded-lg px-4 h-11 flex items-center justify-center gap-2 hover:brightness-110 transition-[filter] disabled:opacity-60 shrink-0"
        >
          {adding ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          )}
          Adicionar
        </button>
      </form>

      {error && (
        <span className="flex items-center gap-2 text-red-400 text-sm">
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
          {error}
        </span>
      )}

      {loading ? (
        <span className="text-muted text-sm">Carregando…</span>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {admins.map((a) => (
            <li
              key={a.email}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="text-white text-sm truncate">
                {a.email}
                {a.email === currentEmail && (
                  <span className="text-muted text-xs"> · você</span>
                )}
              </span>
              <button
                onClick={() => handleRemove(a.email)}
                disabled={a.email === currentEmail || removing === a.email}
                aria-label={`Remover ${a.email}`}
                className="shrink-0 text-muted hover:text-red-400 transition-colors disabled:opacity-30 disabled:hover:text-muted"
              >
                {removing === a.email ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Trash2 className="w-4 h-4" strokeWidth={2} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
