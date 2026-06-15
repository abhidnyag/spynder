"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@apollo/client";
import { useAuth } from "@/context/AuthContext";
import { REQUEST_PASSWORD_RESET, RESET_PASSWORD } from "@/graphql/operations";
import { validateEmail, validatePassword } from "@/lib/validation";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { BottomNav } from "@/components/ui/BottomNav";
import { Icon } from "@/components/ui/Icon";

const cleanErr = (err: unknown) => (err instanceof Error ? err.message.replace(/^.*?: /, "") : "Something went wrong.");

export function ProfileScreen({ resetToken }: { resetToken?: string }) {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-1 flex-col px-5 pt-3">
      <ScreenHeader title="Profile" />
      {loading ? (
        <p role="status" className="mt-10 text-center text-sub">Loading…</p>
      ) : user ? (
        <AccountView />
      ) : (
        <AuthForms initialResetToken={resetToken} />
      )}
      <BottomNav />
    </div>
  );
}

/* ----------------------------- signed in ----------------------------- */
function AccountView() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-lg font-bold text-white">{initial}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.name || "You"}</p>
          <p className="truncate text-sm text-sub">{user.email}</p>
        </div>
      </div>

      <ul className="mt-6">
        <li>
          <Link href="/favorites" className="flex items-center justify-between border-b border-line py-4 text-sm">
            Saved picks
            <Icon name="chevron" size={18} className="text-faint" />
          </Link>
        </li>
        {["Connected services", "Appearance", "About Spynder"].map((row) => (
          <li key={row} className="flex items-center justify-between border-b border-line py-4 text-sm text-sub">
            {row}
            <Icon name="chevron" size={18} className="text-faint" />
          </li>
        ))}
      </ul>

      <Button variant="ghost" onClick={() => logout()} className="mt-8">
        Log out
      </Button>
    </div>
  );
}

/* ----------------------------- signed out ----------------------------- */
function AuthForms({ initialResetToken }: { initialResetToken?: string }) {
  const { login, register } = useAuth();
  const [view, setView] = useState<"auth" | "reset">(initialResetToken ? "reset" : "auth");
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation for instant feedback (server re-validates too).
    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);
    if (tab === "register") {
      const passwordError = validatePassword(password);
      if (passwordError) return setError(passwordError);
      if (password !== confirm) return setError("Passwords do not match.");
    } else if (!password) {
      return setError("Enter your password.");
    }

    setBusy(true);
    try {
      if (tab === "login") await login(email, password);
      else await register(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^.*?: /, "") : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (view === "reset") {
    return (
      <ResetForm
        initialToken={initialResetToken}
        onDone={(msg) => {
          setView("auth");
          setTab("login");
          setNotice(msg);
        }}
        onCancel={() => setView("auth")}
      />
    );
  }

  return (
    <div className="mt-2">
      <p className="text-sm text-sub">Sign in to save picks and keep your history across devices.</p>
      {notice && <p role="status" className="mt-3 text-[13px] text-accent">{notice}</p>}

      <div role="group" aria-label="Log in or register" className="mt-4 flex gap-1 rounded-xl border border-line p-1">
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setError(null);
              setNotice(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold capitalize transition ${
              tab === t ? "bg-accent text-white" : "text-sub"
            }`}
          >
            {t === "login" ? "Log in" : "Register"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-5 space-y-3">
        {tab === "register" && <Field label="Name (optional)" value={name} onChange={setName} autoComplete="name" />}
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={tab === "login" ? "current-password" : "new-password"}
          required
        />
        {tab === "register" && (
          <p className="text-[11px] text-faint">At least 8 characters, including one special character (e.g. !@#$).</p>
        )}
        {tab === "register" && (
          <Field
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />
        )}
        {error && <p role="alert" className="text-[13px] text-[#e57373]">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-2">
          {busy ? "Please wait…" : tab === "login" ? "Log in" : "Create account"}
        </Button>
      </form>

      {tab === "login" && (
        <button
          type="button"
          onClick={() => {
            setView("reset");
            setError(null);
            setNotice(null);
          }}
          className="mt-4 w-full text-center text-[13px] text-sub underline-offset-2 hover:underline"
        >
          Forgot password?
        </button>
      )}
    </div>
  );
}

/* ----------------------------- password reset ----------------------------- */
function ResetForm({
  initialToken,
  onDone,
  onCancel,
}: {
  initialToken?: string;
  onDone: (notice: string) => void;
  onCancel: () => void;
}) {
  const [requestReset] = useMutation(REQUEST_PASSWORD_RESET);
  const [resetPasswordM] = useMutation(RESET_PASSWORD);

  const [step, setStep] = useState<1 | 2>(initialToken ? 2 : 1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);
    setBusy(true);
    try {
      const { data } = await requestReset({ variables: { email } });
      const devToken = data?.requestPasswordReset?.devToken as string | null;
      if (devToken) setToken(devToken);
      setInfo(
        devToken
          ? "No email service is configured, so your reset token has been filled in below for you."
          : "If that email is registered, a reset link has been sent.",
      );
      setStep(2);
    } catch (err) {
      setError(cleanErr(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token.trim()) return setError("Enter your reset token.");
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await resetPasswordM({ variables: { token: token.trim(), newPassword: password } });
      onDone("Password updated — you can now log in.");
    } catch (err) {
      setError(cleanErr(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <p className="text-sm text-sub">Reset your password</p>

      {step === 1 ? (
        <form onSubmit={sendLink} noValidate className="mt-5 space-y-3">
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
          {error && <p role="alert" className="text-[13px] text-[#e57373]">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-2">
            {busy ? "Please wait…" : "Send reset link"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitReset} noValidate className="mt-5 space-y-3">
          {info && <p role="status" className="text-[13px] text-accent">{info}</p>}
          <Field label="Reset token" value={token} onChange={setToken} required />
          <Field label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
          <p className="text-[11px] text-faint">At least 8 characters, including one special character (e.g. !@#$).</p>
          <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />
          {error && <p role="alert" className="text-[13px] text-[#e57373]">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-2">
            {busy ? "Please wait…" : "Update password"}
          </Button>
        </form>
      )}

      <button type="button" onClick={onCancel} className="mt-4 w-full text-center text-[13px] text-sub underline-offset-2 hover:underline">
        Back to log in
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-sub">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
      />
    </label>
  );
}
