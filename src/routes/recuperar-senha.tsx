import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PasswordRecoveryLayout } from "@/components/PasswordRecoveryLayout";
import { Button } from "@/components/ui/button";
import { requestPasswordRecovery } from "@/lib/password-recovery";
export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Red Planet Properties" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestPasswordRecovery,
});
function RequestPasswordRecovery() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setReady(true), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await requestPasswordRecovery(email);
      setSent(true);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível conectar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <PasswordRecoveryLayout>
      <h1 className="font-display mt-6 text-5xl sm:text-6xl">Esqueceu sua senha?</h1>
      {sent ? (
        <div role="status" className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Confira seu e-mail</h2>
          <p>
            Se houver uma conta com o e-mail <strong className="break-all">{email.trim()}</strong>,
            você receberá um link para definir uma nova senha.
          </p>
          <p className="text-sm text-muted-foreground">
            Confira também a pasta de spam. Abra o link mais recente recebido.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSent(false);
              setError("");
            }}
          >
            Usar outro e-mail
          </Button>
        </div>
      ) : (
        <form method="post" onSubmit={submit} className="mt-8 space-y-5">
          <p className="text-muted-foreground">
            Informe o e-mail da sua conta para receber o link de recuperação.
          </p>
          <label htmlFor="recovery-email" className="block text-sm font-semibold">
            E-mail cadastrado
          </label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={!ready || busy}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full border-b border-input bg-transparent py-3 text-lg outline-none focus:border-primary"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={!ready || busy}
            aria-busy={busy}
            className="h-auto w-full py-4"
          >
            {busy ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </form>
      )}
    </PasswordRecoveryLayout>
  );
}
