import { useEffect } from "react";
import { balance, isActive } from "./logic";
import { currentUser, isCloud, nowMonth, resetSample, signIn, signOut, storageWorking, useApp, viewBranches } from "./store";
import { CloudGate } from "./pages/Auth";
import { branchName } from "./store";
import { Avatar, BrandScreen, go, Icon, Logo, Page, Pill, toast, Toaster, useIsMobile, usePath } from "./ui";
import { Dashboard } from "./pages/Dashboard";
import { Students } from "./pages/Students";
import { StudentProfile } from "./pages/StudentProfile";
import { StudentForm } from "./pages/StudentForm";
import { Collect } from "./pages/Collect";
import { MonthlySheet } from "./pages/MonthlySheet";
import { ReceiptPage, Receipts } from "./pages/Receipts";
import { Reports } from "./pages/Reports";
import { Classes } from "./pages/Classes";
import { SettingsPage } from "./pages/Settings";

interface NavItem { path: string; label: string; icon: string; sub?: string; exact?: boolean; not?: string; badge?: number }
interface NavGroup { label: string; items: NavItem[] }

/** The whole system, grouped by the job being done. The sidebar and the phone's More page both read this. */
function navGroups(admin: boolean, owing: number): NavGroup[] {
  return [
    { label: "", items: [{ path: "/", label: "Dashboard", icon: "home", exact: true }] },
    { label: "Students", items: [
      { path: "/students", label: "All students", icon: "students", not: "/students/new" },
      { path: "/students/new", label: "Register student", icon: "plus" },
    ] },
    { label: "Fees", items: [
      { path: "/collect", label: "Collect payment", icon: "collect" },
      { path: "/sheet", label: "Monthly sheet", icon: "sheet" },
      { path: "/receipts", label: "Receipts", icon: "receipt", sub: "Every payment taken, search and reprint" },
    ] },
    { label: "Reports", items: [
      { path: "/reports/collection", label: "Monthly collection", icon: "coins", sub: "Expected, collected and outstanding" },
      { path: "/reports/owed", label: "Owed list", icon: "alert", sub: "Who owes, which months, guardian's phone", badge: owing },
      { path: "/reports/statement", label: "Student statement", icon: "note", sub: "One student's year on a page" },
      { path: "/reports/enrollment", label: "Enrollment", icon: "report", sub: "Students per branch and class" },
    ] },
    { label: "School", items: [
      { path: "/classes", label: "Classes", icon: "classes", sub: "Groups, teachers and schedules" },
      { path: "/settings", label: admin ? "Settings" : "My account", icon: admin ? "settings" : "user", sub: admin ? "Fee, year, branches, staff, backup" : "Theme and sign out" },
    ] },
  ];
}
function isCurrent(path: string, nav: string) {
  return nav === "/" ? path === "/" : path === nav || path.startsWith(nav + "/");
}
function itemCurrent(path: string, n: NavItem) {
  if (n.exact) return path === n.path;
  if (n.not && isCurrent(path, n.not)) return false;
  return isCurrent(path, n.path);
}

/** How many active students in the branches being viewed owe something. Shown beside "Owed list". */
function owingCount(app: ReturnType<typeof useApp>) {
  const ids = viewBranches(app);
  const now = nowMonth();
  return app.db.students.filter((st) => ids.includes(st.branchId) && isActive(st) && balance(app.db, st, now) > 0).length;
}

