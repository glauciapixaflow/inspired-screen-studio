import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import mars from "@/assets/mars.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesse sua conta — Ares Imóveis" },
      { name: "description", content: "Portal do investidor Ares Imóveis: acesse seus lotes em Marte." },
      { property: "og:title", content: "Acesse sua conta — Ares Imóveis" },
      { property: "og:description", content: "Portal do investidor Ares Imóveis." },
    ],
  }),
  component: Login,
});

function Login() {
  const [show, setShow] = useState(false);
  const nav = useNavigate();
  const go = (e?: React.FormEvent) => {
    e?.preventDefault();
    nav({ to: "/" });
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-ink p-10 text-ink-foreground lg:p-16">
        <img src={mars} alt="" className="pointer-events-none absolute left-1/2 top-1/2 w-[70%] -translate-x-1/3 -translate-y-1/3 opacity-60" width={1024} height={1024} />
        <div className="relative"><Logo /></div>
        <div className="relative my-16">
          <p className="eyebrow flex items-center gap-4"><span className="h-px w-10 bg-lime" />Área exclusiva</p>
          <h1 className="font-display mt-8 text-6xl lg:text-8xl">
            Seu futuro<br />começa <span className="font-serif-i">além.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg opacity-80">
            Acesse sua seleção de lotes, acompanhe propostas e descubra novas oportunidades no planeta vermelho.
          </p>
        </div>
        <div className="relative flex justify-between text-xs tracking-[0.2em] opacity-70">
          <span>18.65° N &nbsp; 226.2° E</span><span>ELYSIUM PLANITIA</span>
        </div>
      </section>

      <section className="flex flex-col bg-background px-8 py-12 lg:px-24">
        <div className="flex justify-between text-xs tracking-[0.2em] text-muted-foreground">
          <span>PORTAL DO INVESTIDOR</span><span>2035 · BR</span>
        </div>
        <form onSubmit={go} className="mx-auto my-auto w-full max-w-md py-12">
          <p className="eyebrow flex items-center gap-4"><span className="h-px w-10 bg-foreground" />Bem-vindo de volta</p>
          <h2 className="font-display mt-8 text-6xl">Acesse sua conta</h2>
          <p className="mt-6 text-muted-foreground">Entre para continuar explorando seu próximo território.</p>

          <label className="eyebrow mt-12 block text-[0.65rem]">E-mail</label>
          <input type="email" placeholder="seuemail@exemplo.com" className="w-full border-b border-input bg-transparent py-4 text-lg outline-none focus:border-primary" />
          <label className="eyebrow mt-8 block text-[0.65rem]">Senha</label>
          <div className="flex items-center border-b border-input focus-within:border-primary">
            <input type={show ? "text" : "password"} placeholder="Mínimo de 6 caracteres" className="w-full bg-transparent py-4 text-lg outline-none" />
            <button type="button" onClick={() => setShow(!show)} className="text-sm font-semibold text-primary">{show ? "Ocultar" : "Mostrar"}</button>
          </div>
          <div className="mt-8 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-primary" /> Lembrar de mim</label>
            <a href="#" className="text-primary">Esqueci minha senha</a>
          </div>
          <button className="mt-10 flex w-full items-center justify-center gap-4 bg-primary py-6 font-semibold text-primary-foreground transition hover:bg-rust">
            Entrar na minha conta <ArrowRight size={18} />
          </button>
          <div className="my-8 flex items-center gap-4 text-xs tracking-[0.15em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />OU ACESSE PARA CONHECER<span className="h-px flex-1 bg-border" />
          </div>
          <Link to="/" className="block border border-foreground/40 py-5 text-center font-semibold transition hover:bg-foreground hover:text-background">
            Entrar como visitante
          </Link>
        </form>
      </section>
    </div>
  );
}
