import { balance, charge, dateLabel, gbp, hijriLabel, isActive, monthLabel, MON, owed, owingMonths, paid, receiptTotal, yearMonths } from "../logic";
import { useScope } from "../scope";
import { isCloud, branchName, className, userName } from "../store";
import { Avatar, Empty, go, Icon, Money, Page, Pill } from "../ui";

export function Dashboard() {
  const { db, classes, students, receipts, now, today, cur, admin, multi, branchIds } = useScope();
  const active = students.filter(isActive);
  const expected = active.reduce((a, s) => a + charge(db, s, now), 0);
  const collected = active.reduce((a, s) => a + Math.min(paid(db, s, now), charge(db, s, now)), 0);
  const pct = expected ? Math.round((collected / expected) * 100) : 0;
  const unpaid = active.filter((s) => owed(db, s, now) > 0);
  const owing = active
    .map((s) => ({ s, months: owingMonths(db, s, now), total: balance(db, s, now) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.months.length - a.months.length || b.total - a.total);
  const live = receipts.filter((r) => !r.void);
  const todays = live.filter((r) => r.date === today);
  const newThisMonth = active.filter((s) => s.start.slice(0, 7) === now).length;
  const months = yearMonths(db).filter((m) => m <= now).slice(-6);
  const bars = months.map((m) => ({
    m,
    exp: students.reduce((a, s) => a + charge(db, s, m), 0),
    got: students.reduce((a, s) => a + Math.min(paid(db, s, m), charge(db, s, m)), 0),
  }));
  const max = Math.max(1, ...bars.map((b) => b.exp));
  const promises = db.notes
    .filter((n) => n.type === "payment" && n.promiseDate)
    .map((n) => ({ n, s: students.find((s) => s.id === n.studentId) }))
    .filter((x) => x.s && isActive(x.s) && balance(db, x.s, now) > 0)
    .sort((a, b) => (a.n.promiseDate! < b.n.promiseDate! ? -1 : 1))
    .slice(0, 4);
  const backupDue = admin && (!db.settings.lastBackup || Date.now() - new Date(db.settings.lastBackup).getTime() > 30 * 864e5);

  return (
    <Page title="Dashboard" actions={<a className="btn primary desk-only" href="#/collect"><Icon name="collect" size={18} />Collect payment</a>}>
      <section className="hero">
        <div className="hero-main">
          <span className="hero-l"><span>Collected for {monthLabel(now)}</span><span>{hijriLabel(now)}</span></span>
          <span className="hero-v">{gbp(collected)}</span>
          <div className="progress"><i style={{ width: pct + "%" }} /></div>
          <span className="hero-s">{pct}% of the {gbp(expected)} expected this month</span>
        </div>
        <div className="hero-side">
          <a className="hero-stat" href="#/reports/owed">
            <b>{unpaid.length}</b>
            <span>unpaid</span>
            <small>{gbp(unpaid.reduce((a, s) => a + owed(db, s, now), 0))} outstanding</small>
          </a>
          <a className="hero-stat" href="#/receipts">
            <b>{gbp(todays.reduce((a, r) => a + receiptTotal(r), 0))}</b>
            <span>taken today</span>
            <small>{todays.length} receipt{todays.length === 1 ? "" : "s"}</small>
          </a>
          <a className="hero-stat" href="#/students">
            <b>{active.length}</b>
            <span>students</span>
            <small>{newThisMonth} new this month</small>
          </a>
        </div>
      </section>

      {admin && !classes.length && (
        <a className="banner" href="#/classes">
          <Icon name="classes" />
          <span className="grow"><b>Start by adding a class</b><small>Students are registered into a class, so add at least one first.</small></span>
          <Icon name="next" size={18} />
        </a>
      )}
      {classes.length > 0 && !students.length && (
        <a className="banner" href="#/students/new">
          <Icon name="plus" />
          <span className="grow"><b>Register the first student</b><small>Their first payment can be taken straight after.</small></span>
          <Icon name="next" size={18} />
        </a>
      )}
      {isCloud && backupDue && students.length > 0 && (
        <a className="banner" href="#/settings/data">
          <Icon name="database" />
          <span className="grow"><b>Download a backup</b><small>{db.settings.lastBackup ? "The last one is more than a month old." : "No backup has been saved yet."}</small></span>
          <Icon name="next" size={18} />
        </a>
      )}

      <div className="cols">
        <section className="card">
          <header className="card-h"><h2>Who owes</h2><a className="btn sm" href="#/reports/owed">Owed list</a></header>
          <div className="list">
            {owing.slice(0, 7).map(({ s, months, total }) => (
              <div className="row" key={s.id}>
                <a className="row-main" href={"#/students/" + s.id}>
                  <Avatar name={s.name} />
                  <span className="grow"><b>{s.name}</b><small>{className(db, s.classId)}{multi ? " · " + branchName(db, s.branchId) : ""}</small></span>
                </a>
                <span className="row-end">
                  <b className="owe"><Money n={total} /></b>
                  <small>{months.length === 1 ? monthLabel(months[0], true) : months.length + " months"}</small>
                </span>
                <button type="button" className="btn sm" onClick={() => go("/collect/" + s.id)}>Collect</button>
              </div>
            ))}
            {!owing.length && <Empty title="Everyone is paid up" icon="check">Nothing is outstanding.</Empty>}
            {owing.length > 7 && <a className="row link more" href="#/reports/owed">See all {owing.length} students</a>}
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <header className="card-h"><h2>Collection by month</h2><span className="legend"><i className="k got" />Paid<i className="k exp" />Expected</span></header>
            <div className="bars">
              {bars.map((b) => (
                <div className="bar" key={b.m} title={`${monthLabel(b.m)}: ${gbp(b.got)} of ${gbp(b.exp)}`}>
                  <div className="bar-track"><i className="exp" style={{ height: (b.exp / max) * 100 + "%" }} /><i className="got" style={{ height: (b.got / max) * 100 + "%" }} /></div>
                  <b>{MON[Number(b.m.slice(5)) - 1]}</b>
                  <small>{gbp(b.got)}</small>
                </div>
              ))}
            </div>
          </section>

          {multi && (
            <section className="card">
              <header className="card-h"><h2>By branch</h2></header>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Branch</th><th className="r">Students</th><th className="r">Collected</th><th className="r">Unpaid</th></tr></thead>
                  <tbody>
                    {branchIds.map((id) => {
                      const ss = active.filter((s) => s.branchId === id);
                      return (
                        <tr key={id}>
                          <td><b>{branchName(db, id)}</b></td>
                          <td className="r">{ss.length}</td>
                          <td className="r"><Money n={ss.reduce((a, s) => a + Math.min(paid(db, s, now), charge(db, s, now)), 0)} /></td>
                          <td className="r owe"><Money n={ss.reduce((a, s) => a + owed(db, s, now), 0)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {promises.length > 0 && (
            <section className="card">
              <header className="card-h"><h2>Promised payments</h2></header>
              <div className="list">
                {promises.map(({ n, s }) => (
                  <a className="row link" key={n.id} href={"#/students/" + s!.id}>
                    <span className="row-icon"><Icon name="flag" size={18} /></span>
                    <span className="grow"><b>{s!.name}</b><small>{n.text}</small></span>
                    <Pill tone={n.promiseDate! < today ? "bad" : "warn"}>{n.promiseDate! < today ? "Was due " : ""}{dateLabel(n.promiseDate!).replace(/ \d{4}$/, "")}</Pill>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="card">
        <header className="card-h"><h2>Latest receipts</h2><a className="btn sm" href="#/receipts">All receipts</a></header>
        <div className="list">
          {[...live].reverse().slice(0, 6).map((r) => {
            const s = db.students.find((x) => x.id === r.studentId);
            return (
              <a className="row link" key={r.id} href={"#/receipts/" + r.id}>
                <span className="grow"><b>{s?.name}</b><small>{r.no} · {r.lines.map((l) => monthLabel(l.month, true)).join(", ")} · {r.method} · {userName(db, r.by)}</small></span>
                <span className="row-end"><b><Money n={receiptTotal(r)} /></b><small>{dateLabel(r.date)}</small></span>
              </a>
            );
          })}
          {!live.length && <Empty title="No payments yet" icon="receipt">Receipts appear here as payments are recorded.</Empty>}
        </div>
      </section>
    </Page>
  );
}