export function App() {
  const app = useApp();
  const path = usePath();
  const mobile = useIsMobile();
  const user = currentUser(app);

  useEffect(() => {
    const t = app.session.theme;
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    // Keep the phone's status bar the same colour as the page.
    const paint = () => document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--paper").trim());
    paint();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", paint);
    return () => mq.removeEventListener("change", paint);
  }, [app.session.theme]);

  if (isCloud && (app.cloud.phase !== "ready" || !user)) return (<><CloudGate /><Toaster /></>);
  if (!user) return (<><Login /><Toaster /></>);

  const seg = path.split("/").filter(Boolean);
  let screen;
  switch (seg[0]) {
    case undefined: screen = <Dashboard />; break;
    case "students":
      if (seg[1] === "new") screen = <StudentForm />;
      else if (seg[1] && seg[2] === "edit") screen = <StudentForm id={seg[1]} />;
      else if (seg[1]) screen = <StudentProfile id={seg[1]} />;
      else screen = <Students />;
      break;
    case "collect": screen = <Collect studentId={seg[1]} />; break;
    case "sheet": screen = <MonthlySheet />; break;
    case "receipts": screen = seg[1] ? <ReceiptPage id={seg[1]} /> : <Receipts />; break;
    case "reports": screen = <Reports name={seg[1]} arg={seg[2]} />; break;
    case "classes": screen = <Classes />; break;
    case "settings": screen = <SettingsPage section={seg[1]} />; break;
    case "more": screen = <More />; break;
    default: screen = <Dashboard />;
  }

  const groups = navGroups(user.role === "admin", owingCount(app));

  // Task screens (taking a payment, a form, a receipt) get the full height on phones.
  const task = (seg[0] === "collect" && !!seg[1]) || (seg[0] === "students" && (seg[1] === "new" || seg[2] === "edit")) || (seg[0] === "receipts" && !!seg[1]);

  return (
    <div className="app">
      {!mobile && (
        <aside className="rail">
          <div className="brand">
            <Logo className="brand-logo" />
            <div className="brand-name"><b>Khalwa with Qur'an</b><span lang="ar">خلوة مع القرآن</span></div>
          </div>
          <nav className="nav" aria-label="Main">
            {groups.map((g) => (
              <div className="nav-group" key={g.label || "top"} role="group" aria-label={g.label || undefined}>
                {g.label && <span className="nav-label">{g.label}</span>}
                {g.items.map((n) => (
                  <a key={n.path} href={"#" + n.path} aria-current={itemCurrent(path, n) ? "page" : undefined}>
                    <Icon name={n.icon} size={19} />
                    <span className="grow">{n.label}</span>
                    {!!n.badge && <span className="nav-badge" title={n.badge + " students owe"}>{n.badge}</span>}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <div className="rail-foot">
            <div className="who">
              <Avatar name={user.name} />
              <div><b>{user.name}</b><span>{user.role === "admin" ? "Admin" : "Staff, " + branchName(app.db, user.branchId || "")}</span></div>
            </div>
            <button type="button" className="rail-out" onClick={signOut}><Icon name="logout" size={16} />Sign out</button>
            {!isCloud && <p className="test-tag">Demo. Sample data, saved on this device only.</p>}
          </div>
        </aside>
      )}
      {screen}
      {mobile && !task && (
        <nav className="tabbar" aria-label="Main">
          <a href="#/" aria-current={path === "/" ? "page" : undefined}><Icon name="home" size={22} />Dashboard</a>
          <a href="#/students" aria-current={isCurrent(path, "/students") ? "page" : undefined}><Icon name="students" size={22} />Students</a>
          <a href="#/collect" className="tab-main" aria-current={isCurrent(path, "/collect") ? "page" : undefined} aria-label="Collect payment"><span><Icon name="collect" size={24} /></span>Collect</a>
          <a href="#/sheet" aria-current={isCurrent(path, "/sheet") ? "page" : undefined}><Icon name="sheet" size={22} />Sheet</a>
          <a href="#/more" aria-current={["/more", "/receipts", "/reports", "/classes", "/settings"].some((p) => isCurrent(path, p)) ? "page" : undefined}><Icon name="menu" size={22} />More</a>
        </nav>
      )}
      <Toaster />
    </div>
  );
}

function Login() {
  const { db } = useApp();
  return (
    <BrandScreen title="Welcome">
        <div className="login-list">
          <span className="login-cap">Demo: choose who to sign in as</span>
          {db.users.filter((u) => u.active).map((u) => (
            <button key={u.id} type="button" className="login-user" onClick={() => { signIn(u.id); go("/", true); }}>
              <Avatar name={u.name} />
              <span className="grow"><b>{u.name}</b><small>{u.role === "admin" ? "Both branches. Fees, staff, settings, voiding receipts." : `${branchName(db, u.branchId || "")} only. Registers students and takes payments.`}</small></span>
              <Icon name="next" size={18} />
            </button>
          ))}
        </div>
        <p className="login-note">
          This demo uses sample students. Anything you add stays in this browser only.
          The live system signs in with email and password.
        </p>
        <button type="button" className="btn ghost sm" onClick={() => { resetSample(); toast("Demo reset to the sample data"); }}>Reset the demo</button>
        {!storageWorking() && <p className="login-note warn">This browser is blocking storage, so changes will be lost when the page closes.</p>}
    </BrandScreen>
  );
}

function More() {
  const app = useApp();
  const user = currentUser(app)!;
  // Everything that is not already on the tab bar, in the same groups as the desktop sidebar.
  const onTabs = ["/", "/students", "/collect", "/sheet"];
  const groups = navGroups(user.role === "admin", owingCount(app))
    .map((g) => ({ ...g, items: g.items.filter((n) => !onTabs.includes(n.path)) }))
    .filter((g) => g.items.length);
  return (
    <Page title="More">
      <div className="card who-card">
        <Avatar name={user.name} size="lg" />
        <div className="grow"><b>{user.name}</b><span className="muted">{user.email}</span></div>
        <Pill tone="teal">{user.role === "admin" ? "Admin" : "Staff"}</Pill>
      </div>
      {groups.map((g) => (
        <section className="menu-group" key={g.label} aria-label={g.label}>
          <h2 className="group-label">{g.label}</h2>
          <div className="card list">
            {g.items.map((n) => (
              <a key={n.path} className="row link" href={"#" + n.path}>
                <span className="row-icon"><Icon name={n.icon} /></span>
                <span className="grow"><b>{n.label}</b>{n.sub && <small>{n.sub}</small>}</span>
                {!!n.badge && <Pill tone="bad">{n.badge}</Pill>}
                <Icon name="next" size={18} />
              </a>
            ))}
          </div>
        </section>
      ))}
      <button type="button" className="btn block" onClick={signOut}><Icon name="logout" size={18} />Sign out</button>
      {!isCloud && <p className="test-tag center">Demo. Sample data, saved on this device only.</p>}
    </Page>
  );
}
