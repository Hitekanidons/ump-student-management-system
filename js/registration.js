// js/registration.js
import { auth, db } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  validateFullName,
  validateStudentNumber,
  validateUmpEmail,
  validatePassword,
  validatePasswordConfirmation,
  PASSWORD_RULES
} from "./validators.js";
import { $, $$, setBusy, friendlyAuthError } from "./utils.js";

const form = $("#registerForm");
const fullNameEl = $("#fullName");
const studentNumberEl = $("#studentNumber");
const emailEl = $("#email");
const passwordEl = $("#password");
const confirmEl = $("#confirmPassword");
const submitBtn = $("#submitBtn");
const banner = $("#formBanner");
const rulesList = $("#passwordRules");

const err = {
  fullName: $("#fullNameError"),
  studentNumber: $("#studentNumberError"),
  email: $("#emailError"),
  password: $("#passwordError"),
  confirmPassword: $("#confirmPasswordError")
};

function setFieldError(field, message) {
  if (!err[field]) return;
  err[field].textContent = message || "";
  const input = form.querySelector(`[name="${field}"]`);
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearBanner() {
  banner.className = "auth-banner auth-banner-error";
  banner.textContent = "";
}

function showBanner(message) {
  banner.textContent = message;
  banner.className = "auth-banner auth-banner-error show";
}

// ── Live password rules checklist ──────────────────────────
function updatePasswordRules() {
  const v = passwordEl.value;
  PASSWORD_RULES.forEach((rule) => {
    const li = rulesList.querySelector(`[data-rule="${rule.id}"]`);
    if (!li) return;
    li.classList.toggle("ok", rule.test(v));
  });
}

// ── Live field validators ─────────────────────────────────
function checkStudentNumberField() {
  const r = validateStudentNumber(studentNumberEl.value.trim());
  setFieldError("studentNumber", r.ok ? "" : r.message);
  return r.ok;
}
function checkEmailField() {
  const r = validateUmpEmail(emailEl.value.trim(), studentNumberEl.value.trim());
  setFieldError("email", r.ok ? "" : r.message);
  return r.ok;
}
function checkPasswordField() {
  const r = validatePassword(passwordEl.value);
  setFieldError("password", r.ok ? "" : r.message);
  return r.ok;
}
function checkConfirmField() {
  const r = validatePasswordConfirmation(passwordEl.value, confirmEl.value);
  setFieldError("confirmPassword", r.ok ? "" : r.message);
  return r.ok;
}

studentNumberEl.addEventListener("input", () => {
  studentNumberEl.value = studentNumberEl.value.replace(/\D/g, "").slice(0, 9);
  checkStudentNumberField();
  if (emailEl.value.trim()) checkEmailField();
});
emailEl.addEventListener("blur", checkEmailField);
passwordEl.addEventListener("input", () => {
  updatePasswordRules();
  checkPasswordField();
  if (confirmEl.value) checkConfirmField();
});
confirmEl.addEventListener("input", checkConfirmField);

// ── Show / hide password buttons ───────────────────────────
$$("[data-toggle-password]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-toggle-password");
    const input = document.getElementById(id);
    if (!input) return;
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });
});

// ── Submit ────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearBanner();

  const fullName = fullNameEl.value.trim();
  const studentNumber = studentNumberEl.value.trim();
  const email = emailEl.value.trim().toLowerCase();

  const nameCheck = validateFullName(fullName);
  const numberCheck = validateStudentNumber(studentNumber);
  const emailCheck = validateUmpEmail(email, studentNumber);
  const pwCheck = validatePassword(passwordEl.value);
  const confirmCheck = validatePasswordConfirmation(passwordEl.value, confirmEl.value);

  setFieldError("fullName", nameCheck.ok ? "" : nameCheck.message);
  setFieldError("studentNumber", numberCheck.ok ? "" : numberCheck.message);
  setFieldError("email", emailCheck.ok ? "" : emailCheck.message);
  setFieldError("password", pwCheck.ok ? "" : pwCheck.message);
  setFieldError("confirmPassword", confirmCheck.ok ? "" : confirmCheck.message);

  if (![nameCheck, numberCheck, emailCheck, pwCheck, confirmCheck].every((c) => c.ok)) {
    showBanner("Please fix the highlighted fields and try again.");
    return;
  }

  setBusy(submitBtn, true, "Creating your account…");
  let createdUser = null;

  try {
    // 1. Create the Auth user
    const credential = await createUserWithEmailAndPassword(auth, email, passwordEl.value);
    createdUser = credential.user;

    // 2. Set the display name on the Auth record
    await updateProfile(createdUser, { displayName: fullName });

    // 3. Write the profile to Realtime Database (rules allow one-time creation only)
    await set(ref(db, `users/${createdUser.uid}`), {
      fullName,
      studentNumber,
      email,
      role: "student",
      programme: "BICT",
      academicYear: "First Year",
      accountStatus: "active",
      emailVerified: false,
      createdAt: serverTimestamp()
    });

    // 4. Send verification email
    await sendEmailVerification(createdUser);

    // 5. Redirect to the verification page
    window.location.replace("verify-email.html");
  } catch (error) {
    console.error(error);

    // If we created the auth user but the DB write failed, clean up the auth
    // record so the user can retry registration rather than being stranded.
    if (createdUser && (error.code === "PERMISSION_DENIED" || !error.code)) {
      try { await createdUser.delete(); } catch { /* ignore */ }
    }

    if (error.code === "PERMISSION_DENIED") {
      showBanner("Account could not be finalised: database permission denied. " +
                 "Please ensure Firebase Database Rules are deployed (see firebase/database.rules.json).");
    } else {
      showBanner(friendlyAuthError(error.code));
    }
    setBusy(submitBtn, false);
  }
});