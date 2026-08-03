// Roda a derivação REAL (Haiku) contra a carteira real de clientes.
//
// Não é teste automatizado: é a validação que importa e que nenhum assert
// substitui — se o modelo assinar `esporte` para uma produtora de sementes,
// o código está perfeito e o produto está errado.
import { derivarPerfilCultural, vagasDoPeso } from "../lib/radar/perfilCultural";
import type { MarcaKnowledge } from "../lib/types";

const DOMINIOS = ["economia", "entretenimento", "esporte", "massa", "musica", "tech"];

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
    ["agronegócio", "calendário de safra"], "ser a semente que entrega mais arroba por hectare"),
  m("Turma da Mônica", "IP de quadrinhos e licenciamento infantil", "crianças 4-12 e pais nostálgicos 30-50",
    ["quadrinhos", "nostalgia dos anos 90", "cultura infantil brasileira"],
    "ser o IP brasileiro que atravessa gerações"),
  m("Cinemark", "rede de cinemas", "público 18-45 que sai pra ver filme",
    ["cinema", "cultura pop", "lançamentos de blockbuster"], "ser o lugar onde o filme acontece"),
  m("Harts", "granola e cereais premium", "australianos 25-45, saúde e clean eating",
    ["wellness", "breakfast culture", "clean label"], "be the everyday premium granola", "AU")
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
