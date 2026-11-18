// App state. In this test version everything is kept in the browser's local
// storage. Every screen reads and writes through the functions in this file, so
// moving to Firebase later means replacing this file, not the screens.
import { useSyncExternalStore } from "react";
import {
  Activity, addMonths, allocate, Branch, ClassRoom, DB, isoDate, Method, monthsBetween, Note, pad, Receipt, receiptTotal, Role, Settings, Student, User, ymOf, fmt, monthLabel,
} from "./logic";

export interface Session {
  userId: string | null;
  view: string; // "all" or a branch id (admins only)
  theme: "system" | "light" | "dark";
}
interface AppState {
  db: DB;
  session: Session;
}

const DB_KEY = "khalwa-db-v1";
const SESSION_KEY = "khalwa-session-v1";

export function today() {
  return isoDate(new Date());
}
export function nowMonth() {
  return ymOf(today());
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* ---------- sample data ---------- */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const BOYS: [string, string][] = [["Mohammed", "محمد"], ["Ahmed", "أحمد"], ["Omar", "عمر"], ["Ali", "علي"], ["Yusuf", "يوسف"], ["Hamza", "حمزة"], ["Abdullah", "عبدالله"], ["Ibrahim", "إبراهيم"], ["Bilal", "بلال"], ["Khalid", "خالد"], ["Tariq", "طارق"], ["Anas", "أنس"], ["Mustafa", "مصطفى"], ["Adam", "آدم"], ["Idris", "إدريس"], ["Zakaria", "زكريا"], ["Hassan", "حسن"], ["Mahmoud", "محمود"], ["Sami", "سامي"], ["Walid", "وليد"], ["Talha", "طلحة"], ["Ayoub", "أيوب"], ["Salem", "سالم"]];
const GIRLS: [string, string][] = [["Fatima", "فاطمة"], ["Aisha", "عائشة"], ["Khadija", "خديجة"], ["Maryam", "مريم"], ["Zainab", "زينب"], ["Salma", "سلمى"], ["Noor", "نور"], ["Hafsa", "حفصة"], ["Ruqayya", "رقية"], ["Amina", "أمينة"], ["Layla", "ليلى"], ["Hana", "هناء"], ["Rania", "رانيا"], ["Safa", "صفاء"], ["Jana", "جنى"], ["Malak", "ملاك"], ["Sara", "سارة"], ["Lina", "لينا"], ["Asma", "أسماء"], ["Hiba", "هبة"], ["Dalal", "دلال"], ["Sumaya", "سمية"], ["Arwa", "أروى"]];
const FAMILIES: [string, string][] = [["Al-Fitouri", "الفيتوري"], ["Ben Omran", "بن عمران"], ["Al-Zawi", "الزاوي"], ["Shalgham", "شلغم"], ["Al-Mismari", "المسماري"], ["Dukali", "الدوكالي"], ["Ben Ghalbon", "بن غلبون"], ["Al-Werfalli", "الورفلي"], ["Al-Hadi", "الهادي"], ["Ben Saad", "بن سعد"], ["Abu Ajila", "أبو عجيلة"], ["Al-Tarhouni", "الترهوني"], ["Ben Naser", "بن ناصر"], ["Al-Gharyani", "الغرياني"], ["Ben Khalifa", "بن خليفة"], ["Al-Obeidi", "العبيدي"]];
const FATHERS = ["Salah", "Mukhtar", "Abdulsalam", "Faraj", "Nuri", "Jamal", "Ramadan", "Fathi", "Miftah", "Emhemed"];

export function seed(): DB {
  const r = rng(11);
  const t = new Date();
  const startYear = t.getMonth() + 1 >= 9 ? t.getFullYear() : t.getFullYear() - 1;
  const yStart = `${startYear}-09`;
  const yEnd = `${startYear + 1}-06`;
  const now = nowMonth();
  const todayIso = today();

  const settings: Settings = {
    school: { name: "Khalwa with Qur'an", nameAr: "خلوة مع القرآن", address: "", phone: "", currency: "LYD" },
    fees: [{ from: yStart, amount: 60 }],
    year: { start: yStart, end: yEnd, noFee: [] },
    receipt: { footer: "جزاكم الله خيراً", paper: "A5" },
    lastBackup: null,
  };
  const branches: Branch[] = [
    { id: "b1", name: "Branch 1", address: "", prefix: "KQ1", active: true, nextReceipt: 1 },
    { id: "b2", name: "Branch 2", address: "", prefix: "KQ2", active: true, nextReceipt: 1 },
  ];
  const users: User[] = [
    { id: "u1", name: "Amal Ben Saad", email: "admin@example.com", role: "admin", branchId: null, active: true },
    { id: "u2", name: "Yusuf Al-Hadi", email: "branch1@example.com", role: "staff", branchId: "b1", active: true },
    { id: "u3", name: "Huda Al-Mismari", email: "branch2@example.com", role: "staff", branchId: "b2", active: true },
  ];
  const classes: ClassRoom[] = [
    { id: "c1", name: "Hifz – Morning", teacher: "Sh. Abdulrahman Dukali", days: "Sat, Mon, Wed", time: "09:00–11:00", branchId: "b1", archived: false },
    { id: "c2", name: "Hifz – Evening", teacher: "Sh. Abdulrahman Dukali", days: "Sun, Tue, Thu", time: "16:30–18:30", branchId: "b1", archived: false },
    { id: "c3", name: "Tajweed", teacher: "Ust. Mariam Shalgham", days: "Sat, Mon, Wed", time: "16:30–18:00", branchId: "b1", archived: false },
    { id: "c4", name: "Qa'ida Nouraniya", teacher: "Ust. Mariam Shalgham", days: "Sun, Tue, Thu", time: "09:00–10:30", branchId: "b1", archived: false },
    { id: "c5", name: "Hifz", teacher: "Sh. Idris Al-Zawi", days: "Sat, Mon, Wed", time: "16:30–18:30", branchId: "b2", archived: false },
    { id: "c6", name: "Qa'ida Nouraniya", teacher: "Ust. Sumaya Ben Naser", days: "Sun, Tue, Thu", time: "16:30–18:00", branchId: "b2", archived: false },
  ];

  const months = monthsBetween(yStart, now > yEnd ? yEnd : now);
  const students: Student[] = [];
  let seq = 1001;
  const mk = (branchId: string, classIds: string[], count: number) => {
    for (let i = 0; i < count; i++) {
      const girl = r() < 0.48;
      const pool = girl ? GIRLS : BOYS;
      const [fn, fnAr] = pool[Math.floor(r() * pool.length)];
      const [ln, lnAr] = FAMILIES[Math.floor(r() * FAMILIES.length)];
      const father = FATHERS[Math.floor(r() * FATHERS.length)];
      // Most students start with the year; a few join later.
      const startIdx = r() < 0.72 ? 0 : Math.min(months.length - 1, Math.floor(r() * months.length));
      const startMonth = months[startIdx] || yStart;
      const s: Student = {
        id: "s" + seq, no: "KQ-" + seq, name: `${fn} ${ln}`, nameAr: `${fnAr} ${lnAr}`, gender: girl ? "F" : "M",
        dob: `${startYear - 6 - Math.floor(r() * 9)}-${pad(1 + Math.floor(r() * 12))}-${pad(1 + Math.floor(r() * 28))}`,
        guardian: `${father} ${ln}`, phone: "09" + (1 + Math.floor(r() * 2)) + " " + String(1000000 + Math.floor(r() * 8999999)), phone2: "",
        branchId, classId: classIds[i % classIds.length], start: `${startMonth}-${pad(1 + Math.floor(r() * 10))}`,
        leftDate: null, waived: false, waiveReason: "", exempt: [], createdAt: `${startMonth}-01`,
      };
      students.push(s);
      seq++;
    }
  };
  mk("b1", ["c1", "c2", "c3", "c4"], 30);
  mk("b2", ["c5", "c6"], 16);
  // A few special cases so every state is visible while testing.
  students[4].waived = true; students[4].waiveReason = "Orphan sponsorship";
  students[33].waived = true; students[33].waiveReason = "Teacher's child";
  if (months.length > 1) {
    students[9].leftDate = `${months[months.length - 2]}-20`;
    students[12].exempt = [months[months.length - 2]];
  }

  // Payments
  const fee = 60;
  type Raw = Omit<Receipt, "no">;
  const raw: Raw[] = [];
  const dayNow = Number(todayIso.slice(8));
  for (const s of students) {
    if (s.waived) continue;
    const reliability = 0.55 + r() * 0.45;
    const staff = s.branchId === "b1" ? "u2" : "u3";
    for (const m of months) {
      if (m < ymOf(s.start)) continue;
      if (s.leftDate && m > ymOf(s.leftDate)) continue;
      if (s.exempt.includes(m)) continue;
      const current = m === now;
      const chance = current ? reliability * Math.min(0.85, 0.25 + dayNow / 30) : reliability + 0.2;
      if (r() > chance) continue;
      const partial = !current && r() < 0.06;
      const maxDay = current ? Math.max(1, dayNow) : 24;
      const day = 1 + Math.floor(r() * maxDay);
      raw.push({
        id: uid(), studentId: s.id, branchId: s.branchId, date: `${m}-${pad(day)}`, method: r() < 0.8 ? "Cash" : "Bank transfer",
        by: r() < 0.85 ? staff : "u1", note: "", lines: [{ month: m, amount: partial ? fee / 2 : fee }], void: null,
      });
    }
  }
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const receipts: Receipt[] = raw.map((x) => {
    const b = branches.find((b) => b.id === x.branchId)!;
    const no = `${b.prefix}-${String(b.nextReceipt++).padStart(4, "0")}`;
    return { ...x, no };
  });

  // Notes
  const notes: Note[] = [];
  const add = (n: Omit<Note, "id" | "createdAt">) => notes.push({ ...n, id: uid(), createdAt: n.date + "T10:00:00" });
  const plus = (d: number) => isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + d));
  add({ studentId: students[1].id, type: "payment", date: plus(-2), by: "u2", text: "Father called. Will pay both months after salary.", promiseDate: plus(2) });
  add({ studentId: students[6].id, type: "payment", date: plus(-5), by: "u2", text: "Reminder sent by WhatsApp.", promiseDate: plus(-1) });
  add({ studentId: students[31].id, type: "payment", date: plus(-1), by: "u3", text: "Mother asked to pay in two parts this month.", promiseDate: plus(5) });
  add({ studentId: students[0].id, type: "progress", date: plus(-3), by: "u2", text: "Strong recitation, minor mistakes in madd.", kind: "New memorisation", from: "Al-Mulk 1", to: "Al-Mulk 15", grade: "Very good" });
  add({ studentId: students[0].id, type: "progress", date: plus(-10), by: "u2", text: "", kind: "Revision", from: "Juz 30", to: "Juz 30", grade: "Excellent" });
  add({ studentId: students[0].id, type: "conduct", date: plus(-6), by: "u2", text: "Absent, family travelling.", kind: "Absent" });
  add({ studentId: students[2].id, type: "progress", date: plus(-4), by: "u2", text: "Needs more revision at home.", kind: "New memorisation", from: "An-Naba 1", to: "An-Naba 20", grade: "Good" });
  add({ studentId: students[3].id, type: "conduct", date: plus(-1), by: "u2", text: "Arrived 20 minutes late.", kind: "Late" });
  add({ studentId: students[32].id, type: "progress", date: plus(-2), by: "u3", text: "", kind: "Revision", from: "Juz 29", to: "Juz 30", grade: "Very good" });

  return { version: 1, settings, branches, users, classes, students, receipts, notes, activity: [], seq: { student: seq } };
}

