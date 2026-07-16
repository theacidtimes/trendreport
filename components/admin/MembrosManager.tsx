"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Trash2, Copy, Check, X } from "lucide-react";
import {
  adicionarMembro,
  definirPapelMembro,
  removerMembroMeuTenant,
  type Membro,
} from "@/app/dashboard/admin/usuarios/actions";

const ROLES = [
  { id: "admin", label: "Admin" },
  { id: "editor", label: "Editor" },
  { id: "viewer", label: "Viewer" },
] as const;

const SELECT =
  "rounded-lg bg-surface-2 border border-border px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple/50 transition-colors";
const FIELD =
  "w-full rounded-xl bg-surface-2 border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-purple/50 transition-colors";

// Gestao self-serve dos membros do PROPRIO tenant. Espelha o TenantUsuarios do
// console, mas as actions nao recebem tenantId (o tenant sai de jwt_tenant_id() por
// dentro das RPCs). O teto de seats e read-only aqui: quem amplia e a ACID.
export default function MembrosManager({
  membros,
  seats,
}: {
  membros: Membro[];
  seats: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [novaConta, setNovaConta] = useState<{
    email: string;
    senha: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const usados = membros.length;
  const cheio = usados >= seats;

  function onDefinirPapel(userId: string, novoRole: string) {
    setErro(null);
    setBusyId(userId);
    startTransition(async () => {
      try {
        await definirPapelMembro(userId, novoRole);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao alterar o papel.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function onRemover(userId: string, mail: string) {
    if (!confirm(`Remover ${mail} do workspace?`)) return;
    setErro(null);
    setBusyId(userId);
    startTransition(async () => {
      try {
        await removerMembroMeuTenant(userId);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao remover o membro.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function onAdicionar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setNovaConta(null);
    setCopiado(false);
    startTransition(async () => {
      try {
        const r = await adicionarMembro(email, role);
        setEmail("");
        setRole("viewer");
        setNovaConta({ email: r.email, senha: r.senhaTemporaria });
        router.refresh();
      } catch (err) {
        setErro(
          err instanceof Error ? err.message : "Erro ao adicionar o membro."
        );
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="kicker text-muted-2">Membros · {usados}</h2>
        <span
          className={`text-xs tabular-nums ${
            cheio ? "text-amber-400" : "text-muted-2"
          }`}
        >
          {usados}/{seats} seats
        </span>
      </div>

      {/* Lista de membros */}
      {membros.length === 0 ? (
        <div className="rounded-3xl bg-surface border border-border p-8 text-center text-muted text-sm">
          Nenhum membro ainda.
        </div>
      ) : (
        <ul className="flex flex-col rounded-3xl bg-surface border border-border overflow-hidden divide-y divide-border">
          {membros.map((u) => {
            const loading = pending && busyId === u.user_id;
            return (
              <li
                key={u.user_id}
                className="flex items-center gap-3 px-5 py-3.5"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-white text-sm font-medium truncate">
                    {u.email}
                  </span>
                </div>
                <select
                  value={u.role}
                  disabled={pending}
                  onChange={(e) => onDefinirPapel(u.user_id, e.target.value)}
                  className={`${SELECT} disabled:opacity-60`}
                  aria-label={`Papel de ${u.email}`}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRemover(u.user_id, u.email)}
                  aria-label={`Remover ${u.email}`}
                  className="grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                  ) : (
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Conta nova criada — senha temporaria pra repassar */}
      {novaConta && (
        <div className="rounded-2xl bg-lime/5 border border-lime/30 p-4 flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-white">
              Conta criada para{" "}
              <span className="font-semibold">{novaConta.email}</span>. Repasse a
              senha temporária. Ela não será exibida de novo.
            </p>
            <button
              type="button"
              onClick={() => setNovaConta(null)}
              aria-label="Fechar"
              className="text-muted hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-bg border border-border px-3 py-2 text-sm text-lime font-mono">
              {novaConta.senha}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(novaConta.senha);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 border border-border px-3 py-2 text-xs text-white hover:border-lime/50 transition-colors"
            >
              {copiado ? (
                <Check className="w-3.5 h-3.5 text-lime" strokeWidth={2.6} />
              ) : (
                <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />
              )}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* Form de adicionar */}
      <form
        onSubmit={onAdicionar}
        className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-3 shadow-card"
      >
        <h3 className="text-white text-sm font-medium">Adicionar membro</h3>
        <p className="text-muted-2 text-[11px] leading-relaxed -mt-1">
          Cria uma conta nova e mostra a senha temporária aqui para você
          repassar. Se o e-mail já tiver conta, fale com a ACID para vinculá-lo.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@empresa.com"
            className={FIELD}
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`${SELECT} sm:w-32 shrink-0`}
            aria-label="Papel"
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || cheio}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime text-black text-sm font-semibold px-4 py-2.5 hover:brightness-95 transition disabled:opacity-50 shrink-0"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.4} />
            ) : (
              <UserPlus className="w-4 h-4" strokeWidth={2.2} />
            )}
            Adicionar
          </button>
        </div>
        {cheio && (
          <p className="text-amber-400 text-xs">
            Teto de seats atingido ({usados}/{seats}). Fale com a ACID para
            ampliar o plano.
          </p>
        )}
        {erro && <p className="text-red-400 text-xs">{erro}</p>}
      </form>
    </section>
  );
}
