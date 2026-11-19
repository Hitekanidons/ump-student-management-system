// js/guards.js
// Route guards — call these at the top of any protected page's module.
//
// Usage (top-level await in an ES module):
//   const { user, profile } = await requireAuth({ role: "student" });

import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { fetchUserProfile } from "./auth.js";

export async function requireAuth({ role, redirectTo = "login.html" } = {}) {
  const { user } = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => { unsub(); resolve({ user: u }); },
      (err) => { unsub(); reject(err); }
    );
  });

  if (!user) {
    window.location.replace(redirectTo);
    return new Promise(() => {}); // never resolves — page is navigating away
  }

  if (!user.emailVerified) {
    window.location.replace("verify-email.html");
    return new Promise(() => {});
  }

  const profile = await fetchUserProfile(user.uid);

  if (!profile) {
    await auth.signOut();
    window.location.replace("login.html");
    return new Promise(() => {});
  }

  if (profile.accountStatus && profile.accountStatus !== "active") {
    await auth.signOut();
    window.location.replace("login.html?disabled=1");
    return new Promise(() => {});
  }

  if (role && profile.role !== role) {
    const target = `${profile.role}-dashboard.html`;
    window.location.replace(target);
    return new Promise(() => {});
  }

  return { user, profile };
}