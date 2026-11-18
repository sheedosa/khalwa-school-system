import { FormEvent, useState } from "react";
import { balance, dateLabel, feeFor, fmt, isActive, MON, monthLabel, monthStatus, Note, NoteType, owed, paid, receiptTotal, Student, yearMonths, ymOf } from "../logic";
import { useScope } from "../scope";
import { addNote, branchName, canDeleteNote, className, deleteNote, markLeft, today, toggleExempt, transferStudent, userName } from "../store";
import { Avatar, Dialog, Empty, Field, go, Icon, Money, Page, Pill, Segmented, toast } from "../ui";

type Tab = "overview" | "payments" | "notes";
const tabMemo = new Map<string, Tab>();

export const NOTE_META: Record<NoteType, { label: string; icon: string }> = {
  payment: { label: "Payment", icon: "coins" },
  progress: { label: "Qur'an progress", icon: "book" },
  conduct: { label: "Behaviour and attendance", icon: "flag" },
};

export function StudentProfile({ id }: { id: string }) {
  const { db, admin, now, cur, branchIds } = useScope();
  const s = db.students.find((x) => x.id === id);
  const [tab, setTabState] = useState<Tab>(tabMemo.get(id) || "overview");
  const [noteOpen, setNoteOpen] = useState<NoteType | null>(null);
  const [menu, setMenu] = useState<null | "menu" | "left" | "transfer">(null);
  const setTab = (t: Tab) => { tabMemo.set(id, t); setTabState(t); };

  if (!s || !branchIds.includes(s.branchId)) {
    return <Page title="Student" back="/students"><div className="card"><Empty title="Student not found">They may belong to a branch you are not viewing.</Empty></div></Page>;
  }
  const active = isActive(s);
  const bal = balance(db, s, now);
  const receipts = db.receipts.filter((r) => r.studentId === s.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const notes = db.notes.filter((n) => n.studentId === s.id).sort((a, b) => (a.date + a.createdAt < b.date + b.createdAt ? 1 : -1));
  const months = yearMonths(db);
  const earlier = bal - months.filter((m) => m <= now).reduce((a, m) => a + owed(db, s, m), 0);
  const lastProgress = notes.find((n) => n.type === "progress");
  const absences = notes.filter((n) => n.type === "conduct" && n.kind === "Absent" && ymOf(n.date) === now).length;
  const age = s.dob ? Math.floor((Date.now() - new Date(s.dob).getTime()) / (365.25 * 864e5)) : null;

  const tapMonth = (m: string) => {
    const st = monthStatus(db, s, m, now);
    if (st === "paid" || st === "partial") {
      const r = receipts.find((r) => !r.void && r.lines.some((l) => l.month === m));
      if (r) go("/receipts/" + r.id);
    } else if (st === "due" || st === "future") {
      if (active) go("/collect/" + s.id);
    } else if (st === "exempt" && admin) {
      toggleExempt(s.id, m);
      toast(monthLabel(m) + " is charged again");
    }
  };

  return (
    <Page
      title={s.name}
      back="/students"
      actions={
        <>
          <a className="btn desk-only" href={`#/students/${s.id}/edit`}><Icon name="edit" size={17} />Edit</a>
          <button type="button" className="iconbtn" aria-label="More actions" onClick={() => setMenu("menu")}><Icon name="more" /></button>
        </>
      }
      footer={active && !s.waived ? <a className="btn gold grow" href={"#/collect/" + s.id}><Icon name="collect" size={18} />Collect payment</a> : undefined}
    >
      <section className="profile-head">
        <Avatar name={s.name} size="lg" />
        <div className="grow">
          <h2>{s.name}</h2>
          {s.nameAr && <span className="ar" lang="ar">{s.nameAr}</span>}
          <div className="tags">
            <span className="faint num">{s.no}</span>
            {active ? <Pill tone="teal">Active</Pill> : <Pill tone="off">Left {dateLabel(s.leftDate!)}</Pill>}
            {s.waived && <Pill tone="gold">Fee waived</Pill>}
          </div>
        </div>
        <div className={"balance " + (bal > 0 ? "bad" : "ok")}>
          <span>{bal > 0 ? "Owes" : s.waived ? "Fee" : "Balance"}</span>
          <b>{s.waived ? "Waived" : <Money n={bal} />}</b>
        </div>
      </section>

      <Segmented value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "payments", label: `Payments (${receipts.length})` }, { value: "notes", label: `Notes (${notes.length})` }]} />

      {tab === "overview" && (
        <div className="cols even">
          <section className="card">
            <header className="card-h"><h2>This year</h2><span className="muted small">{fmt(feeFor(db.settings, now))} {cur} a month</span></header>
            <div className="year-grid">
              {months.map((m) => {
                const st = monthStatus(db, s, m, now);
                const p = paid(db, s, m);
                return (
                  <button key={m} type="button" className={"month " + st} onClick={() => tapMonth(m)} disabled={st === "na" || st === "nofee" || st === "waived"}>
                    <b>{MON[Number(m.slice(5)) - 1]}</b>
                    <small>{st === "paid" ? "Paid" : st === "partial" ? `${fmt(p)} paid` : st === "due" ? "Unpaid" : st === "exempt" ? "Exempt" : st === "waived" ? "Waived" : st === "nofee" ? "No fee" : st === "future" ? "Not due" : "–"}</small>
                  </button>
                );
              })}
            </div>
            {earlier > 0 && <div className="card-f"><span className="owe">Also owes <Money n={earlier} /> from before {monthLabel(months[0])}.</span></div>}
            {admin && active && !s.waived && (
              <div className="card-f"><ExemptPicker s={s} months={months.filter((m) => { const st = monthStatus(db, s, m, now); return st === "due" || st === "future"; })} /></div>
            )}
          </section>

          <div className="stack">
            <section className="card">
              <header className="card-h"><h2>Details</h2></header>
              <dl className="kv">
                <dt>Class</dt><dd>{className(db, s.classId)}<small>{db.classes.find((c) => c.id === s.classId)?.teacher}</small></dd>
                <dt>Branch</dt><dd>{branchName(db, s.branchId)}</dd>
                <dt>Guardian</dt><dd>{s.guardian}</dd>
                <dt>Phone</dt><dd className="num">{s.phone}{s.phone2 && <small>{s.phone2}</small>}</dd>
                <dt>Born</dt><dd>{s.dob ? `${dateLabel(s.dob)}${age !== null ? ` (${age})` : ""}` : "Not recorded"} · {s.gender === "F" ? "Girl" : "Boy"}</dd>
                <dt>Started</dt><dd>{dateLabel(s.start)}</dd>
                {s.waived && <><dt>Waiver</dt><dd>{s.waiveReason || "No reason given"}</dd></>}
              </dl>
            </section>
            <section className="card">
              <header className="card-h"><h2>Latest</h2><a className="btn sm" href={"#/reports/statement/" + s.id}>Statement</a></header>
              <dl className="kv">
                <dt>Qur'an</dt><dd>{lastProgress ? <>{lastProgress.kind}: {lastProgress.from}{lastProgress.to && lastProgress.to !== lastProgress.from ? " to " + lastProgress.to : ""}<small>{lastProgress.grade} · {dateLabel(lastProgress.date)}</small></> : <span className="muted">No progress notes yet</span>}</dd>
                <dt>Absences</dt><dd>{absences} in {monthLabel(now, true)}</dd>
                <dt>Last paid</dt><dd>{receipts.find((r) => !r.void) ? dateLabel(receipts.find((r) => !r.void)!.date) : <span className="muted">Never</span>}</dd>
              </dl>
            </section>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <section className="card list">
          {receipts.map((r) => (
            <a key={r.id} className={"row link" + (r.void ? " voided" : "")} href={"#/receipts/" + r.id}>
              <span className="row-icon"><Icon name="receipt" size={18} /></span>
              <span className="grow"><b>{r.lines.map((l) => monthLabel(l.month, true)).join(", ")}</b><small>{r.no} · {dateLabel(r.date)} · {r.method} · {userName(db, r.by)}</small></span>
              <span className="row-end">{r.void ? <Pill tone="bad">Void</Pill> : <b><Money n={receiptTotal(r)} /></b>}</span>
            </a>
          ))}
          {!receipts.length && <Empty title="No payments yet" icon="receipt">The first receipt will appear here.</Empty>}
        </section>
      )}

      {tab === "notes" && (
        <>
          <div className="note-add">
            {(Object.keys(NOTE_META) as NoteType[]).map((t) => (
              <button key={t} type="button" className="btn" onClick={() => setNoteOpen(t)}><Icon name={NOTE_META[t].icon} size={17} />{t === "payment" ? "Payment note" : t === "progress" ? "Qur'an progress" : "Behaviour or absence"}</button>
            ))}
          </div>
          <section className="card timeline">
            {notes.map((n) => <NoteItem key={n.id} n={n} />)}
            {!notes.length && <Empty title="No notes yet" icon="note">Add a payment note, Qur'an progress or an absence.</Empty>}
          </section>
        </>
      )}

      <NoteDialog studentId={s.id} type={noteOpen} onClose={() => setNoteOpen(null)} />

      <Dialog open={menu === "menu"} onClose={() => setMenu(null)} title={s.name}>
        <div className="menu">
          <a className="menu-item" href={`#/students/${s.id}/edit`}><Icon name="edit" />Edit details</a>
          <a className="menu-item" href={"#/reports/statement/" + s.id}><Icon name="receipt" />Open statement</a>
          <button type="button" className="menu-item" onClick={() => { setMenu(null); setTab("notes"); setNoteOpen("payment"); }}><Icon name="note" />Add a note</button>
          {admin && db.branches.filter((b) => b.active).length > 1 && <button type="button" className="menu-item" onClick={() => setMenu("transfer")}><Icon name="swap" />Transfer to another branch or class</button>}
          {admin && (active
            ? <button type="button" className="menu-item danger" onClick={() => setMenu("left")}><Icon name="logout" />Mark as left the school</button>
            : <button type="button" className="menu-item" onClick={() => { markLeft(s.id, null); setMenu(null); toast(s.name + " is active again"); }}><Icon name="check" />Re-activate student</button>)}
          {!admin && <p className="muted small pad">Transfers, waivers and marking a student as left need an admin.</p>}
        </div>
      </Dialog>
      <LeftDialog s={s} open={menu === "left"} onClose={() => setMenu(null)} />
      <TransferDialog s={s} open={menu === "transfer"} onClose={() => setMenu(null)} />
    </Page>
  );
}

