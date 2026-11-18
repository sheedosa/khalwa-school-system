import { FormEvent, useState } from "react";
import { feeFor, gbp, monthLabel, ymOf } from "../logic";
import { useScope } from "../scope";
import { defaultBranch, findDuplicate, saveStudent, StudentInput, today } from "../store";
import { Field, go, goBack, Icon, Page, toast } from "../ui";

export function StudentForm({ id }: { id?: string }) {
  const { db, admin, user, cur } = useScope();
  const existing = id ? db.students.find((s) => s.id === id) : undefined;
  const firstBranch = existing?.branchId || defaultBranch();
  const [v, setV] = useState<StudentInput>(() => ({
    name: existing?.name || "", nameAr: existing?.nameAr || "", gender: existing?.gender || "M", dob: existing?.dob || "",
    guardian: existing?.guardian || "", phone: existing?.phone || "", phone2: existing?.phone2 || "",
    branchId: firstBranch, classId: existing?.classId || db.classes.find((c) => c.branchId === firstBranch && !c.archived)?.id || "",
    start: existing?.start || today(), waived: existing?.waived || false, waiveReason: existing?.waiveReason || "",
  }));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<StudentInput>) => setV((x) => ({ ...x, ...patch }));
  const branches = db.branches.filter((b) => b.active && (admin || b.id === user.branchId));
  const classes = db.classes.filter((c) => c.branchId === v.branchId && (!c.archived || c.id === existing?.classId));
  const dup = findDuplicate(db, v.name, v.phone, id);
  const fee = feeFor(db.settings, ymOf(v.start || today()));
  const backTo = id ? "/students/" + id : "/students";

  if (id && !existing) return <Page title="Student not found" back="/students"><p className="muted">This student no longer exists.</p></Page>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !v.name.trim() || !v.guardian.trim() || !v.phone.trim() || !v.start) return;
    const clean = { ...v, name: v.name.trim(), nameAr: v.nameAr.trim(), guardian: v.guardian.trim(), phone: v.phone.trim(), phone2: v.phone2.trim(), waiveReason: v.waived ? v.waiveReason.trim() : "" };
    setBusy(true);
    let sid: string;
    try {
      sid = await saveStudent(clean, id);
    } catch (err) {
      setBusy(false);
      return toast((err as Error).message);
    }
    if (id) {
      toast("Changes saved");
      goBack(backTo);
    } else {
      toast(`${clean.name} registered`);
      go(clean.waived ? "/students/" + sid : "/collect/" + sid, true);
    }
  };

  return (
    <Page
      title={id ? "Edit student" : "Register student"}
      back={backTo}
      footer={
        <>
          <button type="button" className="btn" onClick={() => goBack(backTo)}>Cancel</button>
          <button type="submit" form="student-form" className="btn primary grow" disabled={busy}><Icon name="check" size={18} />{id ? "Save changes" : v.waived ? "Register student" : "Register and take payment"}</button>
        </>
      }
    >
      <form id="student-form" className="form-page" onSubmit={submit}>
        <section className="card form-card">
          <h2>Student</h2>
          <div className="form">
            <Field label="Full name"><input required autoFocus={!id} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="As written in English" autoComplete="off" /></Field>
            <Field label="Name in Arabic"><input dir="rtl" lang="ar" value={v.nameAr} onChange={(e) => set({ nameAr: e.target.value })} placeholder="الاسم" autoComplete="off" /></Field>
            <Field label="Date of birth"><input type="date" value={v.dob} max={today()} onChange={(e) => set({ dob: e.target.value })} /></Field>
            <Field label="Gender">
              <div className="choice">
                <label><input type="radio" name="gender" checked={v.gender === "M"} onChange={() => set({ gender: "M" })} /><span>Boy</span></label>
                <label><input type="radio" name="gender" checked={v.gender === "F"} onChange={() => set({ gender: "F" })} /><span>Girl</span></label>
              </div>
            </Field>
          </div>
          {dup && (
            <p className="inline-warn"><Icon name="alert" size={18} /><span>A student named {dup.name} with this phone is already registered as {dup.no}. <a href={"#/students/" + dup.id}>Open their profile</a></span></p>
          )}
        </section>

        <section className="card form-card">
          <h2>Guardian</h2>
          <div className="form">
            <Field label="Guardian name"><input required value={v.guardian} onChange={(e) => set({ guardian: e.target.value })} autoComplete="off" /></Field>
            <Field label="Phone" hint="Used when following up on payments"><input required type="tel" inputMode="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="07xxx xxxxxx" autoComplete="off" /></Field>
            <Field label="Second phone (optional)"><input type="tel" inputMode="tel" value={v.phone2} onChange={(e) => set({ phone2: e.target.value })} autoComplete="off" /></Field>
          </div>
        </section>

        <section className="card form-card">
          <h2>Enrollment</h2>
          <div className="form">
            <Field label="Branch">
              <select value={v.branchId} disabled={branches.length < 2 || !!id} onChange={(e) => set({ branchId: e.target.value, classId: db.classes.find((c) => c.branchId === e.target.value && !c.archived)?.id || "" })}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Class">
              <select required value={v.classId} onChange={(e) => set({ classId: e.target.value })}>
                {!classes.length && <option value="">No classes in this branch yet</option>}
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.days} {c.time}</option>)}
              </select>
            </Field>
            <Field label="Start date" hint={`Charged from ${monthLabel(ymOf(v.start || today()))} onward`}><input required type="date" value={v.start} onChange={(e) => set({ start: e.target.value })} /></Field>
            <Field label="Monthly fee" hint={admin ? undefined : "Only an admin can waive the fee"}>
              <div className="choice">
                <label><input type="radio" name="fee" checked={!v.waived} onChange={() => set({ waived: false })} /><span>{gbp(fee)}</span></label>
                <label className={admin ? "" : "disabled"}><input type="radio" name="fee" disabled={!admin} checked={v.waived} onChange={() => set({ waived: true })} /><span>Waived</span></label>
              </div>
            </Field>
            {v.waived && <Field label="Reason for waiver" wide><input required value={v.waiveReason} onChange={(e) => set({ waiveReason: e.target.value })} placeholder="For example: orphan sponsorship" /></Field>}
          </div>
        </section>
      </form>
    </Page>
  );
}
