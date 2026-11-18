// Going live: paste the school's Firebase web app settings here (docs/GO-LIVE.md
// explains where to find them). While projectId is empty the app stays in test
// mode, keeping sample data in the browser.
//
// These values are not passwords. They only say which Firebase project to talk
// to; what each person may read or change is decided by firestore.rules.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// `npm run dev:cloud` runs against the local Firebase emulators instead.
export const EMULATOR = import.meta.env?.VITE_EMULATOR === "1";
export const CLOUD = EMULATOR || !!firebaseConfig.projectId;
