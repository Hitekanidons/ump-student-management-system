// js/validators.js
// Validation rules for UMP student registration.
//
// Email format: XXXXXXXXX@ump.ac.za  (nine digits + @ump.ac.za)
// The nine digits must match the student number entered on the form.

export const STUDENT_NUMBER_REGEX = /^\d{9}$/;
export const UMP_EMAIL_REGEX = /^(\d{9})@ump\.ac\.za$/;

export function validateStudentNumber(value) {
  if (!value) return { ok: false, message: "Student number is required." };
  if (!STUDENT_NUMBER_REGEX.test(value))
    return { ok: false, message: "Student number must be exactly 9 digits." };
  return { ok: true };
}

export function validateUmpEmail(email, studentNumber) {
  if (!email) return { ok: false, message: "Email is required." };
  const match = email.trim().toLowerCase().match(UMP_EMAIL_REGEX);
  if (!match)
    return {
      ok: false,
      message: "Use your UMP student email in the format 123456789@ump.ac.za."
    };
  const emailNumber = match[1];
  if (studentNumber && emailNumber !== studentNumber.trim())
    return {
      ok: false,
      message: "The email's student number does not match the student number above."
    };
  return { ok: true };
}

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "upper", label: "One uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter (a–z)", test: (v) => /[a-z]/.test(v) },
  { id: "number", label: "One number (0–9)", test: (v) => /\d/.test(v) },
  { id: "special", label: "One special character (!@#$…)", test: (v) => /[^A-Za-z0-9]/.test(v) }
];

export function validatePassword(value) {
  const failed = PASSWORD_RULES.filter((r) => !r.test(value || ""));
  if (failed.length === 0) return { ok: true };
  return { ok: false, message: "Password does not meet all requirements.", failed };
}

export function validatePasswordConfirmation(pw, confirm) {
  if (!confirm) return { ok: false, message: "Please confirm your password." };
  if (pw !== confirm) return { ok: false, message: "Passwords do not match." };
  return { ok: true };
}

export function validateFullName(value) {
  const v = (value || "").trim();
  if (v.length < 2) return { ok: false, message: "Please enter your full name." };
  if (!/^[A-Za-z][A-Za-z '\-]{1,}$/.test(v))
    return { ok: false, message: "Name can only contain letters, spaces, hyphens and apostrophes." };
  return { ok: true };
}