# UMP BICT Student Learning & Resource-Sharing Platform

A modern, responsive academic resource-sharing platform for **University of Mpumalanga (UMP)**
**Bachelor of Information and Communication Technology (BICT)** first-year students.

Built with **HTML5 + CSS3 + Vanilla JavaScript (ES6 modules)** and **Firebase**
(Authentication, Realtime Database, Storage).

---

## 1. Firebase setup (required)

### 1.1 Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** → name it (e.g. `ump-bict-platform`).
2. Disable Google Analytics (optional) → **Create project**.

### 1.2 Enable the three Firebase services
- **Authentication** → *Sign-in method* → enable **Email/Password**.
- **Realtime Database** → *Create database* → start in **locked mode**.
- **Storage** → *Get started* → start in **production mode**.

### 1.3 Register a Web App & copy config
- Project Overview → ⚙️ **Project settings** → **Your apps** → **Web** (`</>`).
- Register the app (e.g. `ump-bict-web`), **do not** enable Hosting yet.
- Copy the `firebaseConfig` object.

### 1.4 Paste config into `js/firebase-config.js`
Open `js/firebase-config.js` and replace every `PASTE_…` value:

```js
export const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "ump-bict-platform.firebaseapp.com",
  databaseURL: "https://ump-bict-platform-default-rtdb.<region>.firebasedatabase.app",
  projectId: "ump-bict-platform",
  storageBucket: "ump-bict-platform.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef…"
};
```

> `databaseURL` must be the **Realtime Database URL**, not Firestore.
> Find it in **Realtime Database → Data** tab at the top.

### 1.5 Deploy the security rules
Install the Firebase CLI (`npm i -g firebase-tools`), then from the project root:

```bash
firebase login
firebase init            # choose Realtime Database + Storage, keep existing files
firebase deploy --only database,storage
```

Or paste `firebase/database.rules.json` and `firebase/storage.rules` directly
into the **Rules** tabs of the Firebase Console.

### 1.6 Configure email verification sender (optional but recommended)
- Authentication → **Templates** → *Email address verification*.
- Set **From name** to `UMP BICT Platform`, keep sender as `noreply@…firebaseapp.com`,
  or add your own SMTP provider if you have one.

### 1.7 First lecturer + first administrator
Public registration is **student-only**. To create the first lecturer/admin:

**Lecturer** (recommended path once admin dashboard exists):
- Create the Auth user in **Authentication → Users → Add user** (email + password).
- In **Realtime Database → Data**, add under `users/<uid>`:
  ```json
  {
    "fullName": "Dr S. Mahlangu",
    "email": "lecturer@ump.ac.za",
    "role": "lecturer",
    "accountStatus": "active",
    "programme": "BICT",
    "academicYear": "First Year",
    "createdAt": 1700000000000
  }
  ```

**Administrator** (bootstrap — one-off):
- Create the Auth user in **Authentication → Users → Add user**.
- In **Realtime Database → Data**, add under `users/<uid>`:
  ```json
  {
    "fullName": "Platform Administrator",
    "email": "admin@ump.ac.za",
    "role": "admin",
    "accountStatus": "active",
    "createdAt": 1700000000000
  }
  ```

> ⚠️ You must set these nodes **manually in the Firebase Console** (the console
> bypasses security rules). Never expose admin creation through the UI.

---

## 2. Run locally

Open the folder in VS Code and start **Live Server** (right-click `index.html`
→ *Open with Live Server*), or use any static server:

```bash
npx serve .
# or
python3 -m http.server 5500
```

Then open <http://localhost:5500/>.

> Do **not** open files via `file://` — ES modules and Firebase need an HTTP origin.

---

## 3. Testing checklist (Phase 1 — auth)

1. Open `register.html` → try an invalid email (`me@gmail.com`) → should be rejected.
2. Try student number `12345` → rejected (needs 9 digits).
3. Try email `999999999@ump.ac.za` with student number `230236088` → rejected (mismatch).
4. Try weak password `password` → rules checklist turns red on the missing rules.
5. Register correctly (`230236088@ump.ac.za` + matching number + strong password) →
   redirected to `verify-email.html`.
6. Check your inbox → click verification link → return → press **I've verified** →
   lands on `student-dashboard.html` (once Phase 2 is built; until then you'll see 404 — that's expected).
7. Sign in with the same credentials → same redirect.
8. Try *Forgot password* → receive reset email → set new password → sign in.
9. Sign out (from any page in Phase 2+) → redirected to `login.html`.

---

## 5. Deploy to Vercel

This repository is a plain static ES-module application. Vercel does not expose
`VITE_*` variables to plain browser JavaScript. Configure these variables in the
Vercel project under **Settings → Environment Variables**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)

Set the variables for Production (and Preview if needed), then redeploy.
The project includes `/api/firebase-config.js`, which supplies the browser
Firebase initialization with these server-side environment variables.

In Vercel, set the project **Root Directory** to `ump-bict-platform` only if
the repository's top level is the parent folder shown in this workspace.
Leave **Build Command** empty and **Output Directory** empty for this static
project. Do not set an output directory such as `dist`.

Finally, in Firebase Console → Authentication → Settings → Authorized domains,
add the deployed Vercel hostname, for example
`your-project.vercel.app` and any custom domain.

## 4. Cloudflare R2 (file storage)

Firebase Storage requires the Blaze plan. This project uses **Cloudflare R2**
(free tier: 10 GB storage, 1M Class A / 10M Class B ops per month).

### 4.1 One-time Cloudflare setup

1. Sign up at <https://dash.cloudflare.com> (a card is required for R2's
   verification flow — the free tier has no charge).
2. **R2 → Create bucket** → name: `ump-bict-resources` → keep private.
3. **Bucket → Settings → CORS Policy** → paste the JSON from
   `cloudflare-worker/CORS.json` (see project root).
4. **R2 → Manage R2 API Tokens → Create API Token**:
   - Permissions: **Object Read & Write**
   - Bucket: **only** `ump-bict-resources`
   - Save the **Access Key ID** and **Secret Access Key**.

### 4.2 Deploy the Worker

```bash
cd cloudflare-worker
npm install
npx wrangler login           # opens browser
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler deploy