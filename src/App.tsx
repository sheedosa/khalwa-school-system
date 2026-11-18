import { useEffect } from "react";
import { currentUser, signIn, signOut, storageWorking, useApp } from "./store";
import { branchName } from "./store";
import { Avatar, go, Icon, Page, Pill, Toaster, useIsMobile, usePath } from "./ui";
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

const LOGO = "./logo.webp";

const NAV: { path: string; label: string; icon: string; group: number }[] = [
  { path: "/", label: "Dashboard", icon: "home", group: 0 },
  { path: "/students", label: "Students", icon: "students", group: 0 },
  { path: "/collect", label: "Collect payment", icon: "collect", group: 1 },
  { path: "/sheet", label: "Monthly sheet", icon: "sheet", group: 1 },
  { path: "/receipts", label: "Receipts", icon: "receipt", group: 1 },
  { path: "/reports", label: "Reports", icon: "report", group: 1 },
  { path: "/classes", label: "Classes", icon: "classes", group: 2 },
  { path: "/settings", label: "Settings", icon: "settings", group: 2 },
];
function isCurrent(path: string, nav: string) {
  return nav === "/" ? path === "/" : path === nav || path.startsWith(nav + "/");
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
  }, [app.session.theme]);

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

  // Task screens (taking a payment, a form, a receipt) get the full height on phones.
  const task = (seg[0] === "collect" && !!seg[1]) || (seg[0] === "students" && (seg[1] === "new" || seg[2] === "edit")) || (seg[0] === "receipts" && !!seg[1]);

  return (
    <div className="app">
      {!mobile && (
        <aside className="rail">
          <div className="brand">
            <div className="arch"><img src={LOGO} alt="" /></div>
            <div className="wordmark">KHALWA WITH QUR'AN<span lang="ar">خلوة مع القرآن</span></div>
          </div>
          <nav className="nav" aria-label="Main">
            {NAV.map((n, i) => (
              <div key={n.path} className={i > 0 && NAV[i - 1].group !== n.group ? "nav-gap" : undefined}>
                <a href={"#" + n.path} aria-current={isCurrent(path, n.path) ? "page" : undefined}>
                  <Icon name={n.icon} />{n.label}
                </a>
              </div>
            ))}
          </nav>
          <div className="rail-foot">
            <div className="who">
              <Avatar name={user.name} />
              <div><b>{user.name}</b><span>{user.role === "admin" ? "Admin" : "Staff, " + branchName(app.db, user.branchId || "")}</span></div>
            </div>
            <button type="button" className="rail-out" onClick={signOut}><Icon name="logout" size={16} />Sign out</button>
            <p className="test-tag">Test version. Data is saved on this device only.</p>
          </div>
        </aside>
      )}
      {screen}
      {mobile && !task && (
        <nav className="tabbar" aria-label="Main">
          <a href="#/" aria-current={path === "/" ? "page" : undefined}><Icon name="home" size={22} />Home</a>
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
    <div className="login">
      <div className="login-card">
        <div className="arch big"><img src={LOGO} alt="Khalwa with Qur'an" /></div>
        <div className="wordmark dark">KHALWA WITH QUR'AN<span lang="ar">خلوة مع القرآن</span></div>
        <p className="login-lead">Student registration and monthly fees</p>
        <div className="login-list">
          <span className="login-cap">Sign in as a sample account</span>
          {db.users.filter((u) => u.active).map((u) => (
            <button key={u.id} type="button" className="login-user" onClick={() => { signIn(u.id); go("/", true); }}>
              <Avatar name={u.name} />
              <span className="grow"><b>{u.name}</b><small>{u.role === "admin" ? "Admin · sees both branches, all settings" : `Staff · ${branchName(db, u.branchId || "")} only`}</small></span>
              <Icon name="next" size={18} />
            </button>
          ))}
        </div>
        <p className="login-note">
          This is a test version with sample students. Anything you add is saved in this browser only.
          Email and password sign-in is added when the system goes live.
        </p>
        {!storageWorking() && <p className="login-note warn">This browser is blocking storage, so changes will be lost when the page closes.</p>}
      </div>
    </div>
  );
}

function More() {
  const app = useApp();
  const user = currentUser(app)!;
  const items = NAV.filter((n) => ["/receipts", "/reports", "/classes", "/settings"].includes(n.path));
  const sub: Record<string, string> = {
    "/receipts": "Every payment taken, search and reprint",
    "/reports": "Collection, owed list, statements, enrollment",
    "/classes": "Groups, teachers and schedules",
    "/settings": user.role === "admin" ? "School, fee, branches, staff, backup" : "Your account and theme",
  };
  return (
    <Page title="More">
      <div className="card who-card">
        <Avatar name={user.name} size="lg" />
        <div className="grow"><b>{user.name}</b><span className="muted">{user.email}</span></div>
        <Pill tone="teal">{user.role === "admin" ? "Admin" : "Staff"}</Pill>
      </div>
      <div className="card list">
        {items.map((n) => (
          <a key={n.path} className="row link" href={"#" + n.path}>
            <span className="row-icon"><Icon name={n.icon} /></span>
            <span className="grow"><b>{n.label}</b><small>{sub[n.path]}</small></span>
            <Icon name="next" size={18} />
          </a>
        ))}
      </div>
      <button type="button" className="btn block" onClick={signOut}><Icon name="logout" size={18} />Sign out</button>
      <p className="test-tag center">Test version. Data is saved on this device only.</p>
    </Page>
  );
}
