import type { Metadata } from "next";
import GameApp from "@/components/game-app";

export const metadata: Metadata = {
  title: "Jogar | Arriscaí!",
  robots: { index: false, follow: true },
};
export default function Play() {
  return <GameApp />;
}