/* ---------- store ---------- */
function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const d = JSON.parse(raw) as DB;
      if (d && d.version === 1 && Array.isArray(d.students)) return d;
    }
  } catch {
    /* fall through to sample data */
  }
  return seed();
}
function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return { userId: null, view: "all", theme: "system", ...JSON.parse(raw) };
  } catch {
    /* default */
  }
  return { userId: null, view: "all", theme: "system" };
}

let state: AppState = { db: loadDB(), session: loadSession() };
const listeners = new Set<() => void>();
let storageOk = true;

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state.db));
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    storageOk = true;
  } catch {
    storageOk = false;
  }
}
function emit() {
  persist();
  listeners.forEach((l) => l());
}
export function storageWorking() {
  return storageOk;
}
export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
export function getState() {
  return state;
}

function commit(mut: (d: DB) => void, action?: string, detail = "") {
  const db: DB = JSON.parse(JSON.stringify(state.db));
  mut(db);
  if (action) {
    const a: Activity = { id: uid(), at: new Date().toISOString(), by: state.session.userId || "", action, detail };
    db.activity = [a, ...db.activity].slice(0, 400);
  }
  state = { ...state, db };
  emit();
}
function setSession(patch: Partial<Session>) {
  state = { ...state, session: { ...state.session, ...patch } };
  emit();
}

