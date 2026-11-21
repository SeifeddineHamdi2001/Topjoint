"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { Logo } from "@/components/site/Logo";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-primary">
      <form action={action} className="w-full max-w-sm bg-surface-container-lowest rounded-xl p-8 shadow-xl space-y-5">
        <Logo name="Top Joint" tagline="Administration" />
        <div>
          <label htmlFor="email" className="field-label">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="field" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Mot de passe</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
        </div>
        {state.error && <p className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full h-11 rounded-lg bg-secondary-container hover:bg-secondary-fixed disabled:opacity-60 text-primary font-label-metric text-label-metric font-bold uppercase"
        >
          {pending ? "Connexion..." : "Se connecter"}
        </button>
        <a href="/fr" className="block text-center font-label-code text-label-code text-outline hover:text-primary">
          ← Retour au site
        </a>
      </form>
    </div>
  );
}
