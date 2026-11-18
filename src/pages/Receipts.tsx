import { useState } from "react";
import { dateLabel, gbp, hijriLabel, monthLabel, receiptTotal, Receipt, ymOf } from "../logic";
import { useScope } from "../scope";
import { branchName, className, userName, voidReceipt } from "../store";
import { Dialog, Empty, Field, go, Icon, Money, Page, Pill, SearchInput, toast, useIsMobile } from "../ui";

const memo = { q: "", month: "", method: "" };

export function Receipts() {
  const { db, receipts, multi, cur } = useScope();
  const mobile = useIsMobile();
  const [f, setF] = useState({ ...memo });
  const set = (p: Partial<typeof memo>) => { Object.assign(memo, p); setF({ ...memo }); };
  const name = (r: Receipt) => db.students.find((s) => s.id === r.studentId)?.name || "";
  const months = [...new Set(receipts.map((r) => ymOf(r.date)))].sort().reverse();
  const q = f.q.trim().toLowerCase();
  const list = receipts
    .filter((r) => (!f.month || ymOf(r.date) === f.month) && (!f.method || r.method === f.method) && (!q || r.no.toLowerCase().includes(q) || name(r).toLowerCase().includes(q)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.no < b.no ? 1 : -1));
  const total = list.filter((r) => !r.void).reduce((a, r) => a + receiptTotal(r), 0);
  const shown = list.slice(0, 150);

  return (
    <Page title="Receipts" wide back={mobile ? "/more" : undefined}
      toolbar={
        <>
          <SearchInput value={f.q} onChange={(q) => set({ q })} placeholder="Receipt number or student" />
          <div className="chips">
            <select className="chip-select" aria-label="Month received" value={f.month} onChange={(e) => set({ month: e.target.value })}>
              <option value="">All dates</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <select className="chip-select" aria-label="Method" value={f.method} onChange={(e) => set({ method: e.target.value })}>
              <option value="">Cash and transfer</option><option>Cash</option><option>Bank transfer</option>
            </select>
          </div>
        </>
      }>
      <p className="count">{list.length} receipt{list.length === 1 ? "" : "s"} · {gbp(total)}</p>
      {!list.length ? <div className="card"><Empty title="No receipts match" icon="receipt" /></div> : mobile ? (
        <div className="card list">
          {shown.map((r) => (
            <a key={r.id} className={"row link" + (r.void ? " voided" : "")} href={"#/receipts/" + r.id}>
              <span className="grow"><b>{name(r)}</b><small>{r.no} · {dateLabel(r.date)} · {r.method}</small></span>
              <span className="row-end">{r.void ? <Pill tone="bad">Void</Pill> : <b><Money n={receiptTotal(r)} /></b>}<small>{r.lines.map((l) => monthLabel(l.month, true).slice(0, 3)).join(", ")}</small></span>
            </a>
          ))}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="clickable">
            <thead><tr><th>Receipt</th><th>Date</th><th>Student</th><th>For</th>{multi && <th>Branch</th>}<th>Method</th><th>Received by</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} tabIndex={0} className={r.void ? "voided" : ""} onClick={() => go("/receipts/" + r.id)} onKeyDown={(e) => e.key === "Enter" && go("/receipts/" + r.id)}>
                  <td className="num"><b>{r.no}</b></td>
                  <td className="num">{dateLabel(r.date)}</td>
                  <td>{name(r)}</td>
                  <td>{r.lines.map((l) => monthLabel(l.month, true)).join(", ")}</td>
                  {multi && <td>{branchName(db, r.branchId)}</td>}
                  <td>{r.method}</td>
                  <td>{userName(db, r.by)}</td>
                  <td className="r">{r.void ? <Pill tone="bad">Void</Pill> : <Money n={receiptTotal(r)} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > shown.length && <p className="count">Showing the latest {shown.length}. Use the filters to find older receipts.</p>}
    </Page>
  );
}

export function ReceiptPage({ id }: { id: string }) {
  const { db, admin, cur, branchIds } = useScope();
  const r = db.receipts.find((x) => x.id === id);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  if (!r || !branchIds.includes(r.branchId)) return <Page title="Receipt" back="/receipts"><div className="card"><Empty title="Receipt not found" icon="receipt" /></div></Page>;
  const s = db.students.find((x) => x.id === r.studentId);
  const school = db.settings.school;
  const total = receiptTotal(r);
  const text = `${school.name}\nReceipt ${r.no}\n${dateLabel(r.date)}\nStudent: ${s?.name} (${s?.no})\n${r.lines.map((l) => `${monthLabel(l.month)}: ${gbp(l.amount)}`).join("\n")}\nTotal: ${gbp(total)} (${r.method})\nReceived by ${userName(db, r.by)}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Receipt " + r.no, text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Receipt text copied");
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <Page title={"Receipt " + r.no} back="/receipts"
      actions={admin && !r.void ? <button type="button" className="btn desk-only danger-ghost" onClick={() => setVoiding(true)}>Void receipt</button> : undefined}
      footer={
        <>
          <button type="button" className="btn" onClick={share}><Icon name="share" size={18} />Share</button>
          <button type="button" className="btn primary grow" onClick={() => window.print()}><Icon name="print" size={18} />Print receipt</button>
        </>
      }>
      {r.void && <div className="banner bad static"><Icon name="alert" /><span className="grow"><b>This receipt was voided</b><small>{userName(db, r.void.by)} on {dateLabel(r.void.at)}: {r.void.reason}</small></span></div>}
      <div className={"paper print-area" + (r.void ? " is-void" : "") + (db.settings.receipt.paper === "Thermal" ? " thermal" : "")}>
        <div className="paper-top">
          <img src="./logo.webp" alt="" />
          <span className="paper-ar" lang="ar">{school.nameAr}</span>
          <span className="paper-name">{school.name.toUpperCase()}</span>
          <span className="faint small">{branchName(db, r.branchId)}{school.phone ? " · " + school.phone : ""}</span>
        </div>
        <dl className="paper-meta">
          <dt>Receipt no.</dt><dd className="num">{r.no}</dd>
          <dt>Date</dt><dd>{dateLabel(r.date)}</dd>
          <dt>Student</dt><dd>{s?.name}{s?.nameAr && <small lang="ar">{s.nameAr}</small>}</dd>
          <dt>Student no.</dt><dd className="num">{s?.no}</dd>
          <dt>Class</dt><dd>{s ? className(db, s.classId) : ""}</dd>
          <dt>Guardian</dt><dd>{s?.guardian}</dd>
        </dl>
        <div className="paper-lines">
          {r.lines.map((l) => (
            <div key={l.month}><span>Monthly fee, {monthLabel(l.month)}<small>{hijriLabel(l.month)}</small></span><b>{gbp(l.amount)}</b></div>
          ))}
        </div>
        <div className="paper-total"><span>Total received<small>{r.method}</small></span><b>{gbp(total)}</b></div>
        {r.note && <p className="paper-note">{r.note}</p>}
        <div className="paper-sign"><span>Received by<br /><b>{userName(db, r.by)}</b></span><span>Signature</span></div>
        {db.settings.receipt.footer && <p className="paper-foot" lang="ar">{db.settings.receipt.footer}</p>}
        {r.void && <div className="void-stamp">VOID</div>}
      </div>
      <div className="after-receipt no-print">
        {s && <a className="btn" href={"#/students/" + s.id}>Open {s.name.split(" ")[0]}'s profile</a>}
        <a className="btn" href="#/collect"><Icon name="collect" size={17} />Collect another</a>
        {admin && !r.void && <button type="button" className="btn danger-ghost mob-only" onClick={() => setVoiding(true)}>Void receipt</button>}
      </div>
      <Dialog open={voiding} onClose={() => setVoiding(false)} title={"Void " + r.no}
        footer={<><button type="button" className="btn" onClick={() => setVoiding(false)}>Keep receipt</button><button type="button" className="btn danger grow" disabled={reason.trim().length < 3} onClick={() => { voidReceipt(r.id, reason.trim()); setVoiding(false); toast("Receipt voided"); }}>Void receipt</button></>}>
        <div className="form one">
          <p>The {gbp(total)} goes back to unpaid for {s?.name}. The receipt stays in the records, marked void, and its number is not reused.</p>
          <Field label="Reason"><input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: recorded against the wrong student" /></Field>
        </div>
      </Dialog>
    </Page>
  );
}
