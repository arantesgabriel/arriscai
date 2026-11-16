import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Demo } from "./demo";

export const metadata: Metadata = {
  title: "Design system | Arriscaí!",
  robots: { index: false, follow: false },
};

// Catálogo isolado: indisponível em produção, salvo flag explícita.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DS_DEMO !== "1") {
    notFound();
  }
  return <Demo />;
}
