import { useState } from "react";
import { balance, charge, DB, fmt, hijriLabel, isActive, MON, monthLabel, monthStatus, MonthStatus, owed, paid, Student, yearMonths } from "../logic";
import { useScope } from "../scope";
import { branchName, className } from "../store";
import { Avatar, Empty, go, Icon, Money, Page, StatusPill, useIsMobile } from "../ui";

const memo = { classId: "", owing: false, month: "" };

function openCell(db: DB, s: Student, m: string, st: MonthStatus) {
  if (st === "due" || st === "partial" || st === "future") go("/collect/" + s.id);
  else if (st === "paid") {
    const r = db.receipts.find((r) => !r.void && r.studentId === s.id && r.lines.some((l) => l.month === m));
    if (r) go("/receipts/" + r.id);
  } else go("/students/" + s.id);
}

export function MonthlySheet() {
  const { db, students, classes, now, multi, cur } = useScope();
  const mobile = useIsMobile();
  const months = yearMonths(db);
  const [classId, setClassId] = useState(memo.classId);
  const [owingOnly, setOwingOnly] = useState(memo.owing);
  const [month, setMonth] = useState(memo.month && months.includes(memo.month) ? memo.month : months.includes(now) ? now : months[months.length - 1]);
  memo.classId = classId; memo.owing = owingOnly; memo.month = month;

  const order = (s: Student) => (multi ? branchName(db, s.branchId) : "") + className(db, s.classId);
  let list = students.filter(isActive).filter((s) => !classId || s.classId === classId);
  if (owingOnly) list = list.filter((s) => (mobile ? owed(db, s, month) > 0 : balance(db, s, now) > 0));
  list = [...list].sort((a, b) => order(a).localeCompare(order(b)) || a.name.localeCompare(b.name));

  const filters = (
    <div className="chips">
      <button type="button" className={"chip" + (!owingOnly ? " on" : "")} onClick={() => setOwingOnly(false)}>Everyone</button>
      <button type="button" className={"chip" + (owingOnly ? " on" : "")} onClick={() => setOwingOnly(true)}>Owing only</button>
      <select className="chip-select" aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
        <option value="">All classes</option>
        {classes.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}{multi ? " · " + branchName(db, c.branchId) : ""}</option>)}
      </select>
    </div>
  );

  if (mobile) {
    const i = months.indexOf(month);
    const exp = list.reduce((a, s) => a + charge(db, s, month), 0);
    const got = list.reduce((a, s) => a + Math.min(paid(db, s, month), charge(db, s, month)), 0);
    return (
      <Page
        title="Monthly sheet"
        toolbar={
          <>
            <div className="month-nav">
              <button type="button" className="iconbtn" aria-label="Previous month" disabled={i <= 0} onClick={() => setMonth(months[i - 1])}><Icon name="back" /></button>
              <div><b>{monthLabel(month)}</b><small>{hijriLabel(month)}</small></div>
              <button type="button" className="iconbtn" aria-label="Next month" disabled={i >= months.length - 1} onClick={() => setMonth(months[i + 1])}><Icon name="next" /></button>
            </div>
            {filters}
          </>
        }
      >
        <div className="sheet-sum">
          <div><span>Collected</span><b className="gold"><Money n={got} /></b></div>
          <div><span>Outstanding</span><b className={exp - got > 0 ? "owe" : ""}><Money n={Math.max(0, exp - got)} /></b></div>
          <div className="progress"><i style={{ width: (exp ? (got / exp) * 100 : 0) + "%" }} /></div>
        </div>
        <div className="card list">
          {list.map((s) => {
            const st = monthStatus(db, s, month, now);
            const p = paid(db, s, month);
            return (
              <button type="button" key={s.id} className="row link" onClick={() => openCell(db, s, month, st)}>
                <Avatar name={s.name} />
                <span className="grow"><b>{s.name}</b><small>{className(db, s.classId)}{multi ? " · " + branchName(db, s.branchId) : ""}</small></span>
                <span className="row-end"><StatusPill status={st} />{st === "partial" && <small>{fmt(p)} of {fmt(charge(db, s, month))}</small>}</span>
              </button>
            );
          })}
          {!list.length && <Empty title={owingOnly ? "No one owes for this month" : "No students"} icon="check" />}
        </div>
      </Page>
    );
  }

  let lastGroup = "";
  return (
    <Page title="Monthly sheet" wide toolbar={<><div className="sheet-legend"><span><i className="paid" />Paid</span><span><i className="partial" />Part paid</span><span><i className="due" />Unpaid</span><span><i className="exempt" />Exempt or waived</span><span><i className="future" />Not due yet</span></div>{filters}</>}>
      {!list.length ? <div className="card"><Empty title={owingOnly ? "No one owes" : "No students"} icon="check" /></div> : (
        <div className="card sheet">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                {months.map((m) => <th key={m} className={m === now ? "now" : ""}>{MON[Number(m.slice(5)) - 1]}<small>{m.slice(2, 4)}</small></th>)}
                <th className="r">Owing</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const g = order(s);
                const head = g !== lastGroup;
                lastGroup = g;
                const bal = balance(db, s, now);
                return [
                  head && !classId && (
                    <tr key={"g" + s.id} className="group"><td colSpan={months.length + 2}>{className(db, s.classId)}{multi && <span> · {branchName(db, s.branchId)}</span>}</td></tr>
                  ),
                  <tr key={s.id}>
                    <td><a href={"#/students/" + s.id}><b>{s.name}</b></a><small>{s.no}</small></td>
                    {months.map((m) => {
                      const st = monthStatus(db, s, m, now);
                      const label = st === "paid" ? "✓" : st === "partial" ? fmt(paid(db, s, m)) : st === "due" ? "Due" : st === "exempt" || st === "waived" || st === "nofee" ? "–" : "";
                      return (
                        <td key={m} className={"c" + (m === now ? " now" : "")}>
                          <button type="button" className={"cell " + st} disabled={st === "na" || st === "nofee" || st === "waived" || st === "exempt"} title={`${monthLabel(m)}: ${st === "na" ? "not enrolled" : st}`} onClick={() => openCell(db, s, m, st)}>{label}</button>
                        </td>
                      );
                    })}
                    <td className={"r " + (bal ? "owe" : "faint")}>{fmt(bal)}</td>
                  </tr>,
                ];
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Collected ({cur})</th>
                {months.map((m) => <th key={m} className="c num">{m <= now ? fmt(list.reduce((a, s) => a + paid(db, s, m), 0)) : ""}</th>)}
                <th className="r owe">{fmt(list.reduce((a, s) => a + balance(db, s, now), 0))}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Page>
  );
}
