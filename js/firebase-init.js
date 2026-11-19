// js/firebase-init.js
// Firebase initialisation (Authentication + Realtime Database only).
// Storage has been replaced by Cloudflare R2 via the Worker in js/r2-config.js.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

if (!firebaseConfig?.apiKey || firebaseConfig.apiKey.startsWith("PASTE_")) {
  throw new Error(
    "Firebase is not configured.\n" +
    "→ Copy js/firebase-config.example.js to js/firebase-config.js\n" +
    "→ Fill in your Firebase project values\n" +
    "→ Reload the page. See README.md for full setup steps."
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export { app };