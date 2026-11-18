// Run with: npm run test:rules  (starts the Firestore emulator)
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, query, setDoc, updateDoc, where } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const OWNER = "owner@school.test", ADMIN = "admin@school.test", S1 = "staff1@school.test", S2 = "staff2@school.test", OFF = "gone@school.test", STRANGER = "stranger@else.test";
const as = (email: string, verified = true) => env.authenticatedContext(email.replace(/\W/g, "_"), { email, email_verified: verified }).firestore();
const student = (over = {}) => ({ id: "s1", no: "KQ-1001", name: "A", branchId: "b1", classId: "c1", waived: false, waiveReason: "", exempt: [], leftDate: null, ...over });
const receipt = (by: string, over = {}) => ({ id: "r1", no: "KQ1-0001", studentId: "s1", branchId: "b1", studentBranchId: "b1", date: "2026-11-01", method: "Cash", by, note: "", lines: [{ month: "2026-11", amount: 30 }], void: null, ...over });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-khalwa-rules", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "meta/owner"), { email: OWNER });
    await setDoc(doc(db, "meta/settings"), { fees: [] });
    await setDoc(doc(db, "meta/counters"), { student: 1001 });
    await setDoc(doc(db, "users", ADMIN), { email: ADMIN, role: "admin", branchId: null, active: true });
    await setDoc(doc(db, "users", S1), { email: S1, role: "staff", branchId: "b1", active: true });
    await setDoc(doc(db, "users", S2), { email: S2, role: "staff", branchId: "b2", active: true });
    await setDoc(doc(db, "users", OFF), { email: OFF, role: "staff", branchId: "b1", active: false });
    await setDoc(doc(db, "branches/b1"), { id: "b1", prefix: "KQ1", nextReceipt: 1, active: true });
    await setDoc(doc(db, "branches/b2"), { id: "b2", prefix: "KQ2", nextReceipt: 1, active: true });
    await setDoc(doc(db, "students/s1"), student());
    await setDoc(doc(db, "students/s2"), student({ id: "s2", branchId: "b2" }));
    await setDoc(doc(db, "receipts/r1"), receipt(S1));
    await setDoc(doc(db, "notes/n1"), { id: "n1", studentId: "s1", branchId: "b1", by: S1, createdMs: Date.now(), text: "x" });
    await setDoc(doc(db, "notes/old"), { id: "old", studentId: "s1", branchId: "b1", by: S1, createdMs: Date.now() - 2 * 86400000, text: "x" });
  });
});

describe("who gets in", () => {
  it("blocks signed-out, unverified, unknown and deactivated people", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "students/s1")));
    await assertFails(getDoc(doc(as(S1, false), "students/s1")));
    await assertFails(getDoc(doc(as(STRANGER), "students/s1")));
    await assertFails(getDoc(doc(as(OFF), "students/s1")));
    await assertFails(getDoc(doc(as(STRANGER), "meta/settings")));
    await assertFails(getDocs(collection(as(STRANGER), "users")));
  });
  it("lets a new person see only whether they have been added", async () => {
    await assertSucceeds(getDoc(doc(as(STRANGER), "users", STRANGER)));
    await assertSucceeds(getDoc(doc(as(STRANGER), "meta/owner")));
    await assertFails(setDoc(doc(as(STRANGER), "users", STRANGER), { email: STRANGER, role: "admin", active: true }));
  });
  it("lets the school be claimed only once", async () => {
    await assertFails(setDoc(doc(as(STRANGER), "meta/owner"), { email: STRANGER }));
    await env.withSecurityRulesDisabled((c) => deleteDoc(doc(c.firestore(), "meta/owner")));
    await assertFails(setDoc(doc(as(STRANGER), "meta/owner"), { email: "someone@else.test" }));
    await assertFails(setDoc(doc(as(STRANGER, false), "meta/owner"), { email: STRANGER }));
    await assertSucceeds(setDoc(doc(as(STRANGER), "meta/owner"), { email: STRANGER }));
  });
  it("treats the owner as an admin without a users document", async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), "students/s2")));
    await assertSucceeds(setDoc(doc(as(OWNER), "users", OWNER), { email: OWNER, role: "admin", branchId: null, active: true }));
  });
});

