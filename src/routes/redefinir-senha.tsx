import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PasswordRecoveryLayout } from "@/components/PasswordRecoveryLayout";
import { Button } from "@/components/ui/button";
import { openPasswordRecovery, type PasswordRecoveryAccess } from "@/lib/password-recovery";
export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir nova senha — Red Planet Properties" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ResetPassword,
});
function ResetPassword() {
  const opening = useRef<Promise<PasswordRecoveryAccess> | null>(null);
  const [access, setAccess] = useState<PasswordRecoveryAccess | null>(null);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    function validateLink(replace = false) {
      if (replace || !opening.current) {
        const fragment = window.location.hash;
        // Remove credentials before any asynchronous work; accept another emailed link in this tab.
        window.history.replaceState(window.history.state, "", window.location.pathname);
        setChecking(true);
        setAccess(null);
        setLinkError("");
        setError("");
        setSaved(false);
        setPassword("");
        setConfirmation("");
        opening.current = openPasswordRecovery(fragment);
      }
      const pending = opening.current;
      void pending
        .then((session) => {
          if (active && opening.current === pending) setAccess(session);
        })
        .catch(() => {
          if (active && opening.current === pending)
            setLinkError("Este link de recuperação é inválido ou venceu. Solicite um novo e-mail.");
        })
        .finally(() => {
          if (active && opening.current === pending) setChecking(false);
        });
    }
    const changed = () => validateLink(true);
    validateLink();
    window.addEventListener("hashchange", changed);
    return () => {
      active = false;
      window.removeEventListener("hashchange", changed);
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !access) return;
    setError("");
    if (password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const activeLink = opening.current;
    try {
      await access.updatePassword(password);
      if (opening.current !== activeLink) return;
      setPassword("");
      setConfirmation("");
      setSaved(true);
      setAccess(null);
    } catch (failure) {
      if (opening.current !== activeLink) return;
      setPassword("");
      setConfirmation("");
      setError(
        failure instanceof Error ? failure.message : "Não foi possível salvar a nova senha.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <PasswordRecoveryLayout>
      <h1 className="font-display mt-6 text-5xl sm:text-6xl">Defina sua nova senha</h1>
      {checking ? (
        <p role="status" className="mt-8">
          Verificando o link de recuperação...
        </p>
      ) : linkError ? (
        <div className="mt-8 space-y-5">
          <p role="alert">{linkError}</p>
          <Button asChild>
            <Link to="/recuperar-senha">Solicitar novo link</Link>
          </Button>
        </div>
      ) : saved ? (
        <div role="status" className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Senha atualizada</h2>
          <p>Agora você pode voltar ao login e entrar com sua nova senha.</p>
        </div>
      ) : (
        <form method="post" onSubmit={submit} className="mt-8 space-y-5">
          <p className="text-muted-foreground">
            Use pelo menos 8 caracteres. Combine letras, números e símbolos.
          </p>
          <label htmlFor="reset-password" className="block text-sm font-semibold">
            Nova senha
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full border-b border-input bg-transparent py-3 text-lg outline-none focus:border-primary"
          />
          <label htmlFor="reset-confirmation" className="block text-sm font-semibold">
            Confirmar nova senha
          </label>
          <input
            id="reset-confirmation"
            name="password-confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="w-full border-b border-input bg-transparent py-3 text-lg outline-none focus:border-primary"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} aria-busy={busy} className="h-auto w-full py-4">
            {busy ? "Salvando..." : "Salvar nova senha"}
          </Button>
          <Link to="/recuperar-senha" className="inline-block text-sm underline">
            Solicitar outro link de recuperação
          </Link>
        </form>
      )}
    </PasswordRecoveryLayout>
  );
}
