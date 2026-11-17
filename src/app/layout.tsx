import type { Metadata } from "next";
import { Changa_One, Nunito_Sans } from "next/font/google";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/typography.css";
import "../styles/motion.css";

// Self-hosted em build (OFL). Expostas como variáveis; consumidas por --font-display/--font-body.
const changa = Changa_One({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-changa",
  display: "swap",
});
const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Arriscaí! | Quanto menos pistas, mais pontos!",
  description:
    "Reúna a galera, revele uma pista e arrisque. Um jogo de palavras para jogar junto.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${changa.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
