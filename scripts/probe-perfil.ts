// Roda a derivação REAL (Haiku) contra a carteira real de clientes.
//
// Não é teste automatizado: é a validação que importa e que nenhum assert
// substitui — se o modelo assinar `esporte` para uma produtora de sementes,
// o código está perfeito e o produto está errado.
import { derivarPerfilCultural, vagasDoPeso } from "../lib/radar/perfilCultural";
import type { MarcaKnowledge } from "../lib/types";

// Espelho do acervo real. NAO da pra chamar `dominiosDaAgenda()` aqui: ela usa o
// client de servidor (next/headers), que nao existe fora do request. Entao esta
// lista precisa ser atualizada a mao quando `pulso_cultural` ganhar dominio novo
// — se ficar velha, o probe mente pra melhor e mostra a derivacao escolhendo
// entre menos opcoes do que a tela realmente oferece.
// Sincronizada em 03/08/2026 (migration 0041): 12 dominios.
const DOMINIOS = [
  "agro", "alimentacao", "clima", "economia", "entretenimento", "esporte",
  "games", "massa", "musica", "saude", "tech", "trabalho",
];

const m = (
  marca: string,
  produto: string,
  perfil_comportamental: string,
  universos_culturais: string[],
  ambicao_de_marca: string,
  pais = "BR",
  o_que_evitar: string[] = []
) => ({ marca, produto, perfil_comportamental, universos_culturais, ambicao_de_marca, pais, o_que_evitar }) as MarcaKnowledge;

const carteira: MarcaKnowledge[] = [
  m("Warner Games", "jogos AAA e franquias de games", "gamers 16-35, console e PC, comunidade forte",
    ["comunidade gamer BR", "cultura nerd", "streamers"], "ser a casa das franquias que a galera joga"),
  m("Bradesco Seguros", "seguros residenciais e auto vendidos por corretores independentes",
    "corretores de seguros, PJ pequeno, decidem por comissão e facilidade de venda",
    ["mercado segurador", "empreendedorismo de corretagem"],
    "ser o parceiro que faz o corretor vender mais", "BR", ["tom alarmista", "sensacionalismo com tragédia"]),
  m("Wellhub", "assinatura corporativa de academias e bem-estar", "RH e colaboradores de empresas, 25-45",
    ["fitness", "saúde mental no trabalho", "rotina corporativa"], "tornar bem-estar parte do trabalho"),
  m("A.C. Camargo", "hospital oncológico de referência", "pacientes, familiares e médicos",
    ["saúde", "prevenção do câncer"], "ser referência em oncologia no Brasil", "BR",
    ["banalizar a doença", "promessa de cura"]),
  m("Atto Sementes", "sementes de forrageiras e soja para produtor rural",
    "produtor rural e agrônomo, decide por produtividade e custo por hectare",
    ["agronegócio", "calendário de safra"], "ser a semente que entrega mais arroba por hectare", "BR",
    ["meme e viral de massa", "pauta política do agro", "debate de agrotóxico", "especulação de preço"]),
  m("Turma da Mônica", "IP de quadrinhos e licenciamento infantil", "crianças 4-12 e pais nostálgicos 30-50",
    ["quadrinhos", "nostalgia dos anos 90", "cultura infantil brasileira"],
    "ser o IP brasileiro que atravessa gerações", "BR",
    // Anti-gancho de verdade: a MSP aciona judicialmente quem gera arte no traço
    // dela com IA. A trend existe e é grande — e é exatamente por isso que
    // precisa estar escrita aqui, senão o radar a entrega como oportunidade.
    ["IA imitando o traço da Mauricio de Sousa", "conteúdo adulto com os personagens"]),
  m("Cinemark", "rede de cinemas", "público 18-45 que sai pra ver filme",
    ["cinema", "cultura pop", "lançamentos de blockbuster"], "ser o lugar onde o filme acontece"),
  // Australia Vibes (ex-Hart's Natural) é BRASILEIRA — Pareci Novo/RS, fundada em
  // 2010. "Australia" era o nome da LINHA e virou o nome da marca em 2025; a
  // australianidade é estética, não geografia (site .com.br, preço em BRL, tudo
  // em português). Este fixture dizia "AU" e por isso media ZERO domínio — o que
  // se lia como "falta acervo AU" e era, na verdade, país errado.
  m("Australia Vibes", "granola e cereais premium (ex-Hart's Natural)",
    "brasileiros 25-45, rotina real, proteína e clean label",
    ["wellness", "cultura do café da manhã", "clean label"],
    "ser a granola premium do dia a dia", "BR",
    ["promessa de emagrecimento", "deboche de Ozempic"])
];

// O vocabulário é o do PAÍS da marca (dominiosDaAgenda(pais)). Hoje o acervo é
// 100% BR, então marca estrangeira recebe lista VAZIA — e a derivação nem chega a
// chamar o modelo. Reproduzido aqui para que o probe mostre o mesmo que a tela.
const vocabulario = (k: MarcaKnowledge) => ((k.pais ?? "BR") === "BR" ? DOMINIOS : []);

(async () => {
  for (const k of carteira) {
    const p = await derivarPerfilCultural(k, vocabulario(k));
    const vagas = vagasDoPeso(p.peso_cultural);
    const dom = p.dominios_culturais.join(", ") || "—";
    console.log(
      `\n${k.marca.padEnd(18)} ${String(vagas).padStart(1)}/6 vagas  [${dom}]\n` +
      `                   ${p.justificativa}`
    );
  }
})();
