import { describe, expect, it } from "vitest";
import { allocate, balance, charge, DB, feeFor, gbp, monthStatus, monthsBetween, owed, owingMonths, Receipt, Student } from "./logic";

function student(over: Partial<Student> = {}): Student {
  return {
    id: "s1", no: "KQ-1", name: "Test Student", nameAr: "", gender: "M", dob: "2015-01-01", guardian: "", phone: "", phone2: "",
    branchId: "b1", classId: "c1", start: "2026-10-05", leftDate: null, waived: false, waiveReason: "", exempt: [], createdAt: "", ...over,
  };
}
function receipt(lines: [string, number][], over: Partial<Receipt> = {}): Receipt {
  return {
    id: "r" + Math.random(), no: "X", studentId: "s1", branchId: "b1", date: "2026-10-06", method: "Cash", by: "u1", note: "",
    lines: lines.map(([month, amount]) => ({ month, amount })), void: null, ...over,
  };
}
function db(receipts: Receipt[] = [], over: Partial<DB["settings"]> = {}): DB {
  return {
    version: 1,
    settings: {
      school: { name: "", nameAr: "", address: "", phone: "", currency: "GBP" },
      fees: [{ from: "2026-09", amount: 60 }],
      year: { start: "2026-09", end: "2027-06", noFee: [] },
      receipt: { footer: "", paper: "A5" },
      lastBackup: null,
      ...over,
    },
    branches: [], users: [], classes: [], students: [], receipts, notes: [], activity: [], seq: { student: 1 },
  };
}

describe("monthly owed", () => {
  it("matches the worked example: started Oct, paid Oct, half of Nov, nothing in Dec", () => {
    const s = student();
    const d = db([receipt([["2026-10", 60]]), receipt([["2026-11", 30]])]);
    expect(charge(d, s, "2026-09")).toBe(0);
    expect(owed(d, s, "2026-10")).toBe(0);
    expect(owed(d, s, "2026-11")).toBe(30);
    expect(owed(d, s, "2026-12")).toBe(60);
    expect(balance(d, s, "2026-12")).toBe(90);
    expect(owingMonths(d, s, "2026-12")).toEqual(["2026-11", "2026-12"]);
    expect(monthStatus(d, s, "2026-09", "2026-12")).toBe("na");
    expect(monthStatus(d, s, "2026-10", "2026-12")).toBe("paid");
    expect(monthStatus(d, s, "2026-11", "2026-12")).toBe("partial");
    expect(monthStatus(d, s, "2026-12", "2026-12")).toBe("due");
    expect(monthStatus(d, s, "2027-01", "2026-12")).toBe("future");
  });

  it("ignores voided receipts", () => {
    const s = student();
    const d = db([receipt([["2026-10", 60]], { void: { by: "u1", at: "", reason: "wrong student" } })]);
    expect(owed(d, s, "2026-10")).toBe(60);
  });

  it("does not charge waived students, exempt months, no-fee months or months after leaving", () => {
    expect(balance(db(), student({ waived: true }), "2026-12")).toBe(0);
    expect(owed(db(), student({ exempt: ["2026-11"] }), "2026-11")).toBe(0);
    const noFee = db([], { year: { start: "2026-09", end: "2027-06", noFee: ["2026-12"] } });
    expect(owed(noFee, student(), "2026-12")).toBe(0);
    expect(monthStatus(noFee, student(), "2026-12", "2026-12")).toBe("nofee");
    const left = student({ leftDate: "2026-11-20" });
    expect(owed(db(), left, "2026-11")).toBe(60);
    expect(owed(db(), left, "2026-12")).toBe(0);
  });

  it("keeps the old fee for months before a fee change", () => {
    const d = db([], { fees: [{ from: "2026-09", amount: 60 }, { from: "2027-01", amount: 70 }] });
    expect(feeFor(d.settings, "2026-12")).toBe(60);
    expect(feeFor(d.settings, "2027-01")).toBe(70);
    expect(feeFor(d.settings, "2027-03")).toBe(70);
    expect(balance(d, student(), "2027-01")).toBe(60 * 3 + 70);
  });

  it("counts a month paid in advance as paid", () => {
    const d = db([receipt([["2027-02", 60]])]);
    expect(monthStatus(d, student(), "2027-02", "2026-11")).toBe("paid");
  });
});

describe("allocating a payment", () => {
  it("pays the earliest month first and reports a partial last month", () => {
    const s = student();
    const d = db();
    const { lines, left } = allocate(d, s, ["2026-12", "2026-10", "2026-11"], 150);
    expect(lines).toEqual([
      { month: "2026-10", amount: 60 },
      { month: "2026-11", amount: 60 },
      { month: "2026-12", amount: 30 },
    ]);
    expect(left).toBe(0);
  });
  it("never over-pays a month and returns what is left over", () => {
    const d = db([receipt([["2026-10", 40]])]);
    const { lines, left } = allocate(d, student(), ["2026-10"], 60);
    expect(lines).toEqual([{ month: "2026-10", amount: 20 }]);
    expect(left).toBe(40);
  });
});

describe("months", () => {
  it("lists an academic year across the new year", () => {
    const m = monthsBetween("2026-09", "2027-06");
    expect(m.length).toBe(10);
    expect(m[4]).toBe("2027-01");
  });
});

describe("earlier academic years", () => {
  it("keeps counting unpaid months after a new year is started", () => {
    const d = db([], { year: { start: "2027-09", end: "2028-06", noFee: [] }, pastYears: [{ start: "2026-09", end: "2027-06", noFee: [] }] });
    const s = student({ start: "2027-05-01" });
    // May and June 2027 from the old year, September 2027 from the new one. July and August are outside both.
    expect(owingMonths(d, s, "2027-09")).toEqual(["2027-05", "2027-06", "2027-09"]);
    expect(balance(d, s, "2027-09")).toBe(180);
  });
});

describe("money", () => {
  it("shows pounds, with pence only when there are some", () => {
    expect(gbp(30)).toBe("£30");
    expect(gbp(1680)).toBe("£1,680");
    expect(gbp(12.5)).toBe("£12.50");
    expect(gbp(0)).toBe("£0");
  });
});