describe("branches are separate for staff", () => {
  it("staff read their own branch only", async () => {
    await assertSucceeds(getDoc(doc(as(S1), "students/s1")));
    await assertFails(getDoc(doc(as(S1), "students/s2")));
    await assertFails(getDoc(doc(as(S2), "receipts/r1")));
    await assertFails(getDoc(doc(as(S2), "notes/n1")));
    await assertSucceeds(getDocs(query(collection(as(S1), "students"), where("branchId", "==", "b1"))));
    await assertFails(getDocs(collection(as(S1), "students")));
    await assertFails(getDocs(query(collection(as(S1), "students"), where("branchId", "==", "b2"))));
  });
  it("admins read both", async () => {
    await assertSucceeds(getDocs(collection(as(ADMIN), "students")));
    await assertSucceeds(getDocs(collection(as(ADMIN), "receipts")));
  });
});

describe("students", () => {
  it("staff register and edit in their branch, but cannot waive, exempt, transfer or mark as left", async () => {
    await assertSucceeds(setDoc(doc(as(S1), "students/s9"), student({ id: "s9" })));
    await assertFails(setDoc(doc(as(S1), "students/s8"), student({ id: "s8", branchId: "b2" })));
    await assertFails(setDoc(doc(as(S1), "students/s7"), student({ id: "s7", waived: true })));
    await assertSucceeds(updateDoc(doc(as(S1), "students/s1"), { name: "B", phone: "07" }));
    await assertFails(updateDoc(doc(as(S1), "students/s1"), { waived: true }));
    await assertFails(updateDoc(doc(as(S1), "students/s1"), { exempt: ["2026-11"] }));
    await assertFails(updateDoc(doc(as(S1), "students/s1"), { branchId: "b2" }));
    await assertFails(updateDoc(doc(as(S1), "students/s1"), { leftDate: "2026-11-01" }));
    await assertFails(updateDoc(doc(as(S2), "students/s1"), { name: "C" }));
  });
  it("admins can do all of those, and nobody can delete", async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), "students/s1"), { waived: true, exempt: ["2026-11"], branchId: "b2", leftDate: "2026-11-01" }));
    await assertFails(deleteDoc(doc(as(ADMIN), "students/s1")));
    await assertFails(deleteDoc(doc(as(OWNER), "students/s1")));
  });
  it("student numbers go up one at a time", async () => {
    await assertSucceeds(updateDoc(doc(as(S1), "meta/counters"), { student: 1002 }));
    await assertFails(updateDoc(doc(as(S1), "meta/counters"), { student: 1 }));
    await assertFails(updateDoc(doc(as(S1), "meta/counters"), { student: 2000 }));
  });
});

describe("receipts", () => {
  it("staff issue receipts in their own name and branch only", async () => {
    await assertSucceeds(setDoc(doc(as(S1), "receipts/r2"), receipt(S1, { id: "r2" })));
    await assertFails(setDoc(doc(as(S1), "receipts/r3"), receipt(ADMIN, { id: "r3" })));
    await assertFails(setDoc(doc(as(S1), "receipts/r4"), receipt(S1, { id: "r4", branchId: "b2", studentBranchId: "b2" })));
    await assertFails(setDoc(doc(as(S1), "receipts/r7"), receipt(S1, { id: "r7", studentBranchId: "b2" })));
    await assertFails(setDoc(doc(as(S1), "receipts/r5"), receipt(S1, { id: "r5", lines: [] })));
    await assertFails(setDoc(doc(as(S1), "receipts/r6"), receipt(S1, { id: "r6", void: { by: S1, at: "", reason: "nope" } })));
  });
  it("receipts cannot be edited or deleted; only an admin can void, once, with a reason", async () => {
    await assertFails(updateDoc(doc(as(S1), "receipts/r1"), { lines: [{ month: "2026-11", amount: 1 }] }));
    await assertFails(updateDoc(doc(as(ADMIN), "receipts/r1"), { lines: [{ month: "2026-11", amount: 1 }] }));
    await assertFails(deleteDoc(doc(as(ADMIN), "receipts/r1")));
    await assertFails(updateDoc(doc(as(S1), "receipts/r1"), { void: { by: S1, at: "", reason: "mistake" } }));
    await assertFails(updateDoc(doc(as(ADMIN), "receipts/r1"), { void: { by: ADMIN, at: "", reason: "" } }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), "receipts/r1"), { void: { by: ADMIN, at: "", reason: "wrong student" } }));
    await assertFails(updateDoc(doc(as(ADMIN), "receipts/r1"), { void: null }));
  });
  it("after a transfer the new branch sees the student's old receipts and notes, and the old branch keeps its receipts", async () => {
    await assertFails(getDoc(doc(as(S2), "receipts/r1")));
    await assertFails(updateDoc(doc(as(S1), "receipts/r1"), { studentBranchId: "b2" }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), "receipts/r1"), { studentBranchId: "b2" }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), "notes/n1"), { branchId: "b2" }));
    await assertFails(updateDoc(doc(as(ADMIN), "notes/old"), { text: "rewritten" }));
    await assertSucceeds(getDoc(doc(as(S2), "receipts/r1")));
    await assertSucceeds(getDoc(doc(as(S1), "receipts/r1")));
    await assertSucceeds(getDoc(doc(as(S2), "notes/n1")));
    await assertFails(getDoc(doc(as(S1), "notes/n1")));
    await assertSucceeds(getDocs(query(collection(as(S2), "receipts"), where("studentBranchId", "==", "b2"))));
    await assertFails(getDocs(query(collection(as(S2), "receipts"), where("studentBranchId", "==", "b1"))));
  });
  it("receipt numbers go up one at a time, for the right branch", async () => {
    await assertSucceeds(updateDoc(doc(as(S1), "branches/b1"), { nextReceipt: 2 }));
    await assertFails(updateDoc(doc(as(S1), "branches/b1"), { nextReceipt: 1 }));
    await assertFails(updateDoc(doc(as(S1), "branches/b2"), { nextReceipt: 2 }));
    await assertFails(updateDoc(doc(as(S1), "branches/b1"), { prefix: "X" }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), "branches/b2"), { nextReceipt: 2 }));
  });
});

