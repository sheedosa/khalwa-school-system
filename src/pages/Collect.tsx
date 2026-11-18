import { useMemo, useState } from "react";
import { allocate, balance, chargeMonths, dateLabel, gbp, hijriLabel, isActive, Method, monthLabel, monthStatus, owed, owingMonths, paid } from "../logic";
import { useScope } from "../scope";
import { branchName, className, recordPayment, today } from "../store";
import { Avatar, Dialog, Empty, Field, go, Icon, Money, Page, searchStudents, SearchInput, Segmented, StatusPill, toast, useIsMobile } from "../ui";
import { NoteDialog } from "./StudentProfile";

export function Collect({ studentId }: { studentId?: string }) {
  return studentId ? <Pay key={studentId} id={studentId} /> : <Pick />;
}

function Pick() {
  const { db, students, now, multi } = useScope();
  const mobile = useIsMobile();
  const [q, setQ] = useState("");
  const pool = students.filter(isActive);
  const hits = q.trim()
    ? searchStudents(db, q).filter((s) => pool.includes(s)).slice(0, 12)
    : pool.filter((s) => balance(db, s, now) > 0).sort((a, b) => owingMonths(db, b, now).length - owingMonths(db, a, now).length || a.name.localeCompare(b.name));
  return (
    <Page title="Collect payment" toolbar={<SearchInput value={q} onChange={setQ} placeholder="Student name, number or phone" autoFocus={!mobile} />}>
      <p className="count">{q.trim() ? `${hits.length} match${hits.length === 1 ? "" : "es"}` : `${hits.length} student${hits.length === 1 ? "" : "s"} owing now`}</p>
      <div className="card list">
        {hits.map((s) => {
          const n = owingMonths(db, s, now).length;
          const bal = balance(db, s, now);
          return (
            <a key={s.id} className="row link" href={"#/collect/" + s.id}>
              <Avatar name={s.name} />
              <span className="grow"><b>{s.name}</b><small>{s.no} · {className(db, s.classId)}{multi ? " · " + branchName(db, s.branchId) : ""}</small></span>
              <span className="row-end">{bal > 0 ? <><b className="owe"><Money n={bal} /></b><small>{n} month{n === 1 ? "" : "s"}</small></> : <StatusPill status={monthStatus(db, s, now, now)} />}</span>
            </a>
          );
        })}
        {!hits.length && (q.trim() ? <Empty title="No active student matches">Check the spelling, or register them first.</Empty> : <Empty title="No one owes right now" icon="check">Search for a student to take a payment in advance.</Empty>)}
      </div>
    </Page>
  );
}

function Pay({ id }: { id: string }) {
  const { db, now, cur, branchIds, user } = useScope();
  const s = db.students.find((x) => x.id === id);
  const options = useMemo(() => {
    if (!s) return [];
    const all = chargeMonths(db);
    const due = all.filter((m) => m <= now && owed(db, s, m) > 0);
    const ahead = all.filter((m) => m > now && owed(db, s, m) > 0).slice(0, 3);
    return [...due, ...ahead];
  }, [db, s, now]);
  const [picked, setPicked] = useState<string[]>(() => (options[0] && options[0] <= now ? [options[0]] : []));
  const [custom, setCustom] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("Cash");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  if (!s || !branchIds.includes(s.branchId)) return <Page title="Collect payment" back="/collect"><div className="card"><Empty title="Student not found" /></div></Page>;

  const sum = picked.reduce((a, m) => a + owed(db, s, m), 0);
  const amount = custom === null ? sum : Number(custom) || 0;
  const over = amount > sum;
  const { lines } = allocate(db, s, picked, amount);
  const valid = picked.length > 0 && amount > 0 && !over && !!date;
  const toggle = (m: string) => {
    setCustom(null);
    setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort()));
  };
  const submit = () => {
    const rid = recordPayment({ studentId: s.id, months: picked, amount, date, method, note: note.trim() });
    if (rid) {
      toast("Payment recorded");
      go("/receipts/" + rid, true);
    }
  };

  return (
    <Page
      title="Collect payment"
      back="/collect"
      footer={options.length && !s.waived ? (
        <button type="button" className="btn gold grow" disabled={!valid} onClick={() => setConfirm(true)}>
          Review payment{valid ? <> · {gbp(amount)}</> : null}
        </button>
      ) : undefined}
    >
      <section className="card pay-who">
        <Avatar name={s.name} size="lg" />
        <div className="grow"><h2>{s.name}</h2><span className="muted">{s.no} · {className(db, s.classId)} · {branchName(db, s.branchId)}</span></div>
        <a className="btn sm" href={"#/students/" + s.id}>Profile</a>
      </section>

      {s.waived ? (
        <div className="card"><Empty title="Fee waived" icon="shield">{s.waiveReason || "This student is not charged."}</Empty></div>
      ) : !options.length ? (
        <div className="card"><Empty title="Nothing to pay" icon="check">{s.name} is paid up to the end of the year.</Empty></div>
      ) : (
        <div className="cols pay">
          <section className="card">
            <header className="card-h"><h2>Months</h2><span className="muted small">{picked.length} selected</span></header>
            <div className="list">
              {options.map((m) => {
                const on = picked.includes(m);
                const part = paid(db, s, m);
                return (
                  <label key={m} className={"row check" + (on ? " on" : "")}>
                    <input type="checkbox" checked={on} onChange={() => toggle(m)} />
                    <span className="tick"><Icon name="check" size={15} /></span>
                    <span className="grow"><b>{monthLabel(m)}</b><small>{hijriLabel(m)}{part > 0 ? ` · ${gbp(part)} already paid` : ""}{m > now ? " · in advance" : ""}</small></span>
                    <Money n={owed(db, s, m)} />
                  </label>
                );
              })}
            </div>
          </section>

          <section className="card form-card">
            <h2>Payment</h2>
            <div className="form one">
              <Field label="Method"><Segmented value={method} onChange={setMethod} options={[{ value: "Cash", label: "Cash" }, { value: "Bank transfer", label: "Bank transfer" }]} /></Field>
              <Field label={`Amount received (£)`} hint={over ? <span className="err">More than the selected months. Tick another month for the extra.</span> : amount > 0 && amount < sum ? "Part payment. Applied to the earliest month first." : undefined}>
                <input className={"amount" + (over ? " invalid" : "")} type="number" inputMode="decimal" min="0" step="any" value={custom === null ? (sum || "") : custom} onChange={(e) => setCustom(e.target.value)} />
              </Field>
              <div className="form two dates">
                <Field label="Date"><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
                <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown on the receipt" /></Field>
              </div>
              <button type="button" className="btn ghost start" onClick={() => setNoteOpen(true)}><Icon name="note" size={17} />Not paying today? Add a payment note</button>
            </div>
          </section>
        </div>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Check before recording"
        footer={<><button type="button" className="btn" onClick={() => setConfirm(false)}>Go back</button><button type="button" className="btn gold grow" onClick={submit}><Icon name="check" size={18} />Record and issue receipt</button></>}>
        <dl className="kv confirm">
          <dt>Student</dt><dd><b>{s.name}</b><small>{s.no}</small></dd>
          <dt>For</dt><dd>{lines.map((l) => <span className="line" key={l.month}>{monthLabel(l.month)}<Money n={l.amount} /></span>)}</dd>
          <dt>Method</dt><dd>{method}</dd>
          <dt>Date</dt><dd>{dateLabel(date)}</dd>
          <dt>Received by</dt><dd>{user.name}</dd>
        </dl>
        <div className="confirm-total"><span>Total</span><b><Money n={amount} /></b></div>
        <p className="muted small">A receipt number is issued when you confirm. Receipts cannot be deleted, only voided by an admin.</p>
      </Dialog>
      <NoteDialog studentId={s.id} type={noteOpen ? "payment" : null} onClose={() => setNoteOpen(false)} />
    </Page>
  );
}
