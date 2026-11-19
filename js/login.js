// js/login.js
import { auth } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { fetchUserProfile } from "./auth.js";
import { $, setBusy, friendlyAuthError } from "./utils.js";

const form = $("#loginForm");
const emailEl = $("#email");
const passwordEl = $("#password");
const rememberEl = $("#rememberMe");
const submitBtn = $("#submitBtn");
const banner = $("#loginBanner");
const emailError = $("#emailError");
const passwordError = $("#passwordError");

// Show "account disabled" message if redirected from a guard
const params = new URLSearchParams(window.location.search);
if (params.get("disabled")) {
  banner.textContent = "Your account has been disabled. Please contact your lecturer or administrator.";
  banner.className = "auth-banner auth-banner-error show";
}

// Show / hide password
document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-toggle-password");
    const input = document.getElementById(id);
    if (!input) return;
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  banner.className = "auth-banner";
  emailError.textContent = "";
  passwordError.textContent = "";

  const email = emailEl.value.trim().toLowerCase();
  const password = passwordEl.value;

  let invalid = false;
  if (!email) { emailError.textContent = "Email is required."; invalid = true; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailError.textContent = "Enter a valid email address.";
    invalid = true;
  }
  if (!password) { passwordError.textContent = "Password is required."; invalid = true; }
  if (invalid) return;

  setBusy(submitBtn, true, "Signing in…");
  try {
    // Remember-me → localStorage persistence; otherwise session persistence.
    const persistence = rememberEl.checked
      ? browserLocalPersistence
      : browserSessionPersistence;
    await setPersistence(auth, persistence);

    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    if (!user.emailVerified) {
      window.location.replace("verify-email.html");
      return;
    }

    const profile = await fetchUserProfile(user.uid);
    if (!profile) {
      banner.textContent = "Your account profile is missing. Please contact an administrator.";
      banner.className = "auth-banner auth-banner-error show";
      setBusy(submitBtn, false);
      return;
    }

    if (profile.accountStatus && profile.accountStatus !== "active") {
      banner.textContent = "This account has been disabled. Please contact an administrator.";
      banner.className = "auth-banner auth-banner-error show";
      await auth.signOut();
      setBusy(submitBtn, false);
      return;
    }

    const target = `${profile.role}-dashboard.html`;
    window.location.replace(target);
  } catch (err) {
    console.error(err);
    banner.textContent = friendlyAuthError(err.code);
    banner.className = "auth-banner auth-banner-error show";
    setBusy(submitBtn, false);
  }
});