/* ---------- who am I, what can I see ---------- */
export function currentUser(s: AppState = state): User | null {
  return s.db.users.find((u) => u.id === s.session.userId && u.active) || null;
}
export function isAdmin(s: AppState = state) {
  return currentUser(s)?.role === "admin";
}
/** Branch ids the current user is looking at right now. */
export function viewBranches(s: AppState = state): string[] {
  const u = currentUser(s);
  if (!u) return [];
  if (u.role === "staff") return u.branchId ? [u.branchId] : [];
  const active = s.db.branches.filter((b) => b.active).map((b) => b.id);
  return s.session.view === "all" || !active.includes(s.session.view) ? active : [s.session.view];
}
/** Branch a new record should default to. */
export function defaultBranch(s: AppState = state) {
  return viewBranches(s)[0] || s.db.branches[0].id;
}
export function userName(db: DB, id: string) {
  return db.users.find((u) => u.id === id)?.name || "—";
}
export function branchName(db: DB, id: string) {
  return db.branches.find((b) => b.id === id)?.name || "—";
}
export function className(db: DB, id: string) {
  return db.classes.find((c) => c.id === id)?.name || "No class";
}

/* ---------- session ---------- */
export function signIn(userId: string) {
  const u = state.db.users.find((x) => x.id === userId);
  setSession({ userId, view: u?.role === "staff" && u.branchId ? u.branchId : "all" });
}
export function signOut() {
  setSession({ userId: null });
}
export function setView(view: string) {
  setSession({ view });
}
export function setTheme(theme: Session["theme"]) {
  setSession({ theme });
}

