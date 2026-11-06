import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
export function PasswordRecoveryLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="bg-ink px-6 py-8 text-ink-foreground sm:px-12">
        <Logo />
      </header>
      <section className="mx-auto max-w-xl px-6 py-14 sm:py-20">
        <p className="eyebrow text-muted-foreground">Acesso à conta</p>
        {children}
        <Link
          to="/"
          className="mt-8 inline-block font-semibold text-primary underline underline-offset-4"
        >
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
