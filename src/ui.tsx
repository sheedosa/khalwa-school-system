import { ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { DB, fmt, initials, MonthStatus } from "./logic";
import { currentUser, getState, isAdmin, setView, useApp } from "./store";

/* ---------- router (hash based, so it works on any static host) ---------- */
let wasPop = false;
let pushing = false;
function subscribeHash(cb: () => void) {
  const h = () => {
    wasPop = !pushing;
    pushing = false;
    cb();
  };
  window.addEventListener("hashchange", h);
  return () => window.removeEventListener("hashchange", h);
}
export function usePath() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const p = hash.replace(/^#/, "");
  return p.startsWith("/") ? p : "/";
}
export function go(path: string, replace = false) {
  if ("#" + path === window.location.hash) return;
  pushing = true;
  if (replace) window.location.replace("#" + path);
  else window.location.hash = path;
}
export function goBack(fallback: string) {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}

/* ---------- responsive ---------- */
const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 899px)") : null;
export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener("change", cb);
      return () => mq?.removeEventListener("change", cb);
    },
    () => !!mq?.matches,
  );
}

/* ---------- icons ---------- */
const PATHS: Record<string, string> = {
  home: "M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  students: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4.5-6.2",
  plus: "M12 5v14M5 12h14",
  collect: "M4.5 6h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 12h.01M18 12h.01",
  sheet: "M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18M9 10v11M15 10v11M8 2v4M16 2v4",
  receipt: "M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21zM9 8h6M9 12h6M9 16h3",
  report: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  classes: "M3 7l9-4 9 4-9 4zM6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M21 7v6",
  settings: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  print: "M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z",
  share: "M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
  download: "M12 3v12M8 11l4 4 4-4M4 19h16",
  upload: "M12 16V4M8 8l4-4 4 4M4 20h16",
  note: "M5 4h14v12l-5 5H5zM14 21v-5h5M8 9h8M8 13h5",
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  logout: "M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9",
  phone: "M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z",
  book: "M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  menu: "M4 7h16M4 12h16M4 17h16",
  swap: "M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  database: "M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8zM4 5.5v13C4 19.9 7.6 21 12 21s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  coins: "M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM15.5 9.2A6 6 0 1 1 9.2 15.5",
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

/* ---------- small pieces ---------- */
export function Money({ n, cur = true }: { n: number; cur?: boolean }) {
  const currency = getState().db.settings.school.currency;
  return (
    <span className="money">
      {fmt(n)}
      {cur && <small> {currency}</small>}
    </span>
  );
}
export function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "teal" | "off" | "gold"; children: ReactNode }) {
  return <span className={"pill " + tone}>{children}</span>;
}
export function StatusPill({ status, months = 1 }: { status: MonthStatus; months?: number }) {
  switch (status) {
    case "paid": return <Pill tone="ok">Paid</Pill>;
    case "partial": return <Pill tone="warn">Part paid</Pill>;
    case "due": return <Pill tone="bad">{months > 1 ? `${months} months due` : "Unpaid"}</Pill>;
    case "waived": return <Pill tone="off">Waived</Pill>;
    case "exempt": return <Pill tone="off">Exempt</Pill>;
    case "nofee": return <Pill tone="off">No fee</Pill>;
    case "future": return <Pill tone="off">Not due</Pill>;
    default: return <span className="faint">–</span>;
  }
}
export function Avatar({ name, size }: { name: string; size?: "lg" }) {
  return <span className={"avatar" + (size ? " " + size : "")}>{initials(name)}</span>;
}
export function Empty({ title, children, icon = "search" }: { title: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <b>{title}</b>
      {children && <span>{children}</span>}
    </div>
  );
}
export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={"field" + (wide ? " wide" : "")}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function SearchInput({ value, onChange, placeholder, autoFocus, id }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; id?: string }) {
  return (
    <div className="search">
      <Icon name="search" size={18} />
      <input id={id} type="search" inputMode="search" autoComplete="off" autoFocus={autoFocus} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" className="clear" aria-label="Clear search" onClick={() => onChange("")}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

/* ---------- toast ---------- */
let pushToast: (m: string) => void = () => {};
export function toast(message: string) {
  pushToast(message);
}
export function Toaster() {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    let t: number;
    pushToast = (text) => {
      setMsg({ id: Date.now(), text });
      window.clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 2800);
    };
    return () => window.clearTimeout(t);
  }, []);
  return msg ? (
    <div className="toast" key={msg.id} role="status">
      <Icon name="check" size={18} />
      {msg.text}
    </div>
  ) : null;
}