describe("notes, settings, staff, activity", () => {
  it("notes: add in own branch; delete own within 24 hours; admin any time", async () => {
    await assertSucceeds(setDoc(doc(as(S1), "notes/n2"), { id: "n2", branchId: "b1", by: S1, createdMs: Date.now(), text: "y" }));
    await assertFails(setDoc(doc(as(S1), "notes/n3"), { id: "n3", branchId: "b2", by: S1, createdMs: Date.now(), text: "y" }));
    await assertFails(setDoc(doc(as(S1), "notes/n4"), { id: "n4", branchId: "b1", by: ADMIN, createdMs: Date.now(), text: "y" }));
    await assertFails(updateDoc(doc(as(S1), "notes/n1"), { text: "edited" }));
    await assertFails(deleteDoc(doc(as(S1), "notes/old")));
    await assertSucceeds(deleteDoc(doc(as(S1), "notes/n1")));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), "notes/old")));
  });
  it("only admins change settings, classes, branches and staff", async () => {
    await assertFails(setDoc(doc(as(S1), "meta/settings"), { fees: [{ from: "2026-09", amount: 1 }] }));
    await assertSucceeds(setDoc(doc(as(ADMIN), "meta/settings"), { fees: [{ from: "2026-09", amount: 30 }] }));
    await assertFails(setDoc(doc(as(S1), "classes/c9"), { id: "c9", branchId: "b1" }));
    await assertSucceeds(setDoc(doc(as(ADMIN), "classes/c9"), { id: "c9", branchId: "b1" }));
    await assertFails(setDoc(doc(as(S1), "branches/b3"), { id: "b3" }));
    await assertFails(updateDoc(doc(as(S1), "users", S1), { role: "admin" }));
    await assertFails(setDoc(doc(as(S1), "users", "new@school.test"), { email: "new@school.test", role: "staff", branchId: "b1", active: true }));
    await assertSucceeds(setDoc(doc(as(ADMIN), "users", "new@school.test"), { email: "new@school.test", role: "staff", branchId: "b1", active: true }));
    await assertFails(setDoc(doc(as(ADMIN), "users", "x@school.test"), { email: "other@school.test", role: "staff", active: true }));
  });
  it("everyone writes to the activity log, only admins read it", async () => {
    await assertSucceeds(setDoc(doc(as(S1), "activity/a1"), { by: S1, action: "x" }));
    await assertFails(setDoc(doc(as(S1), "activity/a2"), { by: ADMIN, action: "x" }));
    await assertFails(getDocs(collection(as(S1), "activity")));
    await assertSucceeds(getDocs(collection(as(ADMIN), "activity")));
  });
});
