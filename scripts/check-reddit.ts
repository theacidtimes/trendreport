import { montarPostsReddit, type RawRedditItem } from "../lib/apify";

// A coleta do Reddit não pode ser verificada rodando o actor (custa por item, e
// a conta ficou sem saldo), então o que dá pra garantir é a transformação: o
// join post↔comentário, os cortes de NSFW/data e a escolha da imagem. São
// justamente as partes que falham caladas — post sem discussão e post sem imagem
// não levantam erro, só chegam pobres no report.

const agora = new Date().toISOString();
const antigo = new Date(Date.now() - 30 * 86_400_000).toISOString();

const post = (o: Partial<RawRedditItem> = {}): RawRedditItem => ({
  dataType: "post",
  id: "abc",
  title: "titulo",
  communityName: "r/HUEstation",
  url: "https://reddit.com/p/abc",
  upVotes: 10,
  createdAt: agora,
  ...o,
});

const comentario = (
  postId: string,
  body: string,
  upVotes: number
): RawRedditItem => ({ dataType: "comment", postId, body, upVotes });

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

// ── join post↔comentário ──────────────────────────────────
// O bug que motivou tudo: o código lia `item.comments` (aninhado), mas o actor
// entrega comentário como item irmão. Resultado: nunca houve discussão no report.

const comDiscussao = montarPostsReddit(
  [
    post(),
    comentario("abc", "comentario fraco", 1),
    comentario("abc", "comentario forte", 99),
  ],
  "geral"
)[0];
check(
  "comentário solto é costurado no post",
  comDiscussao?.title?.includes("Fórum/Discussão Real") === true,
  comDiscussao?.title
);
check(
  "comentário mais votado vem primeiro",
  comDiscussao?.title?.indexOf("forte")! < comDiscussao?.title?.indexOf("fraco")!,
  comDiscussao?.title
);

// Regressão do prefixo: `postId` do comentário vem como t3_abc e o `id` do post
// como abc. Sem normalizar, o join dá match zero e o post chega mudo.
const comPrefixo = montarPostsReddit(
  [post(), comentario("t3_abc", "resposta", 5)],
  "geral"
)[0];
check(
  "postId com prefixo t3_ ainda casa com o post",
  comPrefixo?.title?.includes("resposta") === true,
  comPrefixo?.title
);

check(
  "comentário de outro post não vaza",
  montarPostsReddit(
    [post(), comentario("outro", "nao e daqui", 50)],
    "geral"
  )[0]?.title === "titulo"
);

check(
  "post sem comentário não ganha rótulo vazio",
  montarPostsReddit([post()], "geral")[0]?.title === "titulo"
);

check(
  "comentário não vira item do report",
  montarPostsReddit([post(), comentario("abc", "oi", 1)], "geral").length === 1
);

check(
  "só os 4 comentários mais votados entram",
  (montarPostsReddit(
    [
      post(),
      ...Array.from({ length: 8 }, (_, i) =>
        comentario("abc", `c${i}`, i)
      ),
    ],
    "geral"
  )[0]?.title?.match(/\|/g)?.length ?? 0) === 3
);

// ── NSFW: regra dura de produto ───────────────────────────

check(
  "post marcado over18 é descartado",
  montarPostsReddit([post({ over18: true })], "geral").length === 0
);

// ── recência ──────────────────────────────────────────────

check(
  "post velho é descartado",
  montarPostsReddit([post({ createdAt: antigo })], "geral").length === 0
);
check(
  "post sem data é mantido",
  montarPostsReddit([post({ createdAt: undefined })], "geral").length === 1
);

// ── imagem ────────────────────────────────────────────────
// imageUrls[0] costuma ser o ícone da comunidade: pegar por índice publica o
// avatar do sub no lugar do meme.

const comImagem = montarPostsReddit(
  [
    post({
      imageUrls: [
        "https://styles.redditmedia.com/icone_da_comunidade.png",
        "https://i.redd.it/omeme.jpg",
      ],
    }),
  ],
  "meme"
)[0];
check(
  "imagem escolhida é a do post, não o ícone da comunidade",
  comImagem?.imageUrl === "https://i.redd.it/omeme.jpg",
  comImagem?.imageUrl
);
check(
  "sem mídia do Reddit não inventa imagem",
  montarPostsReddit(
    [post({ imageUrls: ["https://styles.redditmedia.com/icone.png"] })],
    "meme"
  )[0]?.imageUrl === undefined
);

// ── fonte ─────────────────────────────────────────────────
// É o campo que o systemPrompt usa pra saber se o item é matéria-prima de meme.

check(
  "fonte é carimbada no item",
  montarPostsReddit([post()], "meme")[0]?.fonte === "meme"
);

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`);
process.exit(falhas === 0 ? 0 : 1);
