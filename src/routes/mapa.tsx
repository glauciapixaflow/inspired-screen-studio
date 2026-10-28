import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import MarsMap3D from "@/components/MarsMap3D";

export const Route = createFileRoute("/mapa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mapa 3D de Marte — Red Planet Properties" },
      { name: "description", content: "Voe sobre Marte em 3D e conheça os lotes disponíveis." },
      { property: "og:title", content: "Mapa 3D de Marte — Red Planet Properties" },
      { property: "og:description", content: "Voe sobre Marte em 3D e conheça os lotes disponíveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="relative h-screen w-screen">
      <MarsMap3D />
      <Link to="/inicio" className="absolute bottom-6 left-6 flex items-center gap-2 bg-ink/80 px-5 py-3 text-sm font-semibold text-ink-foreground">
        <ArrowLeft size={16} /> Voltar
      </Link>
    </div>
  ),
});
