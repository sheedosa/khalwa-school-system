import { FormEvent, useState } from "react";
import { ClassRoom, isActive, monthLabel, owed } from "../logic";
import { useScope } from "../scope";
import { archiveClass, branchName, defaultBranch, saveClass } from "../store";
import { Dialog, Empty, Field, go, Icon, Page, Pill, toast, useIsMobile } from "../ui";
import { studentFilter } from "./Students";

export function Classes() {
  const { db, classes, students, admin, multi, now } = useScope();
  const mobile = useIsMobile();
  const [edit, setEdit] = useState<ClassRoom | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = classes.filter((c) => showArchived || !c.archived).sort((a, b) => a.branchId.localeCompare(b.branchId) || a.name.localeCompare(b.name));
  const archivedCount = classes.filter((c) => c.archived).length;
  return (
    <Page title="Classes" back={mobile ? "/more" : undefined} parent="More"
      actions={admin ? <button type="button" className="btn primary" aria-label="Add class" title="Add class" onClick={() => setEdit("new")}><Icon name="plus" size={18} /><span className="btn-label">Add class</span></button> : undefined}>
      {!list.length && <div className="card"><Empty title="No classes yet" icon="classes">{admin ? "Add the first class to start registering students." : "An admin can add classes."}</Empty></div>}
      <div className="class-grid">
        {list.map((c) => {
          const ss = students.filter((s) => s.classId === c.id && isActive(s));
          const paidN = ss.filter((s) => owed(db, s, now) === 0).length;
          return (
            <section className="card class-card" key={c.id}>
              <header>
                <div className="grow"><h2>{c.name}</h2><span className="muted">{c.teacher || "No teacher set"}</span></div>
                {c.archived ? <Pill tone="off">Archived</Pill> : multi && <Pill tone="teal">{branchName(db, c.branchId)}</Pill>}
              </header>
              <dl className="kv tight">
                <dt>Days</dt><dd>{c.days || "–"}</dd>
                <dt>Time</dt><dd>{c.time || "–"}</dd>
                <dt>Students</dt><dd>{ss.length} active</dd>
              </dl>
              <div>
                <div className="between small muted"><span>Paid for {monthLabel(now, true)}</span><span className="num">{paidN} of {ss.length}</span></div>
                <div className="progress"><i style={{ width: (ss.length ? (paidN / ss.length) * 100 : 0) + "%" }} /></div>
              </div>
              <div className="card-actions">
                <button type="button" className="btn sm" onClick={() => { Object.assign(studentFilter, { q: "", classId: c.id, status: "active", pay: "all" }); go("/students"); }}>View students</button>
                {admin && <button type="button" className="btn sm ghost" onClick={() => setEdit(c)}>Edit</button>}
              </div>
            </section>
          );
        })}
      </div>
      {archivedCount > 0 && <button type="button" className="btn ghost start" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Hide" : "Show"} {archivedCount} archived class{archivedCount === 1 ? "" : "es"}</button>}
      {edit && <ClassDialog c={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function ClassDialog({ c, onClose }: { c: ClassRoom | null; onClose: () => void }) {
  const { db, students } = useScope();
  const [v, setV] = useState({ name: c?.name || "", teacher: c?.teacher || "", days: c?.days || "", time: c?.time || "", branchId: c?.branchId || defaultBranch() });
  const inUse = c ? students.some((s) => s.classId === c.id && isActive(s)) : false;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return;
    saveClass({ ...v, name: v.name.trim(), teacher: v.teacher.trim() }, c?.id);
    toast(c ? "Class saved" : "Class added");
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={c ? "Edit class" : "Add class"}
      footer={
        <>
          {c && <button type="button" className="btn danger-ghost" disabled={!c.archived && inUse} title={inUse ? "Move its students to another class first" : undefined} onClick={() => { archiveClass(c.id, !c.archived); toast(c.archived ? "Class restored" : "Class archived"); onClose(); }}>{c.archived ? "Restore" : "Archive"}</button>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="class-form" className="btn primary grow">{c ? "Save" : "Add class"}</button>
        </>
      }>
      <form id="class-form" className="form one" onSubmit={submit}>
        <Field label="Class name"><input required autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="For example: Hifz – Morning" /></Field>
        <Field label="Teacher"><input value={v.teacher} onChange={(e) => setV({ ...v, teacher: e.target.value })} /></Field>
        <div className="form two">
          <Field label="Days"><input value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })} placeholder="Sat, Mon, Wed" /></Field>
          <Field label="Time"><input value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} placeholder="16:30–18:30" /></Field>
        </div>
        <Field label="Branch" hint={c ? "To move a class, transfer its students instead" : undefined}>
          <select value={v.branchId} disabled={!!c} onChange={(e) => setV({ ...v, branchId: e.target.value })}>{db.branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </Field>
        {c && !c.archived && inUse && <p className="muted small">This class has active students, so it cannot be archived yet.</p>}
      </form>
    </Dialog>
  );
}
