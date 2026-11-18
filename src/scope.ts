import { useMemo } from "react";
import { currentUser, nowMonth, today, useApp, viewBranches } from "./store";

/** What the signed-in user is looking at: their branches and the records in them. */
export function useScope() {
  const app = useApp();
  const user = currentUser(app)!;
  const key = viewBranches(app).join(",");
  return useMemo(() => {
    const branchIds = key ? key.split(",") : [];
    const db = app.db;
    return {
      db,
      user,
      admin: user.role === "admin",
      branchIds,
      multi: branchIds.length > 1,
      students: db.students.filter((s) => branchIds.includes(s.branchId)),
      receipts: db.receipts.filter((r) => branchIds.includes(r.branchId)),
      classes: db.classes.filter((c) => branchIds.includes(c.branchId)),
      now: nowMonth(),
      today: today(),
      cur: db.settings.school.currency,
    };
  }, [app.db, user, key]);
}
