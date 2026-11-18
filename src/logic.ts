// Pure fee logic and types. No browser APIs here, so it can be unit-tested and
// reused unchanged when the data moves from local storage to Firestore.

export type Role = "admin" | "staff";
export type Method = "Cash" | "Bank transfer";
export type NoteType = "payment" | "progress" | "conduct";

export interface Branch {
  id: string;
  name: string;
  address: string;
  prefix: string;
  active: boolean;
  nextReceipt: number;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null; // null for admins (all branches)
  active: boolean;
}
export interface ClassRoom {
  id: string;
  name: string;
  teacher: string;
  days: string;
  time: string;
  branchId: string;
  archived: boolean;
}
export interface Student {
  id: string;
  no: string;
  name: string;
  nameAr: string;
  gender: "M" | "F";
  dob: string;
  guardian: string;
  phone: string;
  phone2: string;
  branchId: string;
  classId: string;
  start: string; // YYYY-MM-DD, fees are charged from this month
  leftDate: string | null;
  waived: boolean;
  waiveReason: string;
  exempt: string[]; // YYYY-MM months not charged for this student
  createdAt: string;
}
export interface ReceiptLine {
  month: string; // YYYY-MM the money is for
  amount: number;
}
export interface Receipt {
  id: string;
  no: string;
  studentId: string;
  branchId: string;
  date: string; // YYYY-MM-DD received
  method: Method;
  by: string; // user id
  note: string;
  lines: ReceiptLine[];
  void: null | { by: string; at: string; reason: string };
}
export interface Note {
  id: string;
  studentId: string;
  type: NoteType;
  date: string;
  by: string;
  text: string;
  createdAt: string;
  promiseDate?: string; // payment notes
  kind?: string; // progress: "New memorisation" | "Revision"; conduct: "Absent" | "Late" | "Conduct"
  from?: string; // progress
  to?: string; // progress
  grade?: string; // progress
}
export interface Activity {
  id: string;
  at: string;
  by: string;
  action: string;
  detail: string;
}
export interface Settings {
  school: { name: string; nameAr: string; address: string; phone: string; currency: string };
  fees: { from: string; amount: number }[]; // fee history; latest entry with from <= month applies
  year: { start: string; end: string; noFee: string[] };
  pastYears?: { start: string; end: string; noFee: string[] }[]; // earlier years, so old debts still count
  receipt: { footer: string; paper: "A5" | "Thermal" };
  lastBackup: string | null;
}
export interface DB {
  version: 1;
  settings: Settings;
  branches: Branch[];
  users: User[];
  classes: ClassRoom[];
  students: Student[];
  receipts: Receipt[];
  notes: Note[];
  activity: Activity[];
  seq: { student: number };
}

/* ---------- dates ---------- */
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MON = MONTHS.map((m) => m.slice(0, 3));

export function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function ymOf(date: string) {
  return date.slice(0, 7);
}
export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthsBetween(start: string, end: string) {
  const out: string[] = [];
  for (let m = start; m <= end && out.length < 60; m = addMonths(m, 1)) out.push(m);
  return out;
}
export function monthLabel(ym: string, short = false) {
  const [y, m] = ym.split("-").map(Number);
  return `${(short ? MON : MONTHS)[m - 1]} ${y}`;
}
export function dateLabel(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
}
export function hijriLabel(ym: string) {
  try {
    const [y, m] = ym.split("-").map(Number);
    const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "long", year: "numeric" });
    return f.format(new Date(y, m - 1, 15)).replace(/\s*AH$/, "") + " AH";
  } catch {
    return "";
  }
}

/* ---------- fees ---------- */
/** Months of the current academic year (what the monthly sheet shows). */
export function yearMonths(db: DB) {
  return monthsBetween(db.settings.year.start, db.settings.year.end);
}
function allYears(db: DB) {
  return [...(db.settings.pastYears || []), db.settings.year];
}
/** Every month that can carry a charge: earlier years plus the current one. */
export function chargeMonths(db: DB) {
  const out: string[] = [];
  for (const y of allYears(db)) for (const m of monthsBetween(y.start, y.end)) if (!out.includes(m)) out.push(m);
  return out.sort();
}

/** The flat monthly fee that applies in a given month. */
export function feeFor(settings: Settings, month: string) {
  let amount = 0;
  let best = "";
  for (const f of settings.fees) {
    if (f.from <= month && f.from >= best) {
      best = f.from;
      amount = f.amount;
    }
  }
  return amount;
}

export type MonthStatus = "na" | "nofee" | "waived" | "exempt" | "paid" | "partial" | "due" | "future";

/** Why a month is not charged, or null if it is. */
function notCharged(db: DB, s: Student, month: string): MonthStatus | null {
  if (month < ymOf(s.start)) return "na";
  if (s.leftDate && month > ymOf(s.leftDate)) return "na";
  const year = allYears(db).find((y) => month >= y.start && month <= y.end);
  if (!year) return "na";
  if (year.noFee.includes(month)) return "nofee";
  if (s.waived) return "waived";
  if (s.exempt.includes(month)) return "exempt";
  return null;
}

/** Amount charged to a student for a month. */
export function charge(db: DB, s: Student, month: string) {
  return notCharged(db, s, month) ? 0 : feeFor(db.settings, month);
}

export type PaidIndex = Map<string, number>;
const paidCache = new WeakMap<Receipt[], PaidIndex>();

/** studentId|month -> total paid, ignoring voided receipts. Cached per receipts array. */
export function paidIndex(db: DB): PaidIndex {
  let idx = paidCache.get(db.receipts);
  if (idx) return idx;
  idx = new Map();
  for (const r of db.receipts) {
    if (r.void) continue;
    for (const l of r.lines) {
      const k = r.studentId + "|" + l.month;
      idx.set(k, (idx.get(k) || 0) + l.amount);
    }
  }
  paidCache.set(db.receipts, idx);
  return idx;
}
export function paid(db: DB, s: Student, month: string) {
  return paidIndex(db).get(s.id + "|" + month) || 0;
}
export function owed(db: DB, s: Student, month: string) {
  return Math.max(0, charge(db, s, month) - paid(db, s, month));
}
export function monthStatus(db: DB, s: Student, month: string, now: string): MonthStatus {
  const why = notCharged(db, s, month);
  if (why) return why;
  const c = feeFor(db.settings, month);
  const p = paid(db, s, month);
  if (p >= c) return "paid";
  if (p > 0) return "partial";
  return month > now ? "future" : "due";
}
/** Months up to and including `now` where the student still owes something. */
export function owingMonths(db: DB, s: Student, now: string) {
  return chargeMonths(db).filter((m) => m <= now && owed(db, s, m) > 0);
}
export function balance(db: DB, s: Student, now: string) {
  return owingMonths(db, s, now).reduce((a, m) => a + owed(db, s, m), 0);
}
export function isActive(s: Student) {
  return !s.leftDate;
}

/**
 * Split an amount across the chosen months, earliest first, never paying more
 * than is owed for a month. Returns the lines and any amount left over.
 */
export function allocate(db: DB, s: Student, months: string[], amount: number) {
  const lines: ReceiptLine[] = [];
  let left = amount;
  for (const m of [...months].sort()) {
    if (left <= 0) break;
    const a = Math.min(owed(db, s, m), left);
    if (a > 0) {
      lines.push({ month: m, amount: a });
      left -= a;
    }
  }
  return { lines, left };
}

export function receiptTotal(r: Receipt) {
  return r.lines.reduce((a, l) => a + l.amount, 0);
}

export function fmt(n: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}
