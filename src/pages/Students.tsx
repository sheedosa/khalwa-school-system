import { useState } from "react";
import { balance, isActive, monthLabel, monthStatus, owingMonths, Student } from "../logic";
import { useScope } from "../scope";
import { branchName, className } from "../store";
import { Avatar, Empty, go, Icon, Money, Page, Pill, searchStudents, SearchInput, StatusPill, useIsMobile } from "../ui";

type Pay = "all" | "owing" | "arrears" | "paid" | "waived";
// Kept between visits so coming back from a profile shows the same list.
export const studentFilter = { q: "", classId: "", status: "active" as "active" | "left" | "all", pay: "all" as Pay };

const PAY: { value: Pay; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owing", label: "Owing" },
  { value: "arrears", label: "2+ months" },
  { value: "paid", label: "Paid up" },
  { value: "waived", label: "Waived" },
];

export function Students() {
  const { db, students, classes, now, multi } = useScope();
  const mobile = useIsMobile();
  const [f, setF] = useState({ ...studentFilter });
  const set = (patch: Partial<typeof studentFilter>) => {
    Object.assign(studentFilter, patch);
    setF({ ...studentFilter });
  };

  let list: Student[] = f.q ? searchStudents(db, f.q).filter((s) => students.includes(s)) : students;
  if (f.status !== "all") list = list.filter((s) => (f.status === "active") === isActive(s));
  if (f.classId) list = list.filter((s) => s.classId === f.classId);
  const rows = list
    .map((s) => ({ s, bal: balance(db, s, now), months: owingMonths(db, s, now).length, st: monthStatus(db, s, now, now) }))
    .filter((x) => (f.pay === "owing" ? x.bal > 0 : f.pay === "arrears" ? x.months >= 2 : f.pay === "paid" ? x.bal === 0 && !x.s.waived : f.pay === "waived" ? x.s.waived : true))
    .sort((a, b) => a.s.name.localeCompare(b.s.name));

  const toolbar = (
    <>
      <SearchInput value={f.q} onChange={(q) => set({ q })} placeholder="Name, number, phone or guardian" />
      <div className="chips">
        {PAY.map((p) => (
          <button key={p.value} type="button" className={"chip" + (f.pay === p.value ? " on" : "")} onClick={() => set({ pay: p.value })}>{p.label}</button>
        ))}
        <select className="chip-select" aria-label="Class" value={f.classId} onChange={(e) => set({ classId: e.target.value })}>
          <option value="">All classes</option>
          {classes.filter((c) => !c.archived).map((c) => (
            <option key={c.id} value={c.id}>{c.name}{multi ? " · " + branchName(db, c.branchId) : ""}</option>
          ))}
        </select>
        <select className="chip-select" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value as typeof f.status })}>
          <option value="active">Active</option>
          <option value="left">Left</option>
          <option value="all">Active and left</option>
        </select>
      </div>
    </>
  );

  return (
    <Page
      title="Students"
      wide
      toolbar={toolbar}
      actions={<a className="btn primary" href="#/students/new" aria-label="Register student" title="Register student"><Icon name="plus" size={18} /><span className="btn-label">Register student</span></a>}
    >
      <p className="count">{rows.length} student{rows.length === 1 ? "" : "s"}</p>
      {!rows.length ? (
        <div className="card"><Empty title="No students match">Try a different search or clear the filters.</Empty></div>
      ) : mobile ? (
        <div className="card list">
          {rows.map(({ s, bal, months, st }) => (
            <a className="row link" key={s.id} href={"#/students/" + s.id}>
              <Avatar name={s.name} />
              <span className="grow"><b>{s.name}</b><small>{s.no} · {className(db, s.classId)}{multi ? " · " + branchName(db, s.branchId) : ""}</small></span>
              <span className="row-end">
                {!isActive(s) ? <Pill tone="off">Left</Pill> : bal > 0 ? <><b className="owe"><Money n={bal} /></b><small>{months} month{months === 1 ? "" : "s"}</small></> : <StatusPill status={st} />}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="clickable">
            <thead>
              <tr><th>No.</th><th>Student</th><th>Class</th>{multi && <th>Branch</th>}<th>Guardian</th><th>Phone</th><th>{monthLabel(now, true)}</th><th className="r">Owing</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(({ s, bal, months, st }) => (
                <tr key={s.id} tabIndex={0} onClick={() => go("/students/" + s.id)} onKeyDown={(e) => e.key === "Enter" && go("/students/" + s.id)}>
                  <td className="faint num">{s.no}</td>
                  <td><div className="cell-name"><Avatar name={s.name} /><span><b>{s.name}</b><small lang="ar">{s.nameAr}</small></span></div></td>
                  <td>{className(db, s.classId)}</td>
                  {multi && <td>{branchName(db, s.branchId)}</td>}
                  <td>{s.guardian}</td>
                  <td className="num">{s.phone}</td>
                  <td>{isActive(s) ? <StatusPill status={st} /> : <Pill tone="off">Left</Pill>}</td>
                  <td className="r">{bal > 0 ? <span className="owe"><Money n={bal} /> <small className="faint">· {months} mo</small></span> : <span className="faint">0</span>}</td>
                  <td className="r"><Icon name="next" size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