/* ---------- students ---------- */
export type StudentInput = Pick<Student, "name" | "nameAr" | "gender" | "dob" | "guardian" | "phone" | "phone2" | "branchId" | "classId" | "start" | "waived" | "waiveReason">;

export function saveStudent(input: StudentInput, id?: string): string {
  let outId = id || "";
  commit(
    (db) => {
      if (id) {
        const s = db.students.find((x) => x.id === id);
        if (s) Object.assign(s, input);
      } else {
        const n = db.seq.student++;
        outId = "s" + n;
        db.students.push({ ...input, id: outId, no: "KQ-" + n, leftDate: null, exempt: [], createdAt: new Date().toISOString() });
      }
    },
    id ? "Edited student" : "Registered student",
    input.name,
  );
  return outId;
}
export function findDuplicate(db: DB, name: string, phone: string, ignoreId?: string) {
  const n = name.trim().toLowerCase();
  const p = phone.replace(/\D/g, "");
  if (!n) return null;
  return db.students.find((s) => s.id !== ignoreId && s.name.trim().toLowerCase() === n && (!p || s.phone.replace(/\D/g, "") === p)) || null;
}
export function markLeft(id: string, date: string | null) {
  const s = state.db.students.find((x) => x.id === id);
  commit((db) => {
    const x = db.students.find((x) => x.id === id);
    if (x) x.leftDate = date;
  }, date ? "Marked student as left" : "Re-activated student", s?.name);
}
export function transferStudent(id: string, branchId: string, classId: string) {
  const s = state.db.students.find((x) => x.id === id);
  commit((db) => {
    const x = db.students.find((x) => x.id === id);
    if (x) {
      x.branchId = branchId;
      x.classId = classId;
    }
  }, "Transferred student", `${s?.name} to ${branchName(state.db, branchId)}`);
}
export function toggleExempt(id: string, month: string) {
  const s = state.db.students.find((x) => x.id === id);
  const on = !s?.exempt.includes(month);
  commit((db) => {
    const x = db.students.find((x) => x.id === id);
    if (x) x.exempt = on ? [...x.exempt, month] : x.exempt.filter((m) => m !== month);
  }, on ? "Exempted a month" : "Removed exemption", `${s?.name}, ${monthLabel(month)}`);
  return on;
}

