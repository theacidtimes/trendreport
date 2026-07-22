// Dados da operadora da plataforma. Fixos no app (NÃO derivam do branding do
// tenant): mesmo tenant white-label com logo/nome próprio, a operação continua
// sendo da The Acid Times. É a blindagem jurídica — quem opera aparece sempre.
export const OPERADORA = {
  nome: "The Acid Times",
  razaoSocial: "The Acid Times",
  cnpj: "36.458.402/0001-81",
} as const;

// Versão vigente dos Termos e Condições. Bumpar aqui quando o texto mudar de
// forma material: o aceite grava esta string, então uma versão nova permite
// detectar quem ainda não aceitou a revisão e (no futuro) forçar re-aceite.
export const TERMOS_VERSAO = "2026-07-22";

// Linha única de atribuição — usada no rodapé das telas e na rail do produto.
export const OPERADO_POR = `Desenvolvido e operado por ${OPERADORA.nome} · CNPJ ${OPERADORA.cnpj}`;
