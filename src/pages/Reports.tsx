import { ReactNode, useState } from "react";
import { balance, charge, chargeMonths, dateLabel, gbp, hijriLabel, isActive, MON, monthLabel, monthStatus, owed, owingMonths, paid, receiptTotal, yearMonths, ymOf } from "../logic";
import { useScope } from "../scope";
import { branchName, className, userName } from "../store";
import { Avatar, downloadCsv, Empty, go, Icon, Money, Page, Pill, searchStudents, SearchInput, useIsMobile } from "../ui";
import { latestPaymentNote } from "./StudentProfile";

const LIST = [
  { id: "collection", icon: "coins", title: "Monthly collection", text: "Expected, collected and outstanding by branch and class. Cash against transfer, and totals per staff member." },
  { id: "owed", icon: "alert", title: "Owed list", text: "Every student who owes: which months, how much, and the guardian's phone." },
  { id: "statement", icon: "receipt", title: "Student statement", text: "One student's year on a page: charges, receipts and balance. Made for parents." },
  { id: "enrollment", icon: "students", title: "Enrollment", text: "Students per branch and class, boys and girls, new registrations and leavers." },
];

export function Reports({ name, arg }: { name?: string; arg?: string }) {
  const mobile = useIsMobile();
  if (name === "collection") return <Collection />;
  if (name === "owed") return <Owed />;
  if (name === "statement") return <Statement id={arg} />;
  if (name === "enrollment") return <Enrollment />;
  return (
    <Page title="Reports" back={mobile ? "/more" : undefined}>
      <div className="report-grid">
        {LIST.map((r) => (
          <a key={r.id} className="card report-card" href={"#/reports/" + r.id}>
            <span className="row-icon"><Icon name={r.icon} /></span>
            <span className="grow"><b>{r.title}</b><small>{r.text}</small></span>
            <Icon name="next" size={18} />
          </a>
        ))}
      </div>
      <p className="muted small">Every report follows the branch selected at the top, prints on A4 and exports to Excel.</p>
    </Page>
  );
}

function ReportFrame({ title, sub, filters, onExport, children }: { title: string; sub: string; filters?: ReactNode; onExport: () => void; children: ReactNode }) {
  const { db, branchIds } = useScope();
  return (
    <Page title={title} back="/reports" wide toolbar={filters}
      actions={
        <>
          <button type="button" className="btn" onClick={onExport}><Icon name="download" size={17} /><span className="btn-label">Export</span></button>
          <button type="button" className="btn primary" onClick={() => window.print()}><Icon name="print" size={17} /><span className="btn-label">Print</span></button>
        </>
      }>
      <div className="print-area report">
        <header className="print-head">
          <img src="./logo.webp" alt="" />
          <div><b>{db.settings.school.name}</b><span>{title} · {sub}</span><span>{branchIds.map((id) => branchName(db, id)).join(" and ")} · printed {dateLabel(new Date().toISOString())}</span></div>
        </header>
        {children}
      </div>
    </Page>
  );
}

