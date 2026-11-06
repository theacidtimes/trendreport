// Regras de mídia do report, usadas tanto no servidor (ReportView) quanto no
// cliente (PostMedia). Ficam fora do PostMedia porque função exportada de um
// arquivo "use client" não pode ser chamada no servidor.

// O report guarda só o link do post, não o arquivo do vídeo. Vídeo de TikTok
// e reel de Instagram tocam pelo player oficial da rede.
export function urlDoPlayer(postUrl?: string | null): string | null {
  if (!postUrl) return null;
  const tiktok = postUrl.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (tiktok) return `https://www.tiktok.com/embed/v2/${tiktok[1]}`;
  const reel = postUrl.match(/instagram\.com\/(?:reel|reels|tv)\/([\w-]+)/);
  if (reel) return `https://www.instagram.com/reel/${reel[1]}/embed`;
  return null;
}

// A geração guarda a imagem do post em report-images/auto/; o que o analista
// sobe no editor vai pra report-images/<slug>/. Essa é uma ilustração da
// equipe, não o post, e não pode sair com crédito de quem postou.
export function imagemSubidaAMao(url?: string | null): boolean {
  return Boolean(url && url.includes("/report-images/") && !url.includes("/report-images/auto/"));
}

// Player de um post do radar, com a proporção do que ele mostra: TikTok e reel
// são verticais (9:16), post de Instagram é retrato (4:5). Reddit, notícia e
// tweet não têm player e viram card de texto.
export function embedDoPost(postUrl?: string | null): { src: string; proporcao: string } | null {
  if (!postUrl) return null;
  const video = urlDoPlayer(postUrl);
  if (video) return { src: video, proporcao: "9 / 16" };
  const post = postUrl.match(/instagram\.com\/p\/([\w-]+)/);
  if (post) return { src: `https://www.instagram.com/p/${post[1]}/embed`, proporcao: "4 / 5" };
  return null;
}
