import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Heart, MapPin, Maximize2, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import mars from "@/assets/mars.jpg";
import l1 from "@/assets/lote1.jpg";
import l2 from "@/assets/lote2.jpg";
import l3 from "@/assets/lote3.jpg";
import l4 from "@/assets/lote4.jpg";
import l5 from "@/assets/lote5.jpg";
import l6 from "@/assets/lote6.jpg";
import { Button } from "@/components/ui/button";
import { MyReservations } from "@/components/MyReservations";
import { AccountAction } from "@/components/AccountAction";
import { MarsSpecialistDialog } from "@/components/MarsSpecialistDialog";
import { featuredOffer } from "@/lib/featured-pricing";

export const Route = createFileRoute("/inicio")({
  head: () => ({
    meta: [
      { title: "Red Planet Properties — Seu pedaço do novo mundo" },
      {
        name: "description",
        content:
          "Lotes certificados nas regiões mais promissoras de Marte. Um patrimônio para atravessar gerações.",
      },
      { property: "og:title", content: "Red Planet Properties — Seu pedaço do novo mundo" },
      {
        property: "og:description",
        content: "Lotes certificados nas regiões mais promissoras de Marte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const lotes = [
  {
    img: l1,
    tag: "Mais procurado",
    local: "Planície de Elysium",
    nome: "Ares Vista 04",
    region: "08",
    area: "2.400 m²",
    preco: "R$ 189 mil",
  },
  {
    img: l2,
    tag: "Vista privilegiada",
    local: "Encosta do Olympus Mons",
    nome: "Olympus 17",
    region: "12",
    area: "4.850 m²",
    preco: "R$ 312 mil",
  },
  {
    img: l3,
    tag: "Novo setor",
    local: "Valles Marineris",
    nome: "Vallis Prime 21",
    region: "21",
    area: "3.100 m²",
    preco: "R$ 247 mil",
  },
  {
    img: l4,
    tag: "Novo destaque",
    local: "Arcadia Planitia",
    nome: "Arcadia Horizon 27",
    region: "27",
    ...featuredOffer("arcadia"),
  },
  {
    img: l5,
    tag: "Novo destaque",
    local: "Utopia Planitia",
    nome: "Utopia Reserve 32",
    region: "32",
    ...featuredOffer("utopia"),
  },
  {
    img: l6,
    tag: "Novo destaque",
    local: "Isidis Planitia",
    nome: "Isidis Panorama 36",
    region: "36",
    ...featuredOffer("isidis"),
  },
];

const passos = [
  ["Explore", "Compare regiões, topografias e os lotes disponíveis."],
  ["Reserve", "Registre seu interesse na área e acompanhe sua solicitação."],
  ["Negocie", "Entre em contato com os colaboradores para conversar sobre a área."],
];

function Eyebrow({ children, line = "bg-current" }: { children: React.ReactNode; line?: string }) {
  return (
    <p className="eyebrow flex items-center gap-4">
      <span className={`h-px w-8 ${line}`} />
      {children}
    </p>
  );
}

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [specialistOpen, setSpecialistOpen] = useState(false);
  const [fav, setFav] = useState<number[]>([]);
  return (
    <main>
      <MarsSpecialistDialog open={specialistOpen} onOpenChange={setSpecialistOpen} />
      {/* Hero */}
      <section className="bg-ink px-6 pb-24 text-ink-foreground lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-foreground/15 py-5 sm:py-6">
          <div className="min-w-0 flex-1 2xl:flex-none">
            <Logo />
          </div>
          <nav aria-label="Menu principal" className="hidden items-center gap-6 2xl:flex">
            <a href="#lotes">Lotes</a>
            <a href="#como">Como funciona</a>
            <a href="#mapa">Mapa de Marte</a>
            <button
              type="button"
              onClick={() => setSpecialistOpen(true)}
              className="border border-ink-foreground/40 px-6 py-4 text-sm font-semibold transition hover:bg-ink-foreground hover:text-ink"
            >
              Falar com especialista
            </button>
            <a
              href="#minhas-reservas"
              className="border-l border-ink-foreground/20 pl-6 text-sm opacity-80"
            >
              Minhas reservas
            </a>
          </nav>
          <AccountAction />
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-ink-foreground 2xl:hidden"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="site-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </header>
        {menuOpen && (
          <nav
            id="site-navigation"
            className="grid grid-cols-2 gap-2 border-b border-ink-foreground/15 py-4 2xl:hidden"
            aria-label="Menu principal"
          >
            {[
              ["#lotes", "Lotes"],
              ["#como", "Como funciona"],
              ["#mapa", "Mapa de Marte"],
              ["#contato", "Especialista"],
              ["#minhas-reservas", "Minhas reservas"],
            ].map(([href, label]) => (
              <Button
                key={href}
                variant="ghost"
                asChild
                className="justify-start text-ink-foreground"
              >
                {href === "#contato" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setSpecialistOpen(true);
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  <a href={href} onClick={() => setMenuOpen(false)}>
                    {label}
                  </a>
                )}
              </Button>
            ))}
          </nav>
        )}
        <div className="relative pt-16 sm:pt-28">
          <img
            src={mars}
            alt="Planeta Marte"
            width={1024}
            height={1024}
            className="pointer-events-none absolute mix-blend-lighten right-[5%] top-10 w-[55%] max-w-[560px] opacity-90 lg:right-[15%]"
          />
          <div className="relative">
            <Eyebrow line="bg-ink-foreground">O futuro já tem endereço</Eyebrow>
            <h1 className="font-display mt-10 text-5xl sm:text-6xl md:text-8xl lg:text-[9rem]">
              Seu pedaço
              <br />
              do <span className="font-serif-i">novo mundo.</span>
            </h1>
            <div className="mt-12 flex flex-wrap items-center gap-6 sm:flex-nowrap sm:gap-12">
              <p className="max-w-md text-lg opacity-80">
                Lotes certificados nas regiões mais promissoras de Marte. Um patrimônio para
                atravessar gerações.
              </p>
              <a
                href="#lotes"
                aria-label="Ver lotes"
                className="grid size-20 shrink-0 place-items-center rounded-full border border-ink-foreground/40 transition hover:bg-ink-foreground hover:text-ink"
              >
                <ArrowRight />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Lotes */}
      <section id="lotes" className="px-5 py-16 sm:px-6 sm:py-24 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-4xl sm:text-5xl md:text-7xl">Terrenos em destaque</h2>
          <p className="max-w-md text-lg text-muted-foreground">
            Selecionados por potencial de valorização, localização e condições geológicas.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 sm:mt-16">
          {lotes.map((l, i) => (
            <article
              key={l.nome}
              className="group min-w-0 bg-card transition-shadow focus-within:ring-2 focus-within:ring-ring"
            >
              <div className="relative aspect-[1.07] overflow-hidden">
                <Link
                  to="/mapa"
                  search={{ region: l.region }}
                  aria-label={`Explorar ${l.nome} no mapa 3D`}
                  className="block size-full"
                >
                  <img
                    src={l.img}
                    alt={l.nome}
                    loading="lazy"
                    width={768}
                    height={896}
                    className="size-full object-cover transition duration-700 motion-reduce:transition-none group-hover:scale-105"
                  />
                </Link>
                <span className="absolute left-6 top-6 font-semibold tracking-widest text-ink-foreground">
                  0{i + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setFav((f) => (f.includes(i) ? f.filter((x) => x !== i) : [...f, i]))
                  }
                  aria-label={`Favoritar ${l.nome}`}
                  aria-pressed={fav.includes(i)}
                  className="absolute right-6 top-6 grid size-12 place-items-center rounded-full border border-ink-foreground/60 text-ink-foreground backdrop-blur"
                >
                  <Heart size={20} className={fav.includes(i) ? "fill-primary text-primary" : ""} />
                </Button>
                <span className="eyebrow absolute bottom-6 left-6 bg-lime px-3 py-2 text-[0.65rem] text-lime-foreground">
                  {l.tag}
                </span>
              </div>
              <div className="p-5 sm:p-6 lg:p-8">
                <p className="eyebrow flex items-start gap-2 text-[0.7rem] font-medium text-muted-foreground">
                  <MapPin size={16} className="shrink-0" />
                  {l.local}
                </p>
                <h3 className="mt-5 break-words text-2xl lg:text-3xl">{l.nome}</h3>
                <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-6">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Maximize2 size={14} className="shrink-0" />
                    {l.area ?? "Área a definir"}
                  </span>
                  <span className="text-right text-sm text-muted-foreground">
                    {l.preco ? (
                      <>
                        A partir de
                        <br />
                        <b className="text-lg text-foreground">{l.preco}</b>
                      </>
                    ) : (
                      "Valor a definir"
                    )}
                  </span>
                </div>
                <Button asChild className="mt-6 w-full justify-between">
                  <Link
                    to="/mapa"
                    search={{ region: l.region }}
                    aria-label={`Ver ${l.nome} no mapa 3D`}
                  >
                    Ver no mapa 3D <ArrowRight />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <MyReservations />
      {/* Mapa */}
      <section
        id="mapa"
        className="relative overflow-hidden bg-ink px-6 py-32 text-ink-foreground lg:px-10"
      >
        <div className="pointer-events-none absolute -right-40 top-1/2 hidden aspect-square w-[60%] -translate-y-1/2 lg:block">
          <img
            src={mars}
            alt=""
            loading="lazy"
            width={1024}
            height={1024}
            className="size-full opacity-70 sepia mix-blend-lighten"
          />
          {(
            [
              ["12", "Olympus", "top-[22%] right-[30%]"],
              ["08", "Elysium", "top-[48%] left-[18%]"],
              ["21", "Valles", "bottom-[22%] right-[28%]"],
            ] as const
          ).map(([n, t, pos]) => (
            <span
              key={t}
              className={`absolute ${pos} flex items-center gap-3 rounded-full bg-ink/90 py-2 pl-2 pr-5 text-sm font-semibold tracking-widest`}
            >
              <span className="grid size-9 place-items-center rounded-full bg-lime text-xs text-lime-foreground">
                {n}
              </span>
              {t.toUpperCase()}
            </span>
          ))}
        </div>
        <div className="relative max-w-xl">
          <Eyebrow line="bg-lime">Inteligência territorial</Eyebrow>
          <h2 className="font-display mt-8 text-4xl sm:text-6xl md:text-7xl">
            Escolha onde começa a sua <span className="font-serif-i">história.</span>
          </h2>
          <p className="mt-10 text-lg opacity-75">
            Nossa cartografia reúne dados geológicos, incidência solar e rotas projetadas de
            infraestrutura para guiar sua decisão.
          </p>
          <Link
            to="/mapa"
            className="mt-12 inline-flex max-w-full items-center gap-3 bg-primary px-5 py-5 text-sm font-semibold text-primary-foreground transition hover:bg-rust sm:gap-6 sm:px-9 sm:py-6 sm:text-base"
          >
            Abrir mapa interativo 3D <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como" className="grid gap-16 px-6 py-32 lg:grid-cols-[1fr_1.3fr] lg:px-10">
        <div>
          <Eyebrow line="bg-primary">
            <span className="text-muted-foreground">Jornada de negociação</span>
          </Eyebrow>
          <h2 className="font-display mt-10 text-5xl md:text-7xl">
            Da Terra para Marte, sem complicação.
          </h2>
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
            <h2 className="font-display mt-10 text-4xl sm:text-6xl md:text-8xl">
              O próximo grande
              <br />
              território é <span className="font-serif-i">vermelho.</span>
            </h2>
          </div>
          <a
            href="#lotes"
            className="flex size-56 flex-col items-center justify-center gap-4 rounded-full bg-lime text-lg text-lime-foreground transition hover:scale-105"
          >
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
