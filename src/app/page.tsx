import GameApp from "@/components/game-app";
import type { Metadata, Viewport } from "next";
import { Changa_One } from "next/font/google";
import Landing from "@/components/landing/landing";
import {
  Hero,
  ScoreSection,
  HowItWorks,
  DemoSection,
  Features,
  FinalCallToAction,
  Footer,
} from "@/components/landing/sections";
import "@/components/landing/landing.css";

const changa = Changa_One({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-changa",
  display: "swap",
});
const origin =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://arriscai.vercel.app";
const title = "Arriscaí! | Jogo de Adivinhação com Amigos";
const description =
  "Revele palavras de uma pergunta escondida, arrisque a resposta e dispute pontos com seus amigos. Quanto menos pistas, mais pontos!";
export const viewport: Viewport = { themeColor: "#11162c" };
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    title,
    description,
    images: [
      {
        url: "/arriscai-og.png",
        width: 1200,
        height: 630,
        alt: "Arriscaí! Quanto menos pistas, mais pontos!",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/arriscai-og.png"],
  },
};
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Existing invitation, screen and authentication callbacks keep their entry point.
  if (
    ["codigo", "telao", "code", "token_hash", "error", "type"].some(
      (key) => key in query,
    )
  )
    return <GameApp />;
  return (
    <Landing fontClass={changa.variable}>
      <main id="conteudo">
        <Hero />
        <ScoreSection />
        <HowItWorks />
        <DemoSection />
        <Features />
        <FinalCallToAction />
      </main>
      <Footer />
    </Landing>
  );
}