/* ---------- payments ---------- */
export function recordPayment(p: { studentId: string; months: string[]; amount: number; date: string; method: Method; note: string }): string | null {
  const s = state.db.students.find((x) => x.id === p.studentId);
  if (!s) return null;
  const { lines } = allocate(state.db, s, p.months, p.amount);
  if (!lines.length) return null;
  const id = uid();
  let no = "";
  commit(
    (db) => {
      const b = db.branches.find((b) => b.id === s.branchId)!;
      no = `${b.prefix}-${String(b.nextReceipt++).padStart(4, "0")}`;
      db.receipts.push({ id, no, studentId: s.id, branchId: s.branchId, date: p.date, method: p.method, by: state.session.userId || "", note: p.note, lines, void: null });
    },
    "Recorded payment",
    `${s.name}, ${fmt(lines.reduce((a, l) => a + l.amount, 0))} ${state.db.settings.school.currency}`,
  );
  return id;
}
export function voidReceipt(id: string, reason: string) {
  const r = state.db.receipts.find((x) => x.id === id);
  commit((db) => {
    const x = db.receipts.find((x) => x.id === id);
    if (x && !x.void) x.void = { by: state.session.userId || "", at: new Date().toISOString(), reason };
  }, "Voided receipt", `${r?.no} (${r ? fmt(receiptTotal(r)) : ""}): ${reason}`);
}

/* ---------- notes ---------- */
export function addNote(n: Omit<Note, "id" | "createdAt" | "by">) {
  const s = state.db.students.find((x) => x.id === n.studentId);
  commit((db) => {
    db.notes.push({ ...n, id: uid(), by: state.session.userId || "", createdAt: new Date().toISOString() });
  }, "Added note", `${s?.name} (${n.type})`);
}
export function canDeleteNote(n: Note) {
  if (isAdmin()) return true;
  return n.by === state.session.userId && Date.now() - new Date(n.createdAt).getTime() < 24 * 3600 * 1000;
}
export function deleteNote(id: string) {
  commit((db) => {
    db.notes = db.notes.filter((n) => n.id !== id);
  }, "Deleted note");
}

/* ---------- classes ---------- */
export function saveClass(c: Omit<ClassRoom, "id" | "archived">, id?: string) {
  commit((db) => {
    if (id) {
      const x = db.classes.find((x) => x.id === id);
      if (x) Object.assign(x, c);
    } else db.classes.push({ ...c, id: "c" + uid(), archived: false });
  }, id ? "Edited class" : "Added class", c.name);
}
export function archiveClass(id: string, archived: boolean) {
  const c = state.db.classes.find((x) => x.id === id);
  commit((db) => {
    const x = db.classes.find((x) => x.id === id);
    if (x) x.archived = archived;
  }, archived ? "Archived class" : "Restored class", c?.name);
}

