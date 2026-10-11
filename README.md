# Cainta Business Promotion and Registry System

A business promotion and registry system for **Cainta, Rizal**. Local businesses register
once, get verified by an administrator, and get published in a public business directory.

Built with **plain HTML, CSS and JavaScript** — no frameworks, no build step, no server.
It runs directly on **GitHub Pages**.

---

## Live demo

Push this folder to a GitHub repository and enable **Settings → Pages → Deploy from a branch**
(root folder / `main`). The site will be available at `https://<user>.github.io/<repo>/`.

To try it locally before pushing, just open `index.html` in a browser.

---

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@cainta.gov.ph` | `Admin@123` |
| Customer | register your own via `register.html` | — |

On first run the system seeds the administrator account and five sample approved
businesses plus one pending record so the directory is not empty.

> The demo administrator is only a convenience for evaluation. Remove the `DEMO_ADMIN`
> block in `js/auth.js` and delete `localStorage` before any real deployment.

---

## How the requirements are met

### 1. Landing Page — `index.html`

* **No login required.** Fully public.
* **Business name** — "Cainta Business Promotion & Registry System" in the hero, navbar and footer.
* **Short description** — the hero paragraph.
* **Services** — six service cards (`#services`): Business Registration, Public Directory
  Listing, Promotion & Visibility, Verification & Compliance, Owner Self-Service, Admin Monitoring.
* **At least one image** — `assets/hero.svg` (hero illustration) and `assets/logo.svg`.
* **Clear calls to action** — *Register Your Business*, *Login*, *Register*, *Add Listing*.
* **Responsive** — mobile-first CSS with breakpoints at 900px / 820px / 760px / 640px.
  The layout collapses to a single column, tables become cards, and the navbar becomes a
  hamburger drawer. Verified readable at 320px wide.
* **Bonus** — a searchable, filterable public business directory on the same page.

### 2. Users — `register.html`, `login.html`, `js/auth.js`

* **Register** with full name, email and password (plus confirm-password and terms consent).
* **Login** and **Logout** (logout asks for confirmation first).
* **Password hashing.** The plain-text password is never stored, logged or transmitted.
  `hashPassword()` runs **PBKDF2-SHA256 with 210,000 iterations** using the Web Crypto API
  with a **random 16-byte salt per user**. When Web Crypto is unavailable (for example a page
  opened straight from disk via `file://`), it falls back to a pure-JS **iterated SHA-256**.
  The algorithm used is recorded alongside each hash, so verification always matches.
* **Two levels of access.**

  | Capability | Admin | Customer |
  |---|---|---|
  | See every business record | Yes | No — own records only |
  | Create a record | Yes | Yes (own) |
  | Update a record | Any record | Own records only |
  | Delete a record | Any record | Own records only |
  | Approve / reject a listing | Yes | No |
  | Manage users and roles | Yes | No |

  Public sign-up can only ever create a **customer** — the `role` field is hard-coded to
  `"customer"` in `Auth.register()`, so privilege escalation through the form is impossible.

* **Protected pages.** `dashboard.html` and `admin.html` call `Auth.guard()` on load.
  A logged-out visitor is redirected to `login.html?next=dashboard.html`. A customer who
  opens `admin.html` is bounced to their dashboard, and vice versa.

### 3. CRUD — core entity: **Business Registration**

Complete Create / Read / Update / Delete, implemented in `js/db.js` + `js/business-form.js`.

* **Create** — `BusinessForm.open()` in a modal, from `dashboard.html` and `admin.html`.
* **Read** — list cards on the dashboard, table/cards in the admin console, public
  directory on the landing page, plus a read-only "View" modal showing every field.
* **Update** — same form in edit mode; customers can only edit records they own
  (ownership is re-checked on the record, not just hidden in the UI).
* **Delete** — **always** goes through a confirmation modal that spells out the
  consequence and states the action cannot be undone.
* **Input validation.** Every field is validated with a specific, friendly message:
  required checks, length limits (business name 3–80, description 20–400, address 8–160),
  an email format check, and a Philippine phone check that normalises
  `0917 123 4567`, `+63 917 123 4567` and Cainta landlines like `8 123 4567`, rejecting
  anything else. Errors appear inline under the offending field, the first
  bad field receives focus, and a toast confirms the failure. Fields also re-validate live
  as the user types.
* **Persistence.** Data is stored in `localStorage` under the key `cbr_db_v1`, so it
  survives page reloads, browser restarts and closing the tab. Corrupt or unreadable
  stored data is detected and reset safely instead of crashing.
* **Extra integrity rules** — deleting the last administrator is blocked, a user cannot
  delete their own account, an admin cannot demote themselves, and deleting a user
  cascades to their business records.

---

## Project structure

```
cainta-business-registry/
├── index.html              Landing page (public)
├── login.html              Login
├── register.html           Registration
├── dashboard.html          Customer area — protected
├── admin.html              Admin console — protected
├── css/
│   └── style.css           All styling (mobile-first)
├── js/
│   ├── db.js               Persistence layer + validation constants
│   ├── auth.js             Hashing, register/login/logout, session, route guards
│   ├── ui.js               Toasts, modals, confirm dialog, escaping, field validation
│   ├── business-form.js    Shared Create/Update form for the core entity
│   ├── landing.js          Public landing page logic
│   ├── auth-page.js        Login + registration page logic
│   ├── dashboard.js        Customer CRUD
│   └── admin.js            Admin CRUD, user and role management
├── assets/
│   ├── hero.svg            Hero image
│   └── logo.svg            Logo / favicon
├── .nojekyll               Disables Jekyll processing on GitHub Pages
└── README.md
```

Script load order is `db.js → auth.js → ui.js → business-form.js → page script`; all pages
use relative paths, so the project works from a subfolder such as
`github.io/<repo>/`.

---

## Accessibility & security notes

* Semantic landmarks, labelled form controls, `aria-invalid` / `aria-live` where needed,
  visible focus rings, and 44px minimum touch targets.
* All user-supplied text is HTML-escaped before rendering, so the app is not vulnerable to
  stored XSS through business names or descriptions.
* Login responds with the same generic message for an unknown email and a wrong password,
  and always performs a hash comparison, so account existence is not revealed.

### Honest limitation

Because this is a **front-end-only** application deployed to static hosting, hashing happens
in the browser and the database is `localStorage` on each visitor's own device. That is fine
for a class project or prototype, and it satisfies "hashed, never plain text", but it is **not**
production-grade security:

* Any user can inspect or edit their own `localStorage` from the browser dev tools.
* PBKDF2 is done client-side, so an attacker with control of the page could tamper with it.
* Data is not shared between visitors — each browser has its own copy.

Moving to production means a real backend (Node/Express or Django) with **bcrypt/argon2 on
the server**, a real database (MySQL/PostgreSQL), and HTTPS. The front end here is already
structured around `DB.*` calls, so swapping that module for `fetch()` calls against an API is
a contained change.

---

## Resetting the data

Open the browser console on any page and run:

```js
localStorage.removeItem('cbr_db_v1');
localStorage.removeItem('cbr_db_v1_seed');
location.reload();
```

The system will re-seed the administrator and the sample businesses on the next load.

---

*Municipality of Cainta, Province of Rizal — Philippines.*