import { FormEvent, ReactNode, useRef, useState } from "react";
import { addMonths, Branch, dateLabel, feeFor, gbp, monthLabel, monthsBetween, Role, User } from "../logic";
import { useScope } from "../scope";
import {
  branchName, clearRecords, exportBackup, importBackup, removeFee, resetSample, saveBranch, saveReceiptSettings, saveSchool, saveUser, saveYear, setFee, setTheme, signOut, startNextYear, today, useApp, userName,
} from "../store";
import { Dialog, download, Empty, Field, Icon, Page, Pill, Segmented, toast, useIsMobile } from "../ui";

const SECTIONS: { id: string; label: string; icon: string; sub: string; admin: boolean }[] = [
  { id: "school", label: "School", icon: "building", sub: "Name and contact details", admin: true },
  { id: "fee", label: "Monthly fee", icon: "coins", sub: "The flat fee and when it changes", admin: true },
  { id: "year", label: "Academic year", icon: "calendar", sub: "First and last month, months with no fee", admin: true },
  { id: "branches", label: "Branches", icon: "swap", sub: "Locations and receipt prefixes", admin: true },
  { id: "staff", label: "Staff accounts", icon: "students", sub: "Who can sign in, and to which branch", admin: true },
  { id: "receipts", label: "Receipts", icon: "receipt", sub: "Paper size and footer", admin: true },
  { id: "data", label: "Backup and data", icon: "database", sub: "Download, restore, start clean", admin: true },
  { id: "activity", label: "Activity log", icon: "clock", sub: "Who changed what, and when", admin: true },
  { id: "account", label: "My account", icon: "user", sub: "Theme and sign out", admin: false },
];

export function SettingsPage({ section }: { section?: string }) {
  const { admin } = useScope();
  const mobile = useIsMobile();
  const sections = SECTIONS.filter((s) => admin || !s.admin);
  const current = sections.find((s) => s.id === section) || (mobile ? null : sections[0]);
  const body: Record<string, ReactNode> = { school: <School />, fee: <Fee />, year: <Year />, branches: <Branches />, staff: <Staff />, receipts: <ReceiptSettings />, data: <Data />, activity: <ActivityLog />, account: <Account /> };
  const menu = (
    <nav className="card list settings-nav" aria-label="Settings sections">
      {sections.map((s) => (
        <a key={s.id} className="row link" href={"#/settings/" + s.id} aria-current={current?.id === s.id ? "page" : undefined}>
          <span className="row-icon"><Icon name={s.icon} size={19} /></span>
          <span className="grow"><b>{s.label}</b><small>{s.sub}</small></span>
          <Icon name="next" size={16} />
        </a>
      ))}
    </nav>
  );
  if (mobile) {
    return current
      ? <Page title={current.label} back="/settings">{body[current.id]}</Page>
      : <Page title="Settings" back="/more">{menu}{!admin && <p className="muted small">School settings are managed by an admin.</p>}</Page>;
  }
  return (
    <Page title="Settings" wide>
      <div className="settings">
        {menu}
        <div className="settings-body">{current && body[current.id]}</div>
      </div>
    </Page>
  );
}

function Card({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card">
      <header className="card-h"><div className="grow"><h2>{title}</h2>{sub && <span className="muted small">{sub}</span>}</div>{action}</header>
      {children}
    </section>
  );
}

function School() {
  const { db } = useScope();
  const [v, setV] = useState(db.settings.school);
  const submit = (e: FormEvent) => { e.preventDefault(); saveSchool({ ...v, currency: "GBP" }); toast("School details saved"); };
  return (
    <Card title="School" sub="Shown on receipts and reports">
      <form className="form pad" onSubmit={submit}>
        <Field label="Name"><input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Name in Arabic"><input dir="rtl" lang="ar" value={v.nameAr} onChange={(e) => setV({ ...v, nameAr: e.target.value })} /></Field>
        <Field label="Phone"><input type="tel" placeholder="020 xxxx xxxx" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
        <Field label="Address" wide><input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
        <div className="form-end wide"><button className="btn primary" type="submit">Save</button></div>
      </form>
    </Card>
  );
}

