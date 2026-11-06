import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function ClientSignupForm({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data, error: failure } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: window.location.origin + "/",
        },
      });
      if (failure) {
        const messages: Record<string, string> = {
          weak_password: "Escolha uma senha mais forte, com letras, números e símbolos.",
          signup_disabled:
            "O cadastro está temporariamente indisponível. Entre em contato com a equipe.",
          over_email_send_rate_limit:
            "O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente.",
          over_request_rate_limit: "Muitas tentativas. Aguarde antes de tentar novamente.",
          user_already_exists:
            "Não foi possível criar a conta. Se você já se cadastrou, use Entrar na minha conta.",
          email_address_invalid: "Confira o endereço de e-mail informado.",
        };
        setError(
          messages[failure.code ?? ""] ??
            "Não foi possível criar sua conta. Confira os dados e tente novamente.",
        );
        return;
      }
      if (!data.user && !data.session) {
        setError("Não foi possível verificar o cadastro. Tente novamente.");
        return;
      }
      setPassword("");
      setConfirmation("");
      if (data.session) {
        await navigate({ to: "/inicio" });
      } else {
        setSent(true);
      }
    } catch {
      setError("Não foi possível conectar. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }
  const inputClass =
    "w-full border-b border-input bg-transparent py-3 text-lg outline-none focus:border-primary disabled:opacity-60";
  return (
    <form method="post" onSubmit={submit} className="mx-auto my-auto w-full max-w-md py-12">
      <p className="eyebrow">Novo cliente</p>
      <h2 className="font-display mt-6 text-5xl sm:text-6xl">Crie sua conta</h2>
      {sent ? (
        <div role="status" className="mt-8 space-y-4">
          <h3 className="text-xl font-semibold">Confira seu e-mail</h3>
          <p>
            Se o cadastro puder ser realizado, você receberá uma mensagem em{" "}
            <strong className="break-all">{email.trim()}</strong>. Abra o link para confirmar seu
            e-mail e depois entre na sua conta.
          </p>
          <p className="text-sm text-muted-foreground">
            Confira também a pasta de spam. Se já possui uma conta, você pode entrar com sua senha.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-5 text-muted-foreground">
            Cadastre-se para reservar uma área e acompanhar suas negociações.
          </p>
          <fieldset disabled={!ready || busy} className="mt-8 space-y-5">
            <div>
              <label htmlFor="signup-name" className="text-sm font-semibold">
                Nome completo
              </label>
              <input
                id="signup-name"
                name="name"
                autoComplete="name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="text-sm font-semibold">
                E-mail
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="text-sm font-semibold">
                Senha
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="signup-password-help"
                className={inputClass}
              />
              <p id="signup-password-help" className="mt-2 text-sm text-muted-foreground">
                Use pelo menos 8 caracteres. Combine letras, números e símbolos.
              </p>
            </div>
            <div>
              <label htmlFor="signup-confirmation" className="text-sm font-semibold">
                Confirmar senha
              </label>
              <input
                id="signup-confirmation"
                name="password-confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className={inputClass}
              />
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="mt-5 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!ready || busy}
            aria-busy={busy}
            className="mt-8 flex w-full items-center justify-center gap-4 bg-primary py-5 font-semibold text-primary-foreground transition hover:bg-rust disabled:opacity-60"
          >
            {busy ? "Criando conta..." : "Criar minha conta"} <ArrowRight size={18} />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onLogin}
        disabled={busy}
        className="mt-6 w-full py-3 text-center font-semibold text-primary underline underline-offset-4"
      >
        Já tenho conta — entrar
      </button>
    </form>
  );
}
