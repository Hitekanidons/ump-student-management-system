// js/auth.js
// Shared authentication helpers: fetch profile, logout, password reset.

import { auth, db } from "./firebase-init.js";
import {
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export async function fetchUserProfile(uid) {
  if (!uid) return null;
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? { uid, ...snap.val() } : null;
}

export async function logout(redirectTo = "login.html") {
  try { await signOut(auth); } catch (e) { console.error(e); }
  window.location.href = redirectTo;
}

export async function sendReset(email) {
  await sendPasswordResetEmail(auth, email);
}