function Fee() {
  const { db, now, cur } = useScope();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(addMonths(now, 1));
  const fees = [...db.settings.fees].sort((a, b) => (a.from < b.from ? 1 : -1));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!(n >= 0) || amount === "" || !from) return;
    setFee(from, n);
    toast(`Fee is ${gbp(n)} from ${monthLabel(from)}`);
    setAmount("");
  };
  return (
    <>
      <Card title="Monthly fee" sub="One flat fee for every student">
        <div className="fee-now"><span className="muted">Fee for {monthLabel(now)}</span><b className="gold">{gbp(feeFor(db.settings, now))}</b></div>
        <form className="form pad" onSubmit={submit}>
          <Field label={`New amount (£)`}><input type="number" inputMode="decimal" min="0" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Applies from" hint="Earlier months keep the amount they had"><input type="month" required value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <div className="form-end wide"><button className="btn primary" type="submit">Set fee</button></div>
        </form>
      </Card>
      <Card title="Fee history">
        <div className="list">
          {fees.map((f) => (
            <div className="row" key={f.from}>
              <span className="grow"><b>{gbp(f.amount)}</b><small>from {monthLabel(f.from)}{f.from > now ? " (upcoming)" : ""}</small></span>
              {fees.length > 1 && <button type="button" className="btn sm ghost" onClick={() => { removeFee(f.from); toast("Fee change removed"); }}>Remove</button>}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Year() {
  const { db } = useScope();
  const y = db.settings.year;
  const [start, setStart] = useState(y.start);
  const [end, setEnd] = useState(y.end);
  const [noFee, setNoFee] = useState<string[]>(y.noFee);
  const [confirm, setConfirm] = useState(false);
  const months = start && end && start <= end ? monthsBetween(start, end) : [];
  const dirty = start !== y.start || end !== y.end || noFee.join() !== y.noFee.join();
  return (
    <>
      <Card title="Academic year" sub="Fees are charged in pounds for each month in this range">
        <div className="form pad">
          <Field label="First month"><input type="month" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Last month"><input type="month" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
          <div className="field wide">
            <span className="field-label">Months with no fee</span>
            <div className="chips wrap">
              {months.map((m) => {
                const on = noFee.includes(m);
                return <button key={m} type="button" className={"chip" + (on ? " on" : "")} onClick={() => setNoFee(on ? noFee.filter((x) => x !== m) : [...noFee, m].sort())}>{monthLabel(m, true)}</button>;
              })}
            </div>
            <span className="hint">Tap a month to make it free for everyone, for example a holiday month.</span>
          </div>
          <div className="form-end wide"><button type="button" className="btn primary" disabled={!dirty || !months.length} onClick={() => { saveYear({ start, end, noFee: noFee.filter((m) => months.includes(m)) }); toast("Academic year saved"); }}>Save</button></div>
        </div>
      </Card>
      <Card title="Start a new year" sub={`Moves the year to ${monthLabel(addMonths(y.start, 12))} – ${monthLabel(addMonths(y.end, 12))}`}>
        <div className="pad stack-sm">
          <p className="muted">Students, classes and all receipts are kept. Do this once the current year has finished.</p>
          <div><button type="button" className="btn" onClick={() => setConfirm(true)}>Start new year</button></div>
        </div>
      </Card>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Start a new academic year?"
        footer={<><button type="button" className="btn" onClick={() => setConfirm(false)}>Cancel</button><button type="button" className="btn primary grow" onClick={() => { startNextYear(); setConfirm(false); setStart(addMonths(y.start, 12)); setEnd(addMonths(y.end, 12)); setNoFee([]); toast("New academic year started"); }}>Start new year</button></>}>
        <p>The monthly sheet and owed list will switch to {monthLabel(addMonths(y.start, 12))} – {monthLabel(addMonths(y.end, 12))}. Anything still unpaid from this year stays owed and keeps showing on the owed list and statements.</p>
      </Dialog>
    </>
  );
}

function Branches() {
  const { db } = useScope();
  const [edit, setEdit] = useState<Branch | "new" | null>(null);
  return (
    <>
      <Card title="Branches" sub="Every student, class and receipt belongs to one branch" action={<button type="button" className="btn sm" onClick={() => setEdit("new")}><Icon name="plus" size={16} />Add</button>}>
        <div className="list">
          {db.branches.map((b) => (
            <div className="row" key={b.id}>
              <span className="row-icon"><Icon name="building" size={19} /></span>
              <span className="grow"><b>{b.name}</b><small>{db.students.filter((s) => s.branchId === b.id && !s.leftDate).length} active students · receipts {b.prefix}-{String(b.nextReceipt).padStart(4, "0")} next{b.address ? " · " + b.address : ""}</small></span>
              {b.active ? <Pill tone="ok">Open</Pill> : <Pill tone="off">Switched off</Pill>}
              <button type="button" className="btn sm ghost" onClick={() => setEdit(b)}>Edit</button>
            </div>
          ))}
        </div>
      </Card>
      {edit && <BranchDialog b={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
function BranchDialog({ b, onClose }: { b: Branch | null; onClose: () => void }) {
  const { db } = useScope();
  const [v, setV] = useState({ name: b?.name || "", address: b?.address || "", prefix: b?.prefix || "KQ" + (db.branches.length + 1), active: b?.active ?? true });
  const clash = db.branches.some((x) => x.id !== b?.id && x.prefix.toLowerCase() === v.prefix.trim().toLowerCase());
  const lastOpen = !!b && b.active && db.branches.filter((x) => x.active).length === 1;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim() || !v.prefix.trim() || clash) return;
    saveBranch({ ...v, name: v.name.trim(), prefix: v.prefix.trim().toUpperCase() }, b?.id);
    toast(b ? "Branch saved" : "Branch added");
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={b ? "Edit branch" : "Add branch"} footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="branch-form" className="btn primary grow">{b ? "Save" : "Add branch"}</button></>}>
      <form id="branch-form" className="form one" onSubmit={submit}>
        <Field label="Branch name"><input required autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="For example: the neighbourhood name" /></Field>
        <Field label="Address"><input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
        <Field label="Receipt prefix" hint={clash ? <span className="err">Another branch already uses this prefix.</span> : `Receipts will be numbered ${v.prefix.toUpperCase() || "XX"}-0001, ${v.prefix.toUpperCase() || "XX"}-0002…`}><input required maxLength={5} value={v.prefix} onChange={(e) => setV({ ...v, prefix: e.target.value })} /></Field>
        <label className={"switch" + (lastOpen ? " disabled" : "")}>
          <input type="checkbox" checked={v.active} disabled={lastOpen} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          <span className="grow"><b>Branch is open</b><small>{lastOpen ? "At least one branch must stay open." : "Switched-off branches are hidden but keep all their records."}</small></span>
        </label>
      </form>
    </Dialog>
  );
}

function Staff() {
  const { db, user } = useScope();
  const [edit, setEdit] = useState<User | "new" | null>(null);
  return (
    <>
      <Card title="Staff accounts" sub="Staff register students and take payments. Admins also change fees, void receipts and manage settings." action={<button type="button" className="btn sm" onClick={() => setEdit("new")}><Icon name="plus" size={16} />Add</button>}>
        <div className="list">
          {db.users.map((u) => (
            <div className={"row" + (u.active ? "" : " voided")} key={u.id}>
              <span className="grow"><b>{u.name}{u.id === user.id ? " (you)" : ""}</b><small>{u.email} · {u.role === "admin" ? "all branches" : branchName(db, u.branchId || "")}</small></span>
              {!u.active ? <Pill tone="off">Deactivated</Pill> : <Pill tone={u.role === "admin" ? "teal" : "off"}>{u.role === "admin" ? "Admin" : "Staff"}</Pill>}
              <button type="button" className="btn sm ghost" onClick={() => setEdit(u)}>Edit</button>
            </div>
          ))}
        </div>
      </Card>
      <p className="muted small">In this test version, accounts appear on the sign-in screen without a password. Email invitations and passwords are added when the system goes live.</p>
      {edit && <UserDialog u={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
function UserDialog({ u, onClose }: { u: User | null; onClose: () => void }) {
  const { db } = useScope();
  const [v, setV] = useState({ name: u?.name || "", email: u?.email || "", role: (u?.role || "staff") as Role, branchId: u?.branchId || db.branches[0].id, active: u?.active ?? true });
  const [err, setErr] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return;
    const problem = saveUser({ name: v.name.trim(), email: v.email.trim(), role: v.role, branchId: v.role === "admin" ? null : v.branchId, active: v.active }, u?.id);
    if (problem) return setErr(problem);
    toast(u ? "Account saved" : "Account added");
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={u ? "Edit account" : "Add staff account"} footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="user-form" className="btn primary grow">{u ? "Save" : "Add account"}</button></>}>
      <form id="user-form" className="form one" onSubmit={submit}>
        <Field label="Name"><input required autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Email"><input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Role"><Segmented value={v.role} onChange={(role) => setV({ ...v, role })} options={[{ value: "staff", label: "Staff" }, { value: "admin", label: "Admin" }]} /></Field>
        {v.role === "staff" && <Field label="Branch"><select value={v.branchId} onChange={(e) => setV({ ...v, branchId: e.target.value })}>{db.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
        {u && <label className="switch"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /><span className="grow"><b>Can sign in</b><small>Deactivated staff keep their name on old receipts.</small></span></label>}
        {err && <p className="inline-warn"><Icon name="alert" size={18} /><span>{err}</span></p>}
      </form>
    </Dialog>
  );
}

function ReceiptSettings() {
  const { db } = useScope();
  const [v, setV] = useState(db.settings.receipt);
  return (
    <Card title="Receipts" sub="How printed receipts look">
      <div className="form pad">
        <Field label="Paper"><Segmented value={v.paper} onChange={(paper) => setV({ ...v, paper })} options={[{ value: "A5", label: "A5 sheet" }, { value: "Thermal", label: "Thermal roll (80mm)" }]} /></Field>
        <Field label="Footer line"><input dir="auto" value={v.footer} onChange={(e) => setV({ ...v, footer: e.target.value })} placeholder="A thank-you line or the school phone" /></Field>
        <div className="field wide">
          <span className="field-label">Next receipt numbers</span>
          <div className="chips wrap">{db.branches.map((b) => <span className="chip static" key={b.id}>{b.name}: {b.prefix}-{String(b.nextReceipt).padStart(4, "0")}</span>)}</div>
          <span className="hint">Numbers only move forward and are never reused, even when a receipt is voided.</span>
        </div>
        <div className="form-end wide"><button type="button" className="btn primary" onClick={() => { saveReceiptSettings(v); toast("Receipt settings saved"); }}>Save</button></div>
      </div>
    </Card>
  );
}

function Data() {
  const { db } = useScope();
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<null | "sample" | "clear">(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const problem = importBackup(await f.text());
    toast(problem || "Backup restored");
    if (file.current) file.current.value = "";
  };
  return (
    <>
      <Card title="Backup" sub={db.settings.lastBackup ? "Last downloaded " + dateLabel(db.settings.lastBackup) : "No backup downloaded yet"}>
        <div className="pad stack-sm">
          <p className="muted">A backup is one file with every student, receipt, note and setting. Keep a copy somewhere safe each month.</p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { download(`khalwa-backup-${today()}.json`, exportBackup(), "application/json"); toast("Backup downloaded"); }}><Icon name="download" size={17} />Download backup</button>
            <button type="button" className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={17} />Restore from a backup</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        </div>
      </Card>
      <Card title="Test data" sub="For trying the system out">
        <div className="pad stack-sm">
          <p className="muted">This test version starts with sample students so every screen has something to show. Everything is stored in this browser only: other devices will not see what you enter here.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setConfirm("sample")}>Reload sample data</button>
            <button type="button" className="btn danger-ghost" onClick={() => setConfirm("clear")}>Remove all students and payments</button>
          </div>
        </div>
      </Card>
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm === "sample" ? "Reload sample data?" : "Remove all students and payments?"}
        footer={<><button type="button" className="btn" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className="btn danger grow" onClick={() => { if (confirm === "sample") resetSample(); else clearRecords(); setConfirm(null); toast(confirm === "sample" ? "Sample data reloaded" : "Students and payments removed"); }}>{confirm === "sample" ? "Reload sample data" : "Remove everything"}</button></>}>
        <p>{confirm === "sample" ? "Everything entered on this device is replaced with the original sample students, classes and settings." : "Students, receipts and notes are deleted so you can enter real ones. Settings, branches, classes and staff accounts are kept. Receipt numbers start again from 0001."}</p>
        <p className="muted small">Download a backup first if you might want this data again.</p>
      </Dialog>
    </>
  );
}

function ActivityLog() {
  const { db } = useScope();
  return (
    <Card title="Activity log" sub="The latest 400 changes on this device">
      <div className="list">
        {db.activity.slice(0, 100).map((a) => (
          <div className="row" key={a.id}>
            <span className="grow"><b>{a.action}</b><small>{a.detail}</small></span>
            <span className="row-end"><small>{userName(db, a.by)}</small><small>{dateLabel(a.at)}, {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span>
          </div>
        ))}
        {!db.activity.length && <Empty title="Nothing logged yet" icon="clock">Registrations, payments, voids and setting changes are listed here.</Empty>}
      </div>
    </Card>
  );
}

function Account() {
  const app = useApp();
  const { user, db } = useScope();
  return (
    <>
      <Card title="My account">
        <dl className="kv">
          <dt>Name</dt><dd>{user.name}</dd>
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Role</dt><dd>{user.role === "admin" ? "Admin, all branches" : "Staff, " + branchName(db, user.branchId || "")}</dd>
        </dl>
      </Card>
      <Card title="Appearance">
        <div className="pad"><Segmented value={app.session.theme} onChange={setTheme} options={[{ value: "system", label: "Match device" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} /></div>
      </Card>
      <button type="button" className="btn start" onClick={signOut}><Icon name="logout" size={17} />Sign out</button>
    </>
  );
}
