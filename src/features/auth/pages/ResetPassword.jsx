import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "./ResetPassword.css";

export function getRecoveryParams() {
  if (typeof window === "undefined") return new URLSearchParams();

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  if (hash) {
    const hashParams = new URLSearchParams(hash.startsWith("/") ? hash.split("?")[1] || "" : hash);
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }

  return params;
}

export default function ResetPassword() {
  const recoveryParams = useMemo(() => getRecoveryParams(), []);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      setError("");
      setMessage("");

      try {
        if (recoveryParams.get('error') || recoveryParams.get('error_code')) {
          throw new Error('Deze herstel-link is verlopen of ongeldig. Vraag een nieuwe link aan.');
        }
        // The existing client detects recovery URLs itself. Wait for initialization
        // before exchanging a code, so a one-use code is not consumed twice.
        let { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data?.session && recoveryParams.get('code')) {
          ({ data, error: sessionError } = await supabase.auth.exchangeCodeForSession(recoveryParams.get('code')));
          if (sessionError) throw sessionError;
        }
        if (!data?.session) throw new Error('Deze herstel-link is ongeldig of verlopen. Vraag een nieuwe link aan.');
        if (!mounted) return;
        window.history.replaceState(null, '', '/#/nieuw-wachtwoord');
        setReady(true);
      } catch (failure) {
        if (mounted) {
          setError(failure.message || 'Wachtwoordherstel kon niet worden geopend. Probeer opnieuw.');
          setReady(false);
        }
      }
    }

    prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, [recoveryParams]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Gebruik minimaal 6 tekens.");
      return;
    }

    if (password !== repeatPassword) {
      setError("De wachtwoorden komen niet overeen.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setRepeatPassword('');
      setReady(false);
      setMessage('Je wachtwoord is opgeslagen. Je kunt nu inloggen met je nieuwe wachtwoord.');
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError('Je wachtwoord is opgeslagen, maar uitloggen is niet gelukt. Sluit dit venster.');
    } catch (failure) {
      setError(failure.message || 'Het wachtwoord kon niet worden opgeslagen. Probeer opnieuw.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="reset-password-page">
      <section className="reset-password-panel" aria-labelledby="reset-password-title">
        <div className="reset-password-icon" aria-hidden="true">🔐</div>
        <h1 id="reset-password-title">Nieuw wachtwoord instellen</h1>
        <p>Kies een nieuw wachtwoord voor je account</p>

        <form onSubmit={handleSubmit} className="reset-password-form">
          <label>
            <span>Nieuw wachtwoord</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimaal 6 tekens"
              minLength={6}
              autoComplete="new-password"
              disabled={!ready || saving}
            />
          </label>

          <label>
            <span>Herhaal wachtwoord</span>
            <input
              type="password"
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              placeholder="Typ je wachtwoord opnieuw"
              minLength={6}
              autoComplete="new-password"
              disabled={!ready || saving}
            />
          </label>

          <button type="submit" disabled={!ready || saving}>
            {saving ? "Opslaan..." : "✓ Wachtwoord opslaan"}
          </button>
        </form>

        {message && <div role="status" className="reset-password-alert success">{message}</div>}
        {error && <div role="alert" className="reset-password-alert error">✕ {error}</div>}
      </section>
    </main>
  );
}
