"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setDone(true);
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✉️</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-0)", margin: "0 0 10px" }}>Check your email</h2>
          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto 24px" }}>
            We sent a confirmation link to <strong style={{ color: "var(--text-0)" }}>{email}</strong>.<br />
            Click the link to activate your account.
          </p>
          <Link href="/demo/dashboard" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
            Explore the demo while you wait →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-0)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36, justifyContent: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--ai))", display: "grid", placeItems: "center" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <Link href="/" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)", textDecoration: "none", letterSpacing: "-0.02em" }}>Backhaul</Link>
        </div>

        <div style={{ background: "var(--bg-1)", border: "1px solid var(--border-1)", borderRadius: 14, padding: "32px 28px" }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-0)", margin: "0 0 6px" }}>Create your account</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 24px" }}>
            Already have one?{" "}
            <Link href="/auth/login" style={{ color: "var(--accent)", textDecoration: "none" }}>Sign in</Link>
          </p>

          {/* Google OAuth */}
          <button
            type="button" onClick={handleGoogle}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "9px 0", marginBottom: 16, background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 7, fontSize: 13, fontWeight: 500, color: "var(--text-1)", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-0)" }} />
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-0)" }} />
          </div>

          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Full name",     type: "text",     value: fullName,     setter: setFullName,     placeholder: "Your name" },
              { label: "Company name",  type: "text",     value: companyName,  setter: setCompanyName,  placeholder: "Acme Furniture Co." },
              { label: "Work email",    type: "email",    value: email,        setter: setEmail,        placeholder: "you@company.com" },
              { label: "Password",      type: "password", value: password,     setter: setPassword,     placeholder: "Min 8 characters" },
            ].map(({ label, type, value, setter, placeholder }) => (
              <div key={label}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", display: "block", marginBottom: 5 }}>{label}</label>
                <input
                  type={type} value={value} required
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  style={{ width: "100%", padding: "8px 12px", background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 7, fontSize: 13, color: "var(--text-0)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}

            {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: 0 }}>{error}</p>}

            <button
              type="submit" disabled={loading}
              style={{ padding: "11px 0", background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.65 : 1, marginTop: 4 }}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-3)", marginTop: 16, lineHeight: 1.6 }}>
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
