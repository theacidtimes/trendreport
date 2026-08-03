import { createClient } from "@/lib/supabase/server";
import type { Marca, PulsoCultural } from "@/lib/types";
import { estadoDaLinha } from "@/lib/radar/agendaLinha";
import { optedIn } from "@/lib/radar/planner";
import AgendaBoard, { type DominioResumo, type TenantOpcao } from "./AgendaBoard";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = createClient();

  const [{ data: linhasRaw }, { data: marcasRaw }, { data: tenantsRaw }] =
    await Promise.all([
      supabase.from("pulso_cultural").select("*"),
      supabase.from("marcas").select("*"),
      supabase.from("tenants").select("id, nome").order("nome"),
    ]);

  const linhas = (linhasRaw ?? []) as PulsoCultural[];
  const marcas = (marcasRaw ?? []) as Marca[];
  const tenants = (tenantsRaw ?? []) as TenantOpcao[];
  const agora = new Date();

  // Quantas marcas assinam cada domínio. É o número que transforma a lista de
  // linhas numa decisão: domínio com 4 linhas caprichadas e ZERO assinante é
  // curadoria que não roda, e não há como perceber isso olhando só as linhas.
  const assinantes = new Map<string, string[]>();
  for (const m of marcas) {
    for (const d of m.yaml_conhecimento?.dominios_culturais ?? []) {
      assinantes.set(d, [...(assinantes.get(d) ?? []), m.nome]);
    }
  }

  const porDominio = new Map<string, PulsoCultural[]>();
  for (const l of linhas) {
    porDominio.set(l.dominio, [...(porDominio.get(l.dominio) ?? []), l]);
  }
  // Domínio que só existe no DNA de alguma marca (linha apagada, domínio
  // renomeado) precisa aparecer aqui, senão vira assinatura órfã invisível.
  for (const d of Array.from(assinantes.keys())) {
    if (!porDominio.has(d)) porDominio.set(d, []);
  }

  // O estado de cada linha é calculado AQUI, no servidor, e desce pronto. Se o
  // componente cliente chamasse `estadoDaLinha(l, new Date())` na renderização,
  // o fuso do navegador poderia discordar do fuso do servidor e o React
  // reclamaria de hidratação justamente na virada do dia — que é exatamente
  // quando uma janela abre ou fecha.
  const dominios: DominioResumo[] = Array.from(porDominio.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dominio, linhasDoDominio]) => {
      const comEstado = linhasDoDominio
        .map((linha) => ({ linha, estado: estadoDaLinha(linha, agora) }))
        .sort(
          (x, y) =>
            y.linha.peso - x.linha.peso ||
            x.linha.titulo.localeCompare(y.linha.titulo)
        );
      return {
        dominio,
        linhas: comEstado,
        vigentes: comEstado.filter((l) => l.estado === "vigente").length,
        assinantes: assinantes.get(dominio) ?? [],
      };
    });

  // Marca sem perfil derivado ignora a agenda INTEIRA, por qualquer caminho.
  // Curar linha para elas é trabalho que não chega a lugar nenhum, então o aviso
  // vem antes da lista, não depois.
  const semPerfil = marcas.filter((m) => !optedIn(m)).map((m) => m.nome);

  return (
    <AgendaBoard
      dominios={dominios}
      tenants={tenants}
      semPerfil={semPerfil}
      totalMarcas={marcas.length}
    />
  );
}
