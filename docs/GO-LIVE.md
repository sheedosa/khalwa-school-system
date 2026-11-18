# Going live: connecting the shared database

Until this is done the site runs in test mode: sample data, saved only in each browser.
After it, everyone signs in with their own email and password and sees the same records,
on any device. It takes about fifteen minutes and costs nothing.

Do these steps signed in to Google with **an account the school controls**, so the school
owns its data. You can add yourself as a second owner afterwards (Project settings, Users
and permissions).

## 1. Create the Firebase project

1. Open <https://console.firebase.google.com> and choose **Create a project** (or "Add project").
2. Name it, for example `khalwa-school`.
3. Turn Google Analytics **off**. It is not needed.
4. Stay on the free **Spark** plan. Do not add a billing account; without one it cannot charge anything.

## 2. Turn on sign-in

1. In the left menu: **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable → Save**. Leave "Email link" off.
3. **Settings → Authorised domains → Add domain** and add: `sheedosa.github.io`

## 3. Create the database, in London

1. **Build → Firestore Database → Create database**.
2. Location: **`europe-west2 (London)`**. This keeps the records in the UK and **cannot be changed later**.
3. Choose **Start in production mode**, then **Create**.

## 4. Put the access rules in place

The rules decide who can read and change what. Without them nobody can use the system; with the wrong ones, too many people can.

1. Still in Firestore, open the **Rules** tab.
2. Delete everything in the editor.
3. Open [`firestore.rules`](../firestore.rules) in this repository, copy all of it, paste it in.
4. Press **Publish**.

## 5. Connect the site to the project

1. Click the gear icon → **Project settings → General**. Under **Your apps** press the web icon `</>`.
2. Give it a nickname (for example `khalwa-web`). Leave "Firebase Hosting" unticked. Press **Register app**.
3. You are shown a block that starts `const firebaseConfig = {`. Keep this page open.
4. On GitHub, open [`src/firebase-config.ts`](../src/firebase-config.ts), press the pencil icon, and fill in the six values between the quotes from that block.
5. Press **Commit changes** (to `main`). The live site updates by itself in about a minute.

These six values are not passwords. They only tell the site which project to talk to, and they are visible to anyone who opens the site, in every Firebase app. What protects the records is step 4. GitHub may email a "secret detected" warning about the `apiKey`; for a Firebase web key that is expected.

## 6. Claim the school (do this straight away)

**The first person to finish this step becomes the owner**, so do it as soon as step 5 is live.

1. Open the site: <https://sheedosa.github.io/khalwa-school-system/>
2. Choose **First time here**, enter your email and a password.
3. Open the confirmation link that arrives by email (check spam), then press **I have opened the link**.
4. Fill in **Set up the school**: your name, the first branch's name, the monthly fee in pounds, and the month the school year starts.

You are now the owner and an admin. Check the address in Firestore under `meta → owner` is yours.

## 7. Add classes and staff

1. **Classes → Add class** for each group.
2. **Settings → Staff accounts → Add**: the person's name, the email they will use, their role and branch.
3. Tell each person to open the site, choose **First time here**, and create a password using that same email. They confirm it from the link they are sent, and they are in.

Someone whose email has not been added can create a password but sees nothing. Deactivating a person in Staff accounts locks them out immediately.

## Good to know

- **Test data does not carry over.** The shared database starts empty.
- **Second branch.** It is created switched off. Turn it on in Settings → Branches when it starts.
- **Backups.** The free plan has no automatic backups. An admin should use Settings → Backup and data → Download backup each month; the dashboard reminds them.
- **Taking payments needs a connection**, because each receipt number is reserved on the server. Lists already opened stay readable offline.
- **Free plan limits** are 50,000 reads and 20,000 writes a day and 1 GiB of storage. Each device loads the school's records when it opens, so a school of a few hundred students stays well inside this. If usage ever hits the limit, the system pauses until the next day rather than charging.
- **Emails** (confirmation, password reset) come from `noreply@<your-project>.firebaseapp.com`. You can change the sender name and wording under Authentication → Templates.
- **Optional hardening.** In Google Cloud Console → APIs & Services → Credentials, open the "Browser key" and restrict it to the websites `https://sheedosa.github.io/*` and `https://<your-project>.firebaseapp.com/*`.
- **Data protection.** The school holds children's records, so it should cover this system in its privacy notice. That is the school's decision to take with whoever advises it.

## Going back to test mode

Empty the six values in `src/firebase-config.ts` again and commit. Nothing in the database is deleted.
