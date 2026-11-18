# Khalwa with Qur'an: school system

Student registration and monthly fee tracking for the Khalwa with Qur'an school, across two branches.

**Status: test version.** It runs entirely in the browser with sample students so the school can try every screen. Data is saved on the device that entered it and is not shared between devices yet. Shared data and real logins come in the next step (Firebase, free plan).

## What it does

- Register students, edit, transfer between branches, mark as left
- One flat monthly fee with waivers, exempt months and no-fee months
- Collect payments (cash or transfer), numbered receipts per branch, print and share, void with a reason
- Monthly sheet: every student against every month
- Notes per student: payment, Qur'an progress, behaviour and attendance
- Reports: monthly collection, owed list, student statement, enrollment (print and export to Excel as CSV)
- Admin and staff roles; staff see only their branch
- Settings: school, fee history, academic year, branches, staff, receipts, backup, activity log
- Works as a home-screen app on phones and as a full desktop system

## Run it locally

```
npm install
npm run dev
```

`npm test` runs the fee calculation tests. `npm run build` type-checks and builds to `dist/`.

## How it is put together

- `src/logic.ts`: types and the fee rules (what is charged, paid and owed). Pure functions, covered by `src/logic.test.ts`.
- `src/store.ts`: all reads and writes. Uses local storage today; this is the one file to replace when moving to Firebase.
- `src/pages/`: one file per screen.
- `src/ui.tsx`: shared pieces (page frame, dialogs, router, icons).
- `src/styles.css`: the theme, taken from the school's logo.

## Publishing

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). In the repository settings, Pages must have its source set to "GitHub Actions".