/* ---------- Monthly collection ---------- */
function Collection() {
  const { db, students, receipts, classes, branchIds, now, cur, multi } = useScope();
  const months = yearMonths(db).filter((m) => m <= now);
  const [m, setM] = useState(months.includes(now) ? now : months[months.length - 1] || now);
  const rows = classes
    .map((c) => {
      const ss = students.filter((s) => s.classId === c.id && charge(db, s, m) > 0);
      const exp = ss.reduce((a, s) => a + charge(db, s, m), 0);
      const got = ss.reduce((a, s) => a + Math.min(paid(db, s, m), charge(db, s, m)), 0);
      return { c, n: ss.length, paidN: ss.filter((s) => owed(db, s, m) === 0).length, exp, got };
    })
    .filter((r) => r.n > 0 || !r.c.archived)
    .sort((a, b) => branchIds.indexOf(a.c.branchId) - branchIds.indexOf(b.c.branchId) || a.c.name.localeCompare(b.c.name));
  const tExp = rows.reduce((a, r) => a + r.exp, 0);
  const tGot = rows.reduce((a, r) => a + r.got, 0);
  const inMonth = receipts.filter((r) => !r.void && ymOf(r.date) === m);
  const cash = inMonth.filter((r) => r.method === "Cash").reduce((a, r) => a + receiptTotal(r), 0);
  const bank = inMonth.filter((r) => r.method !== "Cash").reduce((a, r) => a + receiptTotal(r), 0);
  const staff = [...new Set(inMonth.map((r) => r.by))].map((id) => {
    const rs = inMonth.filter((r) => r.by === id);
    return { id, n: rs.length, cash: rs.filter((r) => r.method === "Cash").reduce((a, r) => a + receiptTotal(r), 0), bank: rs.filter((r) => r.method !== "Cash").reduce((a, r) => a + receiptTotal(r), 0) };
  });
  const voids = receipts.filter((r) => r.void && ymOf(r.date) === m).length;
  const exportCsv = () =>
    downloadCsv(`collection-${m}.csv`, [
      ["Branch", "Class", "Teacher", "Students charged", "Paid in full", "Expected", "Collected", "Outstanding"],
      ...rows.map((r) => [branchName(db, r.c.branchId), r.c.name, r.c.teacher, r.n, r.paidN, r.exp, r.got, r.exp - r.got]),
      ["Total", "", "", rows.reduce((a, r) => a + r.n, 0), rows.reduce((a, r) => a + r.paidN, 0), tExp, tGot, tExp - tGot],
      [],
      ["Received during " + monthLabel(m), "Receipts", "Cash", "Bank transfer", "Total"],
      ...staff.map((x) => [userName(db, x.id), x.n, x.cash, x.bank, x.cash + x.bank]),
    ]);
  return (
    <ReportFrame title="Monthly collection" sub={monthLabel(m)} onExport={exportCsv}
      filters={<div className="chips"><select className="chip-select" aria-label="Month" value={m} onChange={(e) => setM(e.target.value)}>{[...months].reverse().map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select><span className="muted small">{hijriLabel(m)}</span></div>}>
      <div className="stats three">
        <div className="stat"><span className="stat-l">Fees for {monthLabel(m, true)}</span><span className="stat-v gold">{gbp(tGot)}</span><span className="stat-s">of {gbp(tExp)} expected ({tExp ? Math.round((tGot / tExp) * 100) : 0}%)</span></div>
        <div className="stat"><span className="stat-l">Outstanding for {monthLabel(m, true)}</span><span className={"stat-v" + (tExp - tGot > 0 ? " owe" : "")}>{gbp(tExp - tGot)}</span><span className="stat-s">{rows.reduce((a, r) => a + r.n - r.paidN, 0)} students not paid in full</span></div>
        <div className="stat"><span className="stat-l">Money received in {monthLabel(m, true)}</span><span className="stat-v">{gbp(cash + bank)}</span><span className="stat-s">Cash {gbp(cash)} · Transfer {gbp(bank)}</span></div>
      </div>
      <section className="card">
        <header className="card-h"><h2>By class</h2></header>
        <div className="table-wrap">
          <table>
            <thead><tr>{multi && <th>Branch</th>}<th>Class</th><th className="r">Students</th><th className="r">Paid</th><th className="r">Expected</th><th className="r">Collected</th><th className="r">Outstanding</th><th className="bar-col">Progress</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c.id}>
                  {multi && <td>{branchName(db, r.c.branchId)}</td>}
                  <td><b>{r.c.name}</b><small>{r.c.teacher}</small></td>
                  <td className="r">{r.n}</td><td className="r">{r.paidN}</td>
                  <td className="r">{gbp(r.exp)}</td><td className="r">{gbp(r.got)}</td>
                  <td className={"r" + (r.exp - r.got > 0 ? " owe" : " faint")}>{gbp(r.exp - r.got)}</td>
                  <td className="bar-col"><div className="progress"><i style={{ width: (r.exp ? (r.got / r.exp) * 100 : 0) + "%" }} /></div></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>{multi && <th></th>}<th>Total</th><th className="r">{rows.reduce((a, r) => a + r.n, 0)}</th><th className="r">{rows.reduce((a, r) => a + r.paidN, 0)}</th><th className="r">{gbp(tExp)}</th><th className="r">{gbp(tGot)}</th><th className="r">{gbp(tExp - tGot)}</th><th className="bar-col"></th></tr></tfoot>
          </table>
        </div>
      </section>
      <section className="card">
        <header className="card-h"><h2>Money received, by staff member</h2><span className="muted small">By the date on the receipt{voids ? ` · ${voids} voided receipt${voids === 1 ? "" : "s"} left out` : ""}</span></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Received by</th><th className="r">Receipts</th><th className="r">Cash</th><th className="r">Bank transfer</th><th className="r">Total</th></tr></thead>
            <tbody>
              {staff.map((x) => <tr key={x.id}><td><b>{userName(db, x.id)}</b></td><td className="r">{x.n}</td><td className="r">{gbp(x.cash)}</td><td className="r">{gbp(x.bank)}</td><td className="r"><b>{gbp(x.cash + x.bank)}</b></td></tr>)}
              {!staff.length && <tr><td colSpan={5}><Empty title="No money received in this month" icon="receipt" /></td></tr>}
            </tbody>
            {staff.length > 0 && <tfoot><tr><th>Total</th><th className="r">{inMonth.length}</th><th className="r">{gbp(cash)}</th><th className="r">{gbp(bank)}</th><th className="r">{gbp(cash + bank)}</th></tr></tfoot>}
          </table>
        </div>
      </section>
    </ReportFrame>
  );
}