/* ---------- settings ---------- */
export function saveSchool(school: Settings["school"]) {
  commit((db) => {
    db.settings.school = school;
  }, "Changed school details");
}
export function setFee(from: string, amount: number) {
  commit((db) => {
    db.settings.fees = [...db.settings.fees.filter((f) => f.from !== from), { from, amount }].sort((a, b) => (a.from < b.from ? -1 : 1));
  }, "Changed monthly fee", `${fmt(amount)} from ${monthLabel(from)}`);
}
export function removeFee(from: string) {
  commit((db) => {
    if (db.settings.fees.length > 1) db.settings.fees = db.settings.fees.filter((f) => f.from !== from);
  }, "Removed a fee change", monthLabel(from));
}
export function saveYear(year: Settings["year"]) {
  commit((db) => {
    db.settings.year = year;
  }, "Changed academic year", `${monthLabel(year.start)} to ${monthLabel(year.end)}`);
}
export function startNextYear() {
  commit((db) => {
    const y = db.settings.year;
    db.settings.pastYears = [...(db.settings.pastYears || []), y];
    db.settings.year = { start: addMonths(y.start, 12), end: addMonths(y.end, 12), noFee: [] };
  }, "Started a new academic year");
}
export function saveReceiptSettings(receipt: Settings["receipt"]) {
  commit((db) => {
    db.settings.receipt = receipt;
  }, "Changed receipt settings");
}
export function saveBranch(b: Pick<Branch, "name" | "address" | "prefix" | "active">, id?: string) {
  commit((db) => {
    if (id) {
      const x = db.branches.find((x) => x.id === id);
      if (x) Object.assign(x, b);
    } else db.branches.push({ ...b, id: "b" + uid(), nextReceipt: 1 });
  }, id ? "Edited branch" : "Added branch", b.name);
}
export function saveUser(u: { name: string; email: string; role: Role; branchId: string | null; active: boolean }, id?: string): string | null {
  // Never leave the school without an active admin.
  const others = state.db.users.filter((x) => x.id !== id && x.role === "admin" && x.active);
  if (id && others.length === 0 && (u.role !== "admin" || !u.active)) return "At least one active admin is needed.";
  commit((db) => {
    if (id) {
      const x = db.users.find((x) => x.id === id);
      if (x) Object.assign(x, u);
    } else db.users.push({ ...u, id: "u" + uid() });
  }, id ? "Edited staff account" : "Added staff account", u.name);
  return null;
}

/* ---------- data ---------- */
export function exportBackup(): string {
  commit((db) => {
    db.settings.lastBackup = new Date().toISOString();
  }, "Downloaded backup");
  return JSON.stringify(state.db, null, 1);
}
export function importBackup(text: string): string | null {
  try {
    const d = JSON.parse(text) as DB;
    if (!d || d.version !== 1 || !Array.isArray(d.students) || !Array.isArray(d.receipts) || !d.settings) return "This file is not a Khalwa backup.";
    const keep = state.session.userId;
    state = { db: d, session: { ...state.session, userId: d.users.some((u) => u.id === keep) ? keep : null } };
    emit();
    return null;
  } catch {
    return "The file could not be read.";
  }
}
export function resetSample() {
  state = { db: seed(), session: { ...state.session, view: "all" } };
  emit();
}
/** Remove all students, payments and notes but keep settings, branches, classes and staff. */
export function clearRecords() {
  commit((db) => {
    db.students = [];
    db.receipts = [];
    db.notes = [];
    db.branches.forEach((b) => (b.nextReceipt = 1));
    db.seq.student = 1001;
  }, "Cleared all students and payments");
}
