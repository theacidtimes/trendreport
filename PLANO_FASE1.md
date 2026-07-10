# Plano Fase 1 — Rádar composto

Contexto pra retomar em outra janela. Decisões TRAVADAS com o usuário. Ainda NÃO codado.
Aguardando go pra começar. Test runs no Apify gastam crédito — validar schema de TikTok e
X-search com 1 run mínimo cada ANTES de plugar no fluxo.

## Composto final (travado)

Toda marca roda por DEFAULT 6 lanes; LinkedIn é a única fonte ligável (+1 lane):

| Lane | Fonte | Keywords | Actor |
|------|-------|----------|-------|
| Reddit cultural | reddit | termos_culturais | trudax/reddit-scraper-lite |
| Reddit marca | reddit | termos_busca | trudax/reddit-scraper-lite |
| TikTok cultural | tiktok | termos_culturais | (validar schema) |
| X-search cultural | twitter | termos_culturais | apidojo tweet-scraper (61RPP7dywgiy0JPD0) |
| News pt-br marca | news | termos_busca | johnvc/GoogleNewsAPI (site: BR+setor+institucional junto) |
| News global-EN cultural | news | termos_culturais_en | johnvc/GoogleNewsAPI (sites globais EN) |
| **LinkedIn cultural (ligável)** | linkedin | termos_culturais | supreme_coder/linkedin-post (Wpp1BZ6yGWjySadk3) |

- **Coração cultural = Reddit + TikTok + X**, dominantes. Discovery por TERMO, não por menção de marca.
- **Fatos/News = peso MÍNIMO.** Âncora anti-alucinação só, nunca dominam um drop.
- **LinkedIn** via `supreme_coder/linkedin-post`: raspa posts por keyword (search URL
  `/search/results/content/?keywords=...`), devolve conteúdo+engajamento+comentários, ~$0.002/post.
  Só liga em cliente B2B/B2BC. `harvestapi/linkedin-profile-search` é people-finder (parkado, não capta sinal).
- **FB parkado** (actor só raspa pages/profiles, é watchlist, não discovery por termo).
- **Retirar** actor `data-slayer/twitter-trends-by-location` (só dá label+volume, sem conteúdo/URL).

## Score (rebalancear)

`lib/radar/scoreHype.ts`: de 40/40/20 → **densidade 65 / velocidade 20 / transbordo 15**.
Densidade = Reddit (conversa real). Transbordo = News = mínimo, coerente com "fato = peso mínimo".

## Intervalo

Default `intervalo_horas = 8`, 24h/dia (noite é pico cultural, não é janela diurna).

## Setor por marca (multi-tag, tem cruzamento)

Setor agrupa 1+ tags que se sobrepõem. Ex:
- Vivo = telecom + varejo + tecnologia + entretenimento
- Conta Simples = startups + economia + financas_pj + varejo + industria (+ BC, Febraban, FIESP institucional)

Isso entra na lane "News pt-br marca" via sites institucionais/setoriais no `site:` (ver sites.md).

## Passos de código (fase 1)

1. **lib/types.ts**: `Fonte` += `'tiktok' | 'linkedin'`. `MarcaKnowledge` += `termos_culturais_en?: string[]`.
   Marca += flag `linkedin_ativo` (ou struct `fontes`).
2. **lib/radar/collectData.ts**:
   - specs+mappers pra `tiktok` e `linkedin`.
   - X: trocar trends actor por apidojo tweet-search (spec por termo, mapTwitter novo lendo tweets reais).
   - News global-EN: sites globais EN (Wired, The Information, Crunchbase, Product Hunt, HN, TrendWatching,
     Springwise, PSFK, Variety, Deadline, Billboard, Pitchfork, Dazed — ver sites.md).
   - Retirar `data-slayer/twitter-trends-by-location`.
3. **lib/radar/runRadar.ts** `lanesFor`: montar as 6 lanes default + LinkedIn se `linkedin_ativo`.
   `finalize` é count-agnóstico (agrupa por `${batch_id}|${marca_id}`), então N lanes não precisa migration.
4. **lib/radar/scoreHype.ts**: 65/20/15.
5. **app/dashboard/radar/actions.ts**: preservar `linkedin_ativo` e `termos_culturais_en` em create/update
   (mesmo padrão do preserve de `termos_culturais`).
6. **SQL (via Supabase MCP)**: seed `termos_culturais_en` por marca (eu curo/traduzo, user revisa) +
   set `intervalo_horas = 8`. Supabase project id: quwivphvruvgbjksprks (TrendReport).

## Restrições permanentes

- Usuário faz TODO git commit/push. Eu aplico migrations/SQL via Supabase MCP.
- Eu NÃO insiro credenciais. `gh` CLI não instalado local.
- Preferir arquivos novos pra features novas.
- ESTILO: evitar em-dash ("—") em texto/prosa gerada (parece IA). Usar ponto/vírgula/dois-pontos.
- NUNCA fabricar trend/fato sem dado raspado real por trás.

## Apify (custo)

- Starter $29 (inclui $29 prepaid). Próxima fatura $93. Add-on de +$50 concorrência provavelmente desperdiçado
  (pico ~24 runs < 32 base com 4 marcas).
- Custo modelo: ~$15/marca/mês a 8h; 4 marcas ≈ $60/mês.
- apidojo tweet: $0.0004/tweet. LinkedIn: $0.002/post. Reddit: compute-based. News: Proxy SERP $2.50/1000.
