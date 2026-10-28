import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Heart, MapPin, Maximize2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import mars from "@/assets/mars.jpg";
import l1 from "@/assets/lote1.jpg";
import l2 from "@/assets/lote2.jpg";
import l3 from "@/assets/lote3.jpg";
import l4 from "@/assets/lote4.jpg";
import l5 from "@/assets/lote5.jpg";
import l6 from "@/assets/lote6.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/inicio")({
  head: () => ({
    meta: [
      { title: "Red Planet Properties — Seu pedaço do novo mundo" },
      { name: "description", content: "Lotes certificados nas regiões mais promissoras de Marte. Um patrimônio para atravessar gerações." },
      { property: "og:title", content: "Red Planet Properties — Seu pedaço do novo mundo" },
      { property: "og:description", content: "Lotes certificados nas regiões mais promissoras de Marte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const lotes = [
  { img: l1, tag: "Mais procurado", local: "Planície de Elysium", nome: "Ares Vista 04", area: "2.400 m²", preco: "R$ 189 mil" },
  { img: l2, tag: "Vista privilegiada", local: "Encosta do Olympus Mons", nome: "Olympus 17", area: "4.850 m²", preco: "R$ 312 mil" },
  { img: l3, tag: "Novo setor", local: "Valles Marineris", nome: "Vallis Prime 21", area: "3.100 m²", preco: "R$ 247 mil" },
  { img: l4, tag: "Novo destaque", local: "Arcadia Planitia", nome: "Arcadia Horizon 27", area: null, preco: null },
  { img: l5, tag: "Novo destaque", local: "Utopia Planitia", nome: "Utopia Reserve 32", area: null, preco: null },
  { img: l6, tag: "Novo destaque", local: "Isidis Planitia", nome: "Isidis Panorama 36", area: null, preco: null },
];

const passos = [
  ["Explore", "Compare regiões, topografias e os lotes disponíveis."],
  ["Reserve", "Garanta sua prioridade com uma reserva digital segura."],
  ["Conquiste", "Receba seu registro territorial e o dossiê completo."],
];

function Eyebrow({ children, line = "bg-current" }: { children: React.ReactNode; line?: string }) {
  return <p className="eyebrow flex items-center gap-4"><span className={`h-px w-8 ${line}`} />{children}</p>;
}

function Index() {
  const [fav, setFav] = useState<number[]>([]);
  return (
    <main>
      {/* Hero */}
      <section className="bg-ink px-6 pb-24 text-ink-foreground lg:px-10">
        <header className="flex items-center justify-between border-b border-ink-foreground/15 py-8">
          <Logo />
          <nav className="hidden items-center gap-10 md:flex">
            <a href="#lotes">Lotes</a>
            <a href="#como">Como funciona</a>
            <a href="#mapa">Mapa de Marte</a>
            <a href="#contato" className="border border-ink-foreground/40 px-6 py-4 text-sm font-semibold transition hover:bg-ink-foreground hover:text-ink">Falar com especialista</a>
            <Link to="/" className="border-l border-ink-foreground/20 pl-6 text-sm opacity-80">Sair</Link>
          </nav>
        </header>
        <div className="relative pt-28">
          <img src={mars} alt="Planeta Marte" width={1024} height={1024} className="pointer-events-none absolute mix-blend-lighten right-[5%] top-10 w-[55%] max-w-[560px] opacity-90 lg:right-[15%]" />
          <div className="relative">
            <Eyebrow line="bg-ink-foreground">O futuro já tem endereço</Eyebrow>
            <h1 className="font-display mt-10 text-6xl md:text-8xl lg:text-[9rem]">
              Seu pedaço<br />do <span className="font-serif-i">novo mundo.</span>
            </h1>
            <div className="mt-12 flex items-center gap-12">
              <p className="max-w-md text-lg opacity-80">Lotes certificados nas regiões mais promissoras de Marte. Um patrimônio para atravessar gerações.</p>
              <a href="#lotes" aria-label="Ver lotes" className="grid size-20 shrink-0 place-items-center rounded-full border border-ink-foreground/40 transition hover:bg-ink-foreground hover:text-ink"><ArrowRight /></a>
            </div>
          </div>
        </div>
      </section>

      {/* Lotes */}
      <section id="lotes" className="px-6 py-24 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-5xl md:text-7xl">Terrenos em destaque</h2>
          <p className="max-w-md text-lg text-muted-foreground">Selecionados por potencial de valorização, localização e condições geológicas.</p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {lotes.map((l, i) => (
            <article key={l.nome} className="group bg-card">
              <div className="relative aspect-[1.07] overflow-hidden">
                <img src={l.img} alt={l.nome} loading="lazy" width={768} height={896} className="size-full object-cover transition duration-700 group-hover:scale-105" />
                <span className="absolute left-6 top-6 font-semibold tracking-widest text-ink-foreground">0{i + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => setFav((f) => (f.includes(i) ? f.filter((x) => x !== i) : [...f, i]))} aria-label={`Favoritar ${l.nome}`} aria-pressed={fav.includes(i)} className="absolute right-6 top-6 grid size-12 place-items-center rounded-full border border-ink-foreground/60 text-ink-foreground backdrop-blur">
                  <Heart size={20} className={fav.includes(i) ? "fill-primary text-primary" : ""} />
                </Button>
                <span className="eyebrow absolute bottom-6 left-6 bg-lime px-3 py-2 text-[0.65rem] text-lime-foreground">{l.tag}</span>
              </div>
              <div className="p-8">
                <p className="eyebrow flex items-start gap-2 text-[0.7rem] font-medium text-muted-foreground"><MapPin size={16} className="shrink-0" />{l.local}</p>
                <h3 className="mt-6 text-3xl tracking-tight">{l.nome}</h3>
                <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-6">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground"><Maximize2 size={14} className="shrink-0" />{l.area ?? "Área a definir"}</span>
                  <span className="text-right text-sm text-muted-foreground">{l.preco ? <>A partir de<br /><b className="text-lg text-foreground">{l.preco}</b></> : "Valor a definir"}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Mapa */}
      <section id="mapa" className="relative overflow-hidden bg-ink px-6 py-32 text-ink-foreground lg:px-10">
        <div className="pointer-events-none absolute -right-40 top-1/2 hidden aspect-square w-[60%] -translate-y-1/2 lg:block">
          <img src={mars} alt="" loading="lazy" width={1024} height={1024} className="size-full opacity-70 sepia mix-blend-lighten" />
          {([["12", "Olympus", "top-[22%] right-[30%]"], ["08", "Elysium", "top-[48%] left-[18%]"], ["21", "Valles", "bottom-[22%] right-[28%]"]] as const).map(([n, t, pos]) => (
            <span key={t} className={`absolute ${pos} flex items-center gap-3 rounded-full bg-ink/90 py-2 pl-2 pr-5 text-sm font-semibold tracking-widest`}>
              <span className="grid size-9 place-items-center rounded-full bg-lime text-xs text-lime-foreground">{n}</span>{t.toUpperCase()}
            </span>
          ))}
        </div>
        <div className="relative max-w-xl">
          <Eyebrow line="bg-lime">Inteligência territorial</Eyebrow>
          <h2 className="font-display mt-8 text-6xl md:text-7xl">Escolha onde começa a sua <span className="font-serif-i">história.</span></h2>
          <p className="mt-10 text-lg opacity-75">Nossa cartografia reúne dados geológicos, incidência solar e rotas projetadas de infraestrutura para guiar sua decisão.</p>
          <Link to="/mapa" className="mt-12 inline-flex items-center gap-6 bg-primary px-9 py-6 font-semibold text-primary-foreground transition hover:bg-rust">Abrir mapa interativo 3D <ArrowRight size={18} /></Link>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como" className="grid gap-16 px-6 py-32 lg:grid-cols-[1fr_1.3fr] lg:px-10">
        <div>
          <Eyebrow line="bg-primary"><span className="text-muted-foreground">Jornada de compra</span></Eyebrow>
          <h2 className="font-display mt-10 text-5xl md:text-7xl">Da Terra para Marte, sem complicação.</h2>
        </div>
        <div className="grid border-t border-border sm:grid-cols-3">
          {passos.map(([t, d], i) => (
            <div key={t} className="border-l border-border p-9">
              <span className="text-sm text-primary">0{i + 1}</span>
              <h3 className="mt-20 text-3xl tracking-tight">{t}</h3>
              <p className="mt-4 text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA + footer */}
      <section id="contato" className="bg-rust px-6 pt-32 text-ink-foreground lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-12 pb-24">
          <div>
            <Eyebrow line="bg-ink-foreground">Primeira chamada — 2035</Eyebrow>
            <h2 className="font-display mt-10 text-6xl md:text-8xl">O próximo grande<br />território é <span className="font-serif-i">vermelho.</span></h2>
          </div>
          <a href="#lotes" className="flex size-56 flex-col items-center justify-center gap-4 rounded-full bg-lime text-lg text-lime-foreground transition hover:scale-105">
            Encontrar meu lote <ArrowRight />
          </a>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-6 border-t border-ink-foreground/20 py-10 text-sm">
          <Logo />
          <span className="opacity-80">Propriedades para o próximo capítulo da humanidade.</span>
          <span className="opacity-80">© 2035 Red Planet Properties</span>
        </footer>
      </section>
    </main>
  );
}
