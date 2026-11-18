// The shared database: Firebase sign-in and Firestore. Loaded only when a
// Firebase project is configured. store.ts keeps the whole school in memory;
// this file keeps that copy in step with the server in both directions.
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as fbSignOut, User as FbUser,
} from "firebase/auth";
import {
  collection, connectFirestoreEmulator, doc, getDoc, initializeFirestore, limit, onSnapshot, orderBy, persistentLocalCache, persistentMultipleTabManager, query, Query, runTransaction, setDoc, where, writeBatch,
} from "firebase/firestore";
import { EMULATOR, firebaseConfig } from "./firebase-config";
import { Activity, addMonths, Branch, ClassRoom, DB, Note, Receipt, Role, Settings, Student, User } from "./logic";
import type { CloudStatus } from "./store";

export interface Hooks {
  setCloud(patch: Partial<CloudStatus>): void;
  patchDB(patch: Partial<DB>): void;
  enter(email: string, role: Role, branchId: string | null): void;
  leave(): void;
  notify(message: string): void;
}
type Result = Promise<string | null>;
export interface Backend {
  push(prev: DB, next: DB, skip: string[]): void;
  nextStudentNumber(): Promise<number>;
  issueReceipt(base: Omit<Receipt, "no">): Promise<string>;
  signIn(email: string, password: string): Result;
  register(email: string, password: string): Result;
  resetPassword(email: string): Result;
  resendVerification(): Result;
  recheckVerified(): Result;
  setupSchool(p: { name: string; fee: number; start: string; branch: string }): Result;
  signOut(): void;
}

const COLLECTIONS = ["students", "receipts", "notes", "classes", "users", "branches"] as const;

function explain(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "The email or password is wrong.",
    "auth/wrong-password": "The email or password is wrong.",
    "auth/user-not-found": "The email or password is wrong.",
    "auth/invalid-email": "That email address does not look right.",
    "auth/email-already-in-use": "This email already has a password. Use Sign in, or reset the password.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "No connection. Check the internet and try again.",
    "permission-denied": "You do not have permission to do that.",
    unavailable: "No connection. Check the internet and try again.",
  };
  return map[code] || (e as Error)?.message || "Something went wrong.";
}