function ExemptPicker({ s, months }: { s: Student; months: string[] }) {
  const [m, setM] = useState("");
  if (!months.length) return <span className="muted small">Tap an exempt month to charge it again.</span>;
  return (
    <div className="inline-form">
      <select aria-label="Month to exempt" value={m} onChange={(e) => setM(e.target.value)}>
        <option value="">Exempt a month…</option>
        {months.map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}
      </select>
      <button type="button" className="btn sm" disabled={!m} onClick={() => { toggleExempt(s.id, m); toast(monthLabel(m) + " marked exempt"); setM(""); }}>Mark exempt</button>
    </div>
  );
}

function NoteItem({ n }: { n: Note }) {
  const { db } = useScope();
  const late = n.type === "payment" && n.promiseDate && n.promiseDate < today();
  return (
    <article className={"note t-" + n.type}>
      <span className="note-icon"><Icon name={NOTE_META[n.type].icon} size={17} /></span>
      <div className="grow">
        <header>
          <b>{n.type === "payment" ? "Payment note" : n.kind || NOTE_META[n.type].label}</b>
          <span className="faint">{dateLabel(n.date)} · {userName(db, n.by)}</span>
        </header>
        {n.type === "progress" && (n.from || n.grade) && <p className="note-meta">{n.from}{n.to && n.to !== n.from ? " to " + n.to : ""}{n.grade && <Pill tone="teal">{n.grade}</Pill>}</p>}
        {n.text && <p>{n.text}</p>}
        {n.promiseDate && <p className="note-meta"><Pill tone={late ? "bad" : "warn"}>Promised for {dateLabel(n.promiseDate)}</Pill></p>}
      </div>
      {canDeleteNote(n) && <button type="button" className="iconbtn subtle" aria-label="Delete note" onClick={() => { deleteNote(n.id); toast("Note deleted"); }}><Icon name="trash" size={17} /></button>}
    </article>
  );
}

