# Khalwa with Qur'an: school system

Student registration and monthly fee tracking for the Khalwa with Qur'an school, across two branches.

**Status:** the live link runs in test mode, with sample students saved only in each browser, until a Firebase project is connected. Once it is, everyone signs in with email and password and shares one database. The steps are in [docs/GO-LIVE.md](docs/GO-LIVE.md).

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
npm run dev          # test mode, sample data in the browser
npm run dev:cloud    # real sign-in and shared data, against local Firebase emulators (needs Java)
```

- `npm test` runs the fee calculation tests.
- `npm run test:rules` runs the access-rule tests on the Firestore emulator (needs Java).
- `npm run build` type-checks and builds to `dist/`.

## How it is put together

- `src/logic.ts`: types and the fee rules (what is charged, paid and owed). Pure functions, covered by `src/logic.test.ts`.
- `src/store.ts`: every read and write the screens make. Keeps the school's records in memory; saves to local storage in test mode.
- `src/cloud.ts`: sign-in and the shared database (Firebase Auth and Firestore). Loaded only when `src/firebase-config.ts` is filled in.
- `firestore.rules`: who may read and change what, enforced by the database. Covered by `tests/rules.test.ts`.
- `src/pages/`: one file per screen. `src/ui.tsx`: shared pieces. `src/styles.css`: the theme, from the school's logo.

## Publishing

Every push to `main` builds the site and puts it on the `gh-pages` branch (`.github/workflows/deploy.yml`). In the repository settings, Pages must be set to deploy from the `gh-pages` branch, root folder.