export function startCloud(hooks: Hooks): Backend {
  const app = initializeApp(EMULATOR ? { apiKey: "demo", projectId: "demo-khalwa", authDomain: "demo-khalwa.firebaseapp.com" } : firebaseConfig);
  const auth = getAuth(app);
  // Keeps a copy on the device so lists still open when the connection drops.
  const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  if (EMULATOR) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(fs, "127.0.0.1", 8080);
  }

  let stops: (() => void)[] = [];
  const stopAll = () => {
    stops.forEach((s) => s());
    stops = [];
  };

  async function enter(user: FbUser) {
    const email = (user.email || "").toLowerCase();
    try {
      const owner = await getDoc(doc(fs, "meta/owner"));
      if (!owner.exists()) return hooks.setCloud({ phase: "setup", email });
      const mine = await getDoc(doc(fs, "users", email));
      const isOwner = owner.data().email === email;
      const me = mine.data() as User | undefined;
      if (!isOwner && (!me || !me.active)) return hooks.setCloud({ phase: "noAccess", email });
      if (isOwner && !me) await setDoc(doc(fs, "users", email), { id: email, email, name: email, role: "admin", branchId: null, active: true });
      const role: Role = isOwner ? "admin" : me!.role;
      subscribe(email, role, role === "admin" ? null : me!.branchId, isOwner);
    } catch (e) {
      hooks.notify(explain(e));
      hooks.setCloud({ phase: "signedOut", email: "" });
    }
  }

  function subscribe(email: string, role: Role, branchId: string | null, isOwner: boolean) {
    stopAll();
    const admin = role === "admin";
    const want = ["settings", "counters", "branches", "users", "classes", "students", "receipts", "notes"];
    const loaded = new Set<string>();
    let ready = false;
    const done = (k: string) => {
      loaded.add(k);
      if (!ready && want.every((w) => loaded.has(w))) {
        ready = true;
        hooks.enter(email, role, branchId);
        hooks.setCloud({ phase: "ready", email });
      }
    };
    const fail = (e: unknown) => {
      // Access was taken away while signed in (deactivated, or moved branch): start again so the
      // sign-in checks run afresh. The time check stops this ever becoming a reload loop.
      const last = Number(sessionStorage.getItem("khalwa-denied") || 0);
      if ((e as { code?: string })?.code === "permission-denied" && Date.now() - last > 30000) {
        sessionStorage.setItem("khalwa-denied", String(Date.now()));
        return window.location.reload();
      }
      hooks.notify("Could not load data. " + explain(e));
    };
    const scoped = (name: string): Query => (admin ? collection(fs, name) : query(collection(fs, name), where("branchId", "==", branchId)));

    stops.push(onSnapshot(doc(fs, "meta/settings"), (s) => { if (s.exists()) hooks.patchDB({ settings: s.data() as Settings }); done("settings"); }, fail));
    stops.push(onSnapshot(doc(fs, "meta/counters"), (s) => { if (s.exists()) hooks.patchDB({ seq: { student: s.data().student } }); done("counters"); }, fail));
    stops.push(onSnapshot(collection(fs, "branches"), (s) => { hooks.patchDB({ branches: s.docs.map((d) => d.data() as Branch).sort((a, b) => a.id.localeCompare(b.id)) }); done("branches"); }, fail));
    stops.push(onSnapshot(collection(fs, "users"), (s) => {
      const users = s.docs.map((d) => d.data() as User).sort((a, b) => a.name.localeCompare(b.name));
      const me = users.find((u) => u.id === email);
      // If an admin deactivates this account or changes its role or branch, start again with the new access.
      if (ready && !isOwner && (!me || !me.active || me.role !== role || (me.role === "staff" && me.branchId !== branchId))) return window.location.reload();
      hooks.patchDB({ users });
      done("users");
    }, fail));
    stops.push(onSnapshot(scoped("classes"), (s) => { hooks.patchDB({ classes: s.docs.map((d) => d.data() as ClassRoom) }); done("classes"); }, fail));
    stops.push(onSnapshot(scoped("students"), (s) => { hooks.patchDB({ students: s.docs.map((d) => d.data() as Student) }); done("students"); }, fail));
    stops.push(onSnapshot(scoped("notes"), (s) => { hooks.patchDB({ notes: s.docs.map((d) => d.data() as Note) }); done("notes"); }, fail));

    const byDate = (a: Receipt, b: Receipt) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.no.localeCompare(b.no));
    if (admin) {
      stops.push(onSnapshot(collection(fs, "receipts"), (s) => { hooks.patchDB({ receipts: s.docs.map((d) => d.data() as Receipt).sort(byDate) }); done("receipts"); }, fail));
      stops.push(onSnapshot(query(collection(fs, "activity"), orderBy("at", "desc"), limit(200)), (s) => hooks.patchDB({ activity: s.docs.map((d) => d.data() as Activity) }), fail));
    } else {
      // Staff see receipts their branch took, plus receipts for students who have since transferred in.
      const parts: Receipt[][] = [[], []];
      const got = [false, false];
      const merge = (i: number, rows: Receipt[]) => {
        parts[i] = rows;
        got[i] = true;
        const all = new Map<string, Receipt>();
        parts.flat().forEach((r) => all.set(r.id, r));
        hooks.patchDB({ receipts: [...all.values()].sort(byDate) });
        if (got[0] && got[1]) done("receipts");
      };
      stops.push(onSnapshot(query(collection(fs, "receipts"), where("branchId", "==", branchId)), (s) => merge(0, s.docs.map((d) => d.data() as Receipt)), fail));
      stops.push(onSnapshot(query(collection(fs, "receipts"), where("studentBranchId", "==", branchId)), (s) => merge(1, s.docs.map((d) => d.data() as Receipt)), fail));
    }
  }

  onAuthStateChanged(auth, (user) => {
    stopAll();
    if (!user) {
      hooks.leave();
      return hooks.setCloud({ phase: "signedOut", email: "" });
    }
    const email = (user.email || "").toLowerCase();
    if (!user.emailVerified) return hooks.setCloud({ phase: "unverified", email });
    hooks.setCloud({ phase: "loading", email });
    enter(user);
  });

  const attempt = async (fn: () => Promise<unknown>): Result => {
    try {
      await fn();
      return null;
    } catch (e) {
      return explain(e);
    }
  };

  return {
    /** Send whatever changed between two copies of the school to the server, as one batch. */
    push(prev, next, skip) {
      const batch = writeBatch(fs);
      let n = 0;
      for (const name of COLLECTIONS) {
        if (skip.includes(name)) continue;
        const before = new Map((prev[name] as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
        for (const row of next[name] as { id: string }[]) {
          if (before.get(row.id) !== JSON.stringify(row)) {
            batch.set(doc(fs, name, row.id), row);
            n++;
          }
          before.delete(row.id);
        }
        // Notes are the only records that can be removed.
        if (name === "notes") for (const id of before.keys()) { batch.delete(doc(fs, name, id)); n++; }
      }
      const known = new Set(prev.activity.map((a) => a.id));
      for (const a of next.activity) if (!known.has(a.id)) { batch.set(doc(fs, "activity", a.id), a); n++; }
      if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) { batch.set(doc(fs, "meta/settings"), next.settings); n++; }
      // If the server refuses, Firestore rolls the local copy back by itself; tell the person why.
      if (n) batch.commit().catch((e) => hooks.notify("Not saved. " + explain(e)));
    },

    async nextStudentNumber() {
      try {
        return await runTransaction(fs, async (tx) => {
          const ref = doc(fs, "meta/counters");
          const n = (await tx.get(ref)).data()?.student as number;
          tx.update(ref, { student: n + 1 });
          return n;
        });
      } catch (e) {
        throw new Error("Registering a student needs a connection. " + explain(e));
      }
    },

    async issueReceipt(base) {
      try {
        return await runTransaction(fs, async (tx) => {
          const ref = doc(fs, "branches", base.branchId);
          const b = (await tx.get(ref)).data() as Branch;
          const no = `${b.prefix}-${String(b.nextReceipt).padStart(4, "0")}`;
          tx.update(ref, { nextReceipt: b.nextReceipt + 1 });
          tx.set(doc(fs, "receipts", base.id), { ...base, no });
          return no;
        });
      } catch (e) {
        throw new Error("Recording a payment needs a connection, so the receipt number is unique. " + explain(e));
      }
    },

    signIn: (email, password) => attempt(() => signInWithEmailAndPassword(auth, email.trim(), password)),
    register: (email, password) =>
      attempt(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
      }),
    resetPassword: (email) => attempt(() => sendPasswordResetEmail(auth, email.trim())),
    resendVerification: () => attempt(async () => { if (auth.currentUser) await sendEmailVerification(auth.currentUser); }),
    async recheckVerified() {
      const user = auth.currentUser;
      if (!user) return "Sign in again.";
      try {
        await user.reload();
        if (!user.emailVerified) return "Not verified yet. Open the link in the email we sent, then try again.";
        await user.getIdToken(true); // the server only trusts a fresh token
        hooks.setCloud({ phase: "loading" });
        await enter(user);
        return null;
      } catch (e) {
        return explain(e);
      }
    },

    async setupSchool({ name, fee, start, branch }) {
      const user = auth.currentUser;
      if (!user?.email) return "Sign in again.";
      const email = user.email.toLowerCase();
      try {
        // Claiming the school comes first: the rules make everything else depend on it.
        await setDoc(doc(fs, "meta/owner"), { email, at: new Date().toISOString() });
        const settings: Settings = {
          school: { name: "Khalwa with Qur'an", nameAr: "خلوة مع القرآن", address: "", phone: "", currency: "GBP" },
          fees: [{ from: start, amount: fee }],
          year: { start, end: addMonths(start, 9), noFee: [] },
          receipt: { footer: "جزاكم الله خيراً", paper: "A5" },
          lastBackup: null,
        };
        const batch = writeBatch(fs);
        batch.set(doc(fs, "users", email), { id: email, email, name, role: "admin", branchId: null, active: true });
        batch.set(doc(fs, "meta/settings"), settings);
        batch.set(doc(fs, "meta/counters"), { student: 1001 });
        batch.set(doc(fs, "branches/b1"), { id: "b1", name: branch || "Manchester", address: "", prefix: "MAN", active: true, nextReceipt: 1 });
        batch.set(doc(fs, "branches/b2"), { id: "b2", name: branch.trim().toLowerCase() === "london" ? "Manchester" : "London", address: "", prefix: branch.trim().toLowerCase() === "london" ? "MAN" : "LDN", active: false, nextReceipt: 1 });
        await batch.commit();
        hooks.setCloud({ phase: "loading" });
        await enter(user);
        return null;
      } catch (e) {
        // Someone else got there first, or the connection dropped: re-read where we stand.
        await enter(user);
        return explain(e);
      }
    },

    signOut: () => void fbSignOut(auth),
  };
}
