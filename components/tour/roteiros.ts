// Roteiros dos tours de novidade. Cada passo aponta pra um elemento marcado
// com data-tour="<alvo>" na tela.
//
// Texto curto e direto: a CM LATAM lê pelo tradutor do Chrome, e frase simples
// traduz bem. Um tour novo = id novo (quem viu o antigo vê o novo uma vez).

export type PassoTour = {
  // Valor de data-tour do elemento a destacar. Ausente = cartão central.
  alvo?: string;
  titulo: string;
  texto: string;
  // Botão extra que leva até a função (encerra o tour).
  acao?: { rotulo: string; href: string };
};

export const TOURS = {
  // Dashboard: apresenta as três novidades de novembro/2026.
  "novidades-2026-11": [
    {
      titulo: "Novidades nos reports",
      texto: "Três mudanças para montar e editar reports mais rápido. Leva meio minuto.",
    },
    {
      alvo: "novo-report",
      titulo: "Monte um report com o que já foi coletado",
      texto:
        "Em Novo report, escolha “Ou monte a partir do acervo”. Você usa posts e notícias que já foram coletados da marca, sem duplicar outro report.",
      acao: { rotulo: "Experimentar", href: "/dashboard/new/montar" },
    },
    {
      alvo: "primeiro-report",
      titulo: "Troque o post de um card",
      texto:
        "No editor de um report em revisão, cada card tem “Trocar pela coleta”. Imagem, link e autor mudam juntos, sem colar nada.",
    },
    {
      alvo: "primeiro-report",
      titulo: "O report ficou com visual novo",
      texto:
        "Os posts em destaque aparecem com o conteúdo na própria página, e a capa ficou mais limpa. Abra qualquer report para ver.",
    },
  ],

  // Editor: o botão de troca, na primeira vez que alguém revisa um report.
  "editor-trocar-coleta": [
    {
      alvo: "trocar-coleta",
      titulo: "Trocar pela coleta",
      texto:
        "Abre os posts já coletados desta marca. Escolha um e o card recebe imagem, link, autor e rede de uma vez. O texto continua com você.",
    },
    {
      alvo: "aba-preview",
      titulo: "Confira no Preview",
      texto: "Veja como o cliente vai receber o report antes de homologar.",
    },
  ],

  // Tela de montar: como usar o acervo e os blocos.
  "montar-acervo": [
    {
      alvo: "montar-acervo",
      titulo: "Busque no acervo",
      texto:
        "Aqui ficam os posts e notícias que os reports e o radar já coletaram desta marca. Filtre por rede, período ou palavra.",
    },
    {
      alvo: "acervo-acoes",
      titulo: "Coloque no bloco",
      texto:
        "Clique no card para ver o post inteiro. Use Incluir no report para levar o item.",
    },
    {
      alvo: "montar-report",
      titulo: "Organize e crie",
      texto:
        "Arraste para mudar a ordem, tire o que não serve e crie. A IA separa tendências e memes e escreve a leitura, no formato de sempre. Usa 1 crédito.",
    },
  ],
} satisfies Record<string, PassoTour[]>;

export type TourId = keyof typeof TOURS;
