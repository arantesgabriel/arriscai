import type { Metadata } from "next";
import { Lilita_One, Nunito_Sans } from "next/font/google";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/typography.css";
import "../styles/motion.css";

// Self-hosted em build (OFL). Expostas como variáveis; consumidas por --font-display/--font-body.
const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-lilita", display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap" });
export const metadata: Metadata = {
  title: "Arriscaí! | Quanto menos pistas, mais pontos!",
  description:
    "Reúna a turma, revele uma pista e arrisque. Um jogo de palavras para jogar junto.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${lilita.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
