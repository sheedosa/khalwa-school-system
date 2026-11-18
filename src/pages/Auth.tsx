import { FormEvent, ReactNode, useState } from "react";
import { cloudAuth, defaultYear, signOut, useApp } from "../store";
import { BrandScreen, Field, Icon, Segmented, toast } from "../ui";


function Shell({ children, lead }: { children: ReactNode; lead: string }) {
  return <BrandScreen title={lead}>{children}</BrandScreen>;
}

/** Everything a person sees before they are inside the system. */
export function CloudGate() {
  const { cloud } = useApp();
  if (cloud.phase === "signedOut") return <SignIn />;
  if (cloud.phase === "unverified") return <Verify email={cloud.email} />;
  if (cloud.phase === "setup") return <Setup email={cloud.email} />;
  if (cloud.phase === "noAccess") {
    return (
      <Shell lead="This email has not been added yet">
        <p className="login-note left">You are signed in as <b>{cloud.email}</b>, but an admin has not added this email to the school's staff. Ask them to add it under Settings, Staff accounts, then sign in again.</p>
        <button type="button" className="btn block" onClick={signOut}><Icon name="logout" size={17} />Sign out</button>
      </Shell>
    );
  }
  return <Shell lead="Opening the school's records…"><div className="spinner" aria-label="Loading" /></Shell>;
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "new">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const problem = mode === "in" ? await cloudAuth.signIn(email, password) : await cloudAuth.register(email, password);
    setBusy(false);
    if (problem) setError(problem);
  };
  const reset = async () => {
    if (!email.trim()) return setError("Type your email first, then press Forgot password.");
    const problem = await cloudAuth.resetPassword(email);
    if (problem) setError(problem);
    else toast("Password reset email sent");
  };
  return (
    <Shell lead="Sign in">
      <form className="form one full" onSubmit={submit}>
        <Segmented value={mode} onChange={(m) => { setMode(m); setError(""); }} options={[{ value: "in", label: "Sign in" }, { value: "new", label: "First time here" }]} />
        <Field label="Email"><input type="email" required autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={mode === "in" ? "Password" : "Choose a password"} hint={mode === "new" ? "At least 6 characters. Use the email the school has on file for you." : undefined}>
          <input type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="inline-warn"><Icon name="alert" size={18} /><span>{error}</span></p>}
        <button type="submit" className="btn primary block" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create my password"}</button>
        {mode === "in" && <button type="button" className="btn ghost block" onClick={reset}>Forgot password</button>}
      </form>
    </Shell>
  );
}

function Verify({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const check = async () => {
    setBusy(true);
    setError("");
    const problem = await cloudAuth.recheckVerified();
    setBusy(false);
    if (problem) setError(problem);
  };
  const resend = async () => {
    const problem = await cloudAuth.resendVerification();
    if (problem) setError(problem);
    else toast("Email sent again");
  };
  return (
    <Shell lead="Check your email">
      <p className="login-note left">We sent a link to <b>{email}</b>. Open it to confirm the address is yours, then come back here. It can take a minute, and may land in spam.</p>
      {error && <p className="inline-warn"><Icon name="alert" size={18} /><span>{error}</span></p>}
      <button type="button" className="btn primary block" disabled={busy} onClick={check}>{busy ? "Checking…" : "I have opened the link"}</button>
      <button type="button" className="btn ghost block" onClick={resend}>Send the email again</button>
      <button type="button" className="btn ghost block" onClick={signOut}>Use a different email</button>
    </Shell>
  );
}

function Setup({ email }: { email: string }) {
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [fee, setFee] = useState("");
  const [start, setStart] = useState(defaultYear().start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(fee);
    if (!name.trim() || fee === "" || !(amount >= 0) || !start) return;
    setBusy(true);
    setError("");
    const problem = await cloudAuth.setupSchool({ name: name.trim(), fee: amount, start, branch: branch.trim() });
    setBusy(false);
    if (problem) setError(problem);
  };
  return (
    <Shell lead="Set up the school">
      <p className="login-note left">Nobody has set this system up yet. Whoever completes this step becomes its owner, <b>{email}</b>, with full admin access. Everything here can be changed later in Settings.</p>
      <form className="form one full" onSubmit={submit}>
        <Field label="Your name"><input required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Name of the first branch" hint="The other branch (London) is created switched off, ready for later."><input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Manchester" /></Field>
        <div className="form two">
          <Field label="Monthly fee (£)"><input required type="number" inputMode="decimal" min="0" step="any" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
          <Field label="School year starts"><input required type="month" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        </div>
        {error && <p className="inline-warn"><Icon name="alert" size={18} /><span>{error}</span></p>}
        <button type="submit" className="btn primary block" disabled={busy}>{busy ? "Setting up…" : "Set up the school"}</button>
        <button type="button" className="btn ghost block" onClick={signOut}>Sign out</button>
      </form>
    </Shell>
  );
}
