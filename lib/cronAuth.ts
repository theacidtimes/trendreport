// Gate das rotas chamadas pelo cron (radar, rebuild da Fabric Lake).
//
// Comparar direto com `Bearer ${process.env.RADAR_CRON_SECRET}` tem uma armadilha:
// se a variável faltar no ambiente, a senha vira o texto "Bearer undefined" e
// qualquer um que mande esse cabeçalho passa. Aqui, sem secret configurado,
// ninguém passa.
export function cronAutorizado(request: Request): boolean {
  const secret = process.env.RADAR_CRON_SECRET;
  if (!secret) {
    console.error("[CRON] RADAR_CRON_SECRET ausente; chamada recusada.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
