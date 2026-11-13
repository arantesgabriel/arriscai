import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Arriscaí! | Quanto menos pistas, mais pontos!",
  description:
    "Reúna a turma, revele uma pista e arrisque. Um jogo de palavras para jogar junto.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
