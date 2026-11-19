// js/profile.js
import { auth } from "./firebase-init.js";
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { requireAuth } from "./guards.js";
import { mountLayout, initials } from "./navigation.js";
import { validatePassword, validatePasswordConfirmation } from "./validators.js";
import { escapeHtml, formatDate, setBusy, toast, friendlyAuthError } from "./utils.js";

const { user, profile } = await requireAuth({}); // any authenticated role

const { main } = mountLayout({
  active: "profile",
  profile,
  title: "My Profile",
  subtitle: "Manage your account information"
});

main.innerHTML = `
  <div class="profile-grid">
    <section class="card">
      <div class="profile-card__head">
        <div class="profile-card__avatar">${escapeHtml(initials(profile.fullName))}</div>
        <div>
          <h2 style="margin:0 0 4px;">${escapeHtml(profile.fullName)}</h2>
          <p class="text-muted" style="margin:0;font-size:.88rem;">
            ${escapeHtml(profile.role)}${profile.programme ? ` • ${escapeHtml(profile.programme)}` : ""}
          </p>
        </div>
      </div>
      <div class="info-list">
        <div class="info-list__row"><span class="info-list__label">Email</span><span class="info-list__value">${escapeHtml(profile.email)}</span></div>
        ${profile.studentNumber ? `<div class="info-list__row"><span class="info-list__label">Student number</span><span class="info-list__value">${escapeHtml(profile.studentNumber)}</span></div>` : ""}
        ${profile.programme ? `<div class="info-list__row"><span class="info-list__label">Programme</span><span class="info-list__value">${escapeHtml(profile.programme)}</span></div>` : ""}
        ${profile.academicYear ? `<div class="info-list__row"><span class="info-list__label">Academic year</span><span class="info-list__value">${escapeHtml(profile.academicYear)}</span></div>` : ""}
        <div class="info-list__row"><span class="info-list__label">Email verified</span><span class="info-list__value">${user.emailVerified ? "Yes" : "No"}</span></div>
        <div class="info-list__row"><span class="info-list__label">Member since</span><span class="info-list__value">${formatDate(profile.createdAt)}</span></div>
      </div>
    </section>

    <section class="card">
      <h2 style="margin-top:0;">Change password</h2>
      <p class="text-muted" style="font-size:.88rem;margin-bottom:16px;">
        Enter your current password to set a new one.
      </p>
      <div id="pwBanner" class="auth-banner" role="alert"></div>
      <form id="pwForm" novalidate>
        <div class="form-field">
          <label for="currentPw">Current password</label>
          <div class="password-wrap">
            <input type="password" id="currentPw" autocomplete="current-password" required>
            <button type="button" class="password-toggle" data-toggle-password="currentPw" aria-label="Show password">
              <i data-lucide="eye"></i>
            </button>
          </div>
        </div>
        <div class="form-field">
          <label for="newPw">New password</label>
          <div class="password-wrap">
            <input type="password" id="newPw" autocomplete="new-password" required>
            <button type="button" class="password-toggle" data-toggle-password="newPw" aria-label="Show password">
              <i data-lucide="eye"></i>
            </button>
          </div>
          <p class="field-error" id="newPwError"></p>
        </div>
        <div class="form-field">
          <label for="confirmPw">Confirm new password</label>
          <input type="password" id="confirmPw" autocomplete="new-password" required>
          <p class="field-error" id="confirmPwError"></p>
        </div>
        <button type="submit" class="btn btn-primary" id="pwSubmit">
          <i data-lucide="key-round"></i> Update password
        </button>
      </form>
    </section>
  </div>`;
if (window.lucide) lucide.createIcons();

// Show/hide toggles
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

const form = document.getElementById("pwForm");
const banner = document.getElementById("pwBanner");
const submitBtn = document.getElementById("pwSubmit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  banner.className = "auth-banner";
  document.getElementById("newPwError").textContent = "";
  document.getElementById("confirmPwError").textContent = "";

  const current = document.getElementById("currentPw").value;
  const next = document.getElementById("newPw").value;
  const confirm = document.getElementById("confirmPw").value;

  if (!current) { toast("Enter your current password.", "error"); return; }
  const pwCheck = validatePassword(next);
  const confirmCheck = validatePasswordConfirmation(next, confirm);
  if (!pwCheck.ok) { document.getElementById("newPwError").textContent = pwCheck.message; return; }
  if (!confirmCheck.ok) { document.getElementById("confirmPwError").textContent = confirmCheck.message; return; }

  setBusy(submitBtn, true, "Updating…");
  try {
    const cred = EmailAuthProvider.credential(user.email, current);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, next);
    toast("Password updated.", "success");
    form.reset();
  } catch (err) {
    console.error(err);
    banner.textContent = friendlyAuthError(err.code);
    banner.className = "auth-banner auth-banner-error show";
  } finally {
    setBusy(submitBtn, false);
  }
});