/* ---------- Owed list ---------- */
function Owed() {
  const { db, students, classes, now, cur, multi, today } = useScope();
  const mobile = useIsMobile();
  const [classId, setClassId] = useState("");
  const [min, setMin] = useState(1);
  const rows = students
    .filter((s) => !classId || s.classId === classId)
    .map((s) => ({ s, months: owingMonths(db, s, now), total: balance(db, s, now), note: latestPaymentNote(db.notes, s.id) }))
    .filter((x) => x.total > 0 && x.months.length >= min)
    .sort((a, b) => b.months.length - a.months.length || b.total - a.total || a.s.name.localeCompare(b.s.name));
  const total = rows.reduce((a, r) => a + r.total, 0);
  const short = (ms: string[]) => ms.map((m) => MON[Number(m.slice(5)) - 1]).join(", ");
  const exportCsv = () =>
    downloadCsv(`owed-list-${today}.csv`, [
      ["Student no.", "Student", "Arabic name", "Branch", "Class", "Guardian", "Phone", "Second phone", "Months owing", "Months", `Total (£)`, "Status", "Latest payment note", "Promised by"],
      ...rows.map(({ s, months, total, note }) => [s.no, s.name, s.nameAr, branchName(db, s.branchId), className(db, s.classId), s.guardian, s.phone, s.phone2, months.length, months.map((m) => monthLabel(m, true)).join("; "), total, isActive(s) ? "Active" : "Left", note?.text || "", note?.promiseDate || ""]),
    ]);
  return (
    <ReportFrame title="Owed list" sub={"as of " + dateLabel(today)} onExport={exportCsv}
      filters={
        <div className="chips">
          {[1, 2, 3].map((n) => <button key={n} type="button" className={"chip" + (min === n ? " on" : "")} onClick={() => setMin(n)}>{n === 1 ? "Any amount" : n + "+ months"}</button>)}
          <select className="chip-select" aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{multi ? " · " + branchName(db, c.branchId) : ""}</option>)}
          </select>
        </div>
      }>
      <div className="stats three">
        <div className="stat"><span className="stat-l">Total owed</span><span className="stat-v owe">{gbp(total)}</span><span className="stat-s">up to {monthLabel(now)}</span></div>
        <div className="stat"><span className="stat-l">Students owing</span><span className="stat-v">{rows.length}</span><span className="stat-s">{rows.filter((r) => r.months.length >= 2).length} owe two months or more</span></div>
        <div className="stat"><span className="stat-l">With a promise to pay</span><span className="stat-v">{rows.filter((r) => r.note?.promiseDate).length}</span><span className="stat-s">{rows.filter((r) => r.note?.promiseDate && r.note.promiseDate < today).length} past the promised date</span></div>
      </div>
      {!rows.length ? <div className="card"><Empty title="No one owes" icon="check">Every student in this view is paid up.</Empty></div> : mobile ? (
        <div className="card list">
          {rows.map(({ s, months, total, note }) => (
            <div className="row tall" key={s.id}>
              <a className="row-main" href={"#/students/" + s.id}>
                <Avatar name={s.name} />
                <span className="grow"><b>{s.name}</b><small>{s.guardian} · {s.phone}</small><small>{short(months)}{!isActive(s) ? " · left" : ""}</small>{note && <small className="quote">{note.text}{note.promiseDate ? ` (by ${dateLabel(note.promiseDate).replace(/ \d{4}$/, "")})` : ""}</small>}</span>
              </a>
              <span className="row-end"><b className="owe"><Money n={total} /></b><button type="button" className="btn sm" onClick={() => go("/collect/" + s.id)}>Collect</button></span>
            </div>
          ))}
        </div>
      ) : (
        <section className="card table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Class</th>{multi && <th>Branch</th>}<th>Guardian</th><th>Phone</th><th>Months owing</th><th className="r">Total</th><th>Latest payment note</th><th className="no-print"></th></tr></thead>
            <tbody>
              {rows.map(({ s, months, total, note }) => (
                <tr key={s.id}>
                  <td><a href={"#/students/" + s.id}><b>{s.name}</b></a><small>{s.no}{!isActive(s) ? " · left" : ""}</small></td>
                  <td>{className(db, s.classId)}</td>
                  {multi && <td>{branchName(db, s.branchId)}</td>}
                  <td>{s.guardian}</td>
                  <td className="num nowrap">{s.phone}</td>
                  <td><Pill tone={months.length >= 2 ? "bad" : "warn"}>{months.length}</Pill> <span className="small">{short(months)}</span></td>
                  <td className="r owe">{gbp(total)}</td>
                  <td className="note-cell">{note ? <>{note.text}{note.promiseDate && <small className={note.promiseDate < today ? "owe" : ""}>Promised for {dateLabel(note.promiseDate)}</small>}</> : <span className="faint">–</span>}</td>
                  <td className="r no-print"><button type="button" className="btn sm" onClick={() => go("/collect/" + s.id)}>Collect</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={multi ? 6 : 5}>Total</th><th className="r owe">{gbp(total)}</th><th></th><th className="no-print"></th></tr></tfoot>
          </table>
        </section>
      )}
    </ReportFrame>
  );
}

/* ---------- Student statement ---------- */
function Statement({ id }: { id?: string }) {
  const { db, students, now, cur } = useScope();
  const [q, setQ] = useState("");
  const s = students.find((x) => x.id === id);
  if (!s) {
    const hits = (q.trim() ? searchStudents(db, q).filter((x) => students.includes(x)) : [...students].sort((a, b) => a.name.localeCompare(b.name))).slice(0, 30);
    return (
      <Page title="Student statement" back="/reports" toolbar={<SearchInput value={q} onChange={setQ} placeholder="Choose a student" />}>
        <div className="card list">
          {hits.map((x) => (
            <a key={x.id} className="row link" href={"#/reports/statement/" + x.id}>
              <Avatar name={x.name} /><span className="grow"><b>{x.name}</b><small>{x.no} · {className(db, x.classId)}</small></span><Icon name="next" size={18} />
            </a>
          ))}
          {!hits.length && <Empty title="No student matches" />}
        </div>
      </Page>
    );
  }
  const months = chargeMonths(db).filter((m) => m <= now || paid(db, s, m) > 0).filter((m) => monthStatus(db, s, m, now) !== "na");
  const recs = db.receipts.filter((r) => r.studentId === s.id && !r.void);
  const tCharge = months.reduce((a, m) => a + charge(db, s, m), 0);
  const tPaid = months.reduce((a, m) => a + paid(db, s, m), 0);
  const progress = db.notes.filter((n) => n.studentId === s.id && n.type === "progress").sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const label: Record<string, string> = { waived: "Waived", exempt: "Exempt", nofee: "No fee", paid: "Paid", partial: "Part paid", due: "Unpaid", future: "Not due" };
  const exportCsv = () =>
    downloadCsv(`statement-${s.no}.csv`, [
      ["Student", s.name, s.no], ["Class", className(db, s.classId), branchName(db, s.branchId)], [],
      ["Month", "Charged", "Paid", "Owed", "Status", "Receipts"],
      ...months.map((m) => [monthLabel(m), charge(db, s, m), paid(db, s, m), owed(db, s, m), label[monthStatus(db, s, m, now)] || "", recs.filter((r) => r.lines.some((l) => l.month === m)).map((r) => `${r.no} (${dateLabel(r.date)})`).join("; ")]),
      ["Total", tCharge, tPaid, tCharge - tPaid],
    ]);
  return (
    <ReportFrame title="Student statement" sub={s.name} onExport={exportCsv} filters={<div className="chips"><a className="chip" href="#/reports/statement">Choose another student</a><a className="chip" href={"#/students/" + s.id}>Open profile</a></div>}>
      <section className="card statement">
        <div className="statement-head">
          <div><h2>{s.name}</h2>{s.nameAr && <span lang="ar" className="ar">{s.nameAr}</span>}<span className="muted">{s.no} · {className(db, s.classId)} · {branchName(db, s.branchId)}</span><span className="muted">Guardian: {s.guardian} · {s.phone}</span></div>
          <div className={"balance " + (tCharge - tPaid > 0 ? "bad" : "ok")}><span>Balance owed</span><b>{s.waived ? "Waived" : <>{gbp(Math.max(0, tCharge - tPaid))}</>}</b></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th className="r">Charged</th><th className="r">Paid</th><th className="r">Owed</th><th>Status</th><th>Receipts</th></tr></thead>
            <tbody>
              {months.map((m) => {
                const st = monthStatus(db, s, m, now);
                return (
                  <tr key={m}>
                    <td><b>{monthLabel(m)}</b></td>
                    <td className="r">{gbp(charge(db, s, m))}</td><td className="r">{gbp(paid(db, s, m))}</td>
                    <td className={"r" + (owed(db, s, m) > 0 && m <= now ? " owe" : " faint")}>{gbp(m <= now ? owed(db, s, m) : 0)}</td>
                    <td>{label[st]}</td>
                    <td className="small">{recs.filter((r) => r.lines.some((l) => l.month === m)).map((r) => `${r.no}, ${dateLabel(r.date)}`).join(" · ") || <span className="faint">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><th>Total</th><th className="r">{gbp(tCharge)}</th><th className="r">{gbp(tPaid)}</th><th className="r owe">{gbp(balance(db, s, now))}</th><th></th><th></th></tr></tfoot>
          </table>
        </div>
        <dl className="kv">
          <dt>Started</dt><dd>{dateLabel(s.start)}{s.leftDate ? ` · left ${dateLabel(s.leftDate)}` : ""}</dd>
          <dt>Qur'an progress</dt><dd>{progress ? `${progress.kind}: ${progress.from}${progress.to && progress.to !== progress.from ? " to " + progress.to : ""} · ${progress.grade} · ${dateLabel(progress.date)}` : "No progress notes yet"}</dd>
        </dl>
      </section>
    </ReportFrame>
  );
}

/* ---------- Enrollment ---------- */
function Enrollment() {
  const { db, students, classes, branchIds, now, multi, today } = useScope();
  const active = students.filter(isActive);
  const rows = classes
    .map((c) => {
      const ss = active.filter((s) => s.classId === c.id);
      return { c, n: ss.length, boys: ss.filter((s) => s.gender === "M").length, girls: ss.filter((s) => s.gender === "F").length, waived: ss.filter((s) => s.waived).length };
    })
    .filter((r) => r.n > 0 || !r.c.archived)
    .sort((a, b) => branchIds.indexOf(a.c.branchId) - branchIds.indexOf(b.c.branchId) || a.c.name.localeCompare(b.c.name));
  const months = yearMonths(db).filter((m) => m <= now);
  const moves = months.map((m) => ({
    m,
    joined: students.filter((s) => ymOf(s.start) === m).length,
    left: students.filter((s) => s.leftDate && ymOf(s.leftDate) === m).length,
    end: students.filter((s) => ymOf(s.start) <= m && (!s.leftDate || ymOf(s.leftDate) > m)).length,
  }));
  const sum = (k: "n" | "boys" | "girls" | "waived") => rows.reduce((a, r) => a + r[k], 0);
  const exportCsv = () =>
    downloadCsv(`enrollment-${today}.csv`, [
      ["Branch", "Class", "Teacher", "Active", "Boys", "Girls", "Waived"],
      ...rows.map((r) => [branchName(db, r.c.branchId), r.c.name, r.c.teacher, r.n, r.boys, r.girls, r.waived]),
      ["Total", "", "", sum("n"), sum("boys"), sum("girls"), sum("waived")], [],
      ["Month", "Joined", "Left", "Enrolled at month end"],
      ...moves.map((x) => [monthLabel(x.m), x.joined, x.left, x.end]),
    ]);
  return (
    <ReportFrame title="Enrollment" sub={"as of " + dateLabel(today)} onExport={exportCsv}>
      <div className="stats three">
        <div className="stat"><span className="stat-l">Active students</span><span className="stat-v">{active.length}</span><span className="stat-s">{sum("boys")} boys · {sum("girls")} girls</span></div>
        <div className="stat"><span className="stat-l">Joined this year</span><span className="stat-v">{moves.reduce((a, x) => a + x.joined, 0)}</span><span className="stat-s">{moves[moves.length - 1]?.joined || 0} in {monthLabel(now, true)}</span></div>
        <div className="stat"><span className="stat-l">Left this year</span><span className="stat-v">{moves.reduce((a, x) => a + x.left, 0)}</span><span className="stat-s">{sum("waived")} active students have the fee waived</span></div>
      </div>
      <section className="card">
        <header className="card-h"><h2>By class</h2></header>
        <div className="table-wrap">
          <table>
            <thead><tr>{multi && <th>Branch</th>}<th>Class</th><th>Teacher</th><th className="r">Active</th><th className="r">Boys</th><th className="r">Girls</th><th className="r">Waived</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.c.id}>{multi && <td>{branchName(db, r.c.branchId)}</td>}<td><b>{r.c.name}</b></td><td>{r.c.teacher}</td><td className="r"><b>{r.n}</b></td><td className="r">{r.boys}</td><td className="r">{r.girls}</td><td className="r">{r.waived}</td></tr>)}</tbody>
            <tfoot><tr>{multi && <th></th>}<th>Total</th><th></th><th className="r">{sum("n")}</th><th className="r">{sum("boys")}</th><th className="r">{sum("girls")}</th><th className="r">{sum("waived")}</th></tr></tfoot>
          </table>
        </div>
      </section>
      <section className="card">
        <header className="card-h"><h2>Joined and left, by month</h2></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th className="r">Joined</th><th className="r">Left</th><th className="r">Enrolled at month end</th></tr></thead>
            <tbody>{moves.map((x) => <tr key={x.m}><td><b>{monthLabel(x.m)}</b></td><td className="r">{x.joined || <span className="faint">0</span>}</td><td className="r">{x.left || <span className="faint">0</span>}</td><td className="r">{x.end}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </ReportFrame>
  );
}