/* ---------- dialog: centred on desktop, bottom sheet on phones ---------- */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"dialog" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-h">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="dialog-b">{children}</div>
        {footer && <div className="dialog-f">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- branch switcher ---------- */
export function BranchSwitch() {
  const app = useApp();
  const u = currentUser(app);
  if (!u) return null;
  const active = app.db.branches.filter((b) => b.active);
  if (u.role === "staff" || active.length < 2) {
    const b = app.db.branches.find((b) => b.id === (u.branchId || active[0]?.id));
    return <span className="branch-chip static"><Icon name="building" size={16} />{b?.name}</span>;
  }
  const value = app.session.view === "all" || !active.some((b) => b.id === app.session.view) ? "all" : app.session.view;
  return (
    <label className="branch-chip">
      <Icon name="building" size={16} />
      <select aria-label="Branch" value={value} onChange={(e) => setView(e.target.value)}>
        <option value="all">Both branches</option>
        {active.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </label>
  );
}

/* ---------- desktop quick search ---------- */
export function QuickSearch() {
  const { db } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const hits = q.trim() ? searchStudents(db, q).slice(0, 7) : [];
  const pick = (id: string) => {
    setQ("");
    setOpen(false);
    ref.current?.blur();
    go("/students/" + id);
  };
  return (
    <div className="quick">
      <Icon name="search" size={17} />
      <input ref={ref} value={q} placeholder="Find a student" aria-label="Find a student" onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) pick(hits[0].id); if (e.key === "Escape") { setQ(""); ref.current?.blur(); } }} />
      <kbd>Ctrl K</kbd>
      {open && q.trim() && (
        <div className="quick-pop">
          {hits.length ? hits.map((s) => (
            <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(s.id); }}>
              <Avatar name={s.name} />
              <span className="grow"><b>{s.name}</b><small>{s.no} · {s.phone}</small></span>
            </button>
          )) : <div className="quick-none">No student matches</div>}
        </div>
      )}
    </div>
  );
}
export function searchStudents(db: DB, q: string) {
  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, "");
  return db.students.filter((s) => s.name.toLowerCase().includes(t) || s.nameAr.includes(q.trim()) || s.no.toLowerCase().includes(t) || s.guardian.toLowerCase().includes(t) || (digits.length > 2 && (s.phone + s.phone2).replace(/\D/g, "").includes(digits)));
}

/* ---------- page frame ---------- */
const scrollMemo = new Map<string, number>();
export function Page({ title, back, actions, toolbar, footer, children, wide }: { title: ReactNode; back?: string; actions?: ReactNode; toolbar?: ReactNode; footer?: ReactNode; children: ReactNode; wide?: boolean }) {
  const mobile = useIsMobile();
  const path = usePath();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = wasPop ? scrollMemo.get(path) || 0 : 0;
    const onScroll = () => scrollMemo.set(path, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [path]);
  return (
    <div className="main">
      <header className="topbar">
        {back && (
          <button type="button" className="iconbtn back" aria-label="Back" onClick={() => goBack(back)}>
            <Icon name="back" />
          </button>
        )}
        <h1>{title}</h1>
        <div className="topbar-tools">
          {!mobile && <QuickSearch />}
          {!back || !mobile ? <BranchSwitch /> : null}
          {actions}
        </div>
      </header>
      {toolbar && <div className="toolbar-strip">{toolbar}</div>}
      <div className="scroll" ref={ref}>
        <div className={"page" + (wide ? " wide" : "")} key={path}>{children}</div>
      </div>
      {footer && <div className="footbar">{footer}</div>}
    </div>
  );
}

/* ---------- files ---------- */
export function download(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** CSV with a byte-order mark so Excel opens Arabic names correctly. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  download(filename, "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n"), "text/csv");
}

export function AdminOnly({ children }: { children: ReactNode }) {
  useApp();
  return isAdmin() ? <>{children}</> : null;
}
