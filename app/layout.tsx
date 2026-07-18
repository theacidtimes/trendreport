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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${libreCaslon.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