export function NoteDialog({ studentId, type, onClose }: { studentId: string; type: NoteType | null; onClose: () => void }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(today());
  const [promise, setPromise] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [grade, setGrade] = useState("Good");
  if (!type) return null;
  const k = kind || (type === "progress" ? "New memorisation" : type === "conduct" ? "Absent" : "");
  const close = () => { setText(""); setPromise(""); setKind(""); setFrom(""); setTo(""); setDate(today()); onClose(); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (type === "payment" && !text.trim()) return;
    if (type === "progress" && !from.trim()) return;
    addNote({
      studentId, type, date, text: text.trim(),
      ...(type === "payment" && promise ? { promiseDate: promise } : {}),
      ...(type === "progress" ? { kind: k, from: from.trim(), to: to.trim() || from.trim(), grade } : {}),
      ...(type === "conduct" ? { kind: k } : {}),
    });
    toast("Note added");
    close();
  };
  return (
    <Dialog open onClose={close} title={type === "payment" ? "Payment note" : type === "progress" ? "Qur'an progress" : "Behaviour or attendance"}
      footer={<><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" form="note-form" className="btn primary grow">Add note</button></>}>
      <form id="note-form" className="form one" onSubmit={submit}>
        {type === "progress" && (
          <>
            <Field label="Type"><Segmented value={k} onChange={setKind} options={[{ value: "New memorisation", label: "New memorisation" }, { value: "Revision", label: "Revision" }]} /></Field>
            <div className="form two">
              <Field label="From"><input required autoFocus value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Al-Mulk 1 or Juz 30" /></Field>
              <Field label="To"><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Al-Mulk 15" /></Field>
            </div>
            <Field label="Grade">
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>{["Excellent", "Very good", "Good", "Needs revision"].map((g) => <option key={g}>{g}</option>)}</select>
            </Field>
          </>
        )}
        {type === "conduct" && (
          <Field label="Type"><Segmented value={k} onChange={setKind} options={[{ value: "Absent", label: "Absent" }, { value: "Late", label: "Late" }, { value: "Conduct", label: "Conduct" }]} /></Field>
        )}
        <Field label={type === "payment" ? "What was said or done" : "Remark"}>
          <textarea rows={3} autoFocus={type !== "progress"} required={type === "payment"} value={text} onChange={(e) => setText(e.target.value)} placeholder={type === "payment" ? "For example: father will pay on Thursday" : "Optional"} />
        </Field>
        <div className="form two dates">
          <Field label="Date"><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
          {type === "payment" && <Field label="Promised to pay by (optional)"><input type="date" value={promise} onChange={(e) => setPromise(e.target.value)} /></Field>}
        </div>
      </form>
    </Dialog>
  );
}

function LeftDialog({ s, open, onClose }: { s: Student; open: boolean; onClose: () => void }) {
  const { db, now } = useScope();
  const [date, setDate] = useState(today());
  const bal = balance(db, s, now);
  return (
    <Dialog open={open} onClose={onClose} title="Mark as left"
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn danger grow" onClick={() => { markLeft(s.id, date); onClose(); toast(s.name + " marked as left"); }}>Mark as left</button></>}>
      <div className="form one">
        <p>{s.name} stays in the records with all payments and notes. No fees are charged after the month they leave.</p>
        {bal > 0 && <p className="inline-warn"><Icon name="alert" size={18} /><span>They still owe {fmt(bal)} {db.settings.school.currency}. It stays on the owed list.</span></p>}
        <Field label="Last day"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

function TransferDialog({ s, open, onClose }: { s: Student; open: boolean; onClose: () => void }) {
  const { db } = useScope();
  const [branchId, setBranch] = useState(s.branchId);
  const classes = db.classes.filter((c) => c.branchId === branchId && !c.archived);
  const [classId, setClass] = useState(s.classId);
  const cid = classes.some((c) => c.id === classId) ? classId : classes[0]?.id || "";
  return (
    <Dialog open={open} onClose={onClose} title="Transfer student"
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary grow" disabled={!cid || (branchId === s.branchId && cid === s.classId)} onClick={() => { transferStudent(s.id, branchId, cid); onClose(); toast("Student transferred"); }}>Transfer</button></>}>
      <div className="form one">
        <p className="muted">Past receipts stay with the branch that received them.</p>
        <Field label="Branch"><select value={branchId} onChange={(e) => setBranch(e.target.value)}>{db.branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Class"><select value={cid} onChange={(e) => setClass(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}{!classes.length && <option value="">No classes in this branch</option>}</select></Field>
      </div>
    </Dialog>
  );
}

// Used by the owed list to show the latest payment note next to a student.
export function latestPaymentNote(notes: Note[], studentId: string) {
  return notes.filter((n) => n.studentId === studentId && n.type === "payment").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}
