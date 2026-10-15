import type { Metadata } from "next";
import { Space_Grotesk, Inter, Libre_Caslon_Display } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

// Libre Caslon Display — serifada oficial da Acid. Só peso 400 (sem itálico
// real); títulos usam 400 e pull-quotes caem em itálico sintético.
const libreCaslon = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-libre-caslon",
});

export const metadata: Metadata = {
  title: "cccaramelo trend report",
  description: "Relatório de tendências cccaramelo",
};

// Tradução automática do navegador (Chrome em espanhol da CM LATAM traduzindo
// as telas em português) troca os nós de texto por <font>. Quando o React depois
// remove ou insere ao lado de um texto que o tradutor já trocou, o DOM lança
// NotFoundError e a página inteira cai ("Application error: a client-side
// exception"). Relatado em 15/10/2026: escolher a marca no novo report derrubava a
// tela. Em vez de bloquear a tradução (ela precisa dela), o removeChild /
// insertBefore passam a ignorar nó que já não é filho, e o React segue.
// Precisa rodar antes da hidratação, por isso é script inline no <head>.
const GUARDA_TRADUTOR = `(function(){
  if (typeof Node !== "function" || !Node.prototype) return;
  var rm = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child;
    return rm.apply(this, arguments);
  };
  var ins = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) return ins.call(this, node, null);
    return ins.apply(this, arguments);
  };
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: GUARDA_TRADUTOR }} />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${libreCaslon.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
