# TableServe — QR Restaurant Ordering Platform

Multi-restaurant QR menu & ordering system. Customers scan a table QR code,
browse the menu, and order — no app download, no login required for them.
Each restaurant signs up with its own email/password account and manages its
own menu, offers, video-feedback campaign, tables, and orders from its own
dashboard.

Runs entirely on local SQLite — no external database or API keys needed to
try every flow. See `technical-spec.md` for the full architecture and the
production-scale roadmap (Postgres, real payment gateway, n8n, live AI, etc).

## 1. Run it locally

Requires Node.js 18+.

```bash
npm install
npm run seed      # creates data/app.db + a demo restaurant + demo login
npm run dev        # http://localhost:3000
```

## 2. Log in

Open `http://localhost:3000` — this is the login gateway, not a marketing
page. Two options:

- **Log in** with the seeded demo account:
  - email: `demo@spicegarden.test`
  - password: `demo1234`
- **Set up your restaurant** — a real signup form: restaurant/hotel name,
  a cover photo/logo upload, email, and password. Creates a brand-new
  restaurant with its own menu (empty, ready for you to build), tables,
  and dashboard.

Passwords are hashed (bcrypt) and sessions are stored server-side with an
httpOnly cookie — this is real authentication, not a placeholder.

## 3. What you can do from the dashboard

- **Menu** — create categories, add/edit/delete menu items with photo
  upload, price + discounted price, veg/non-veg, spice level, tags,
  allergens, prep time, popular/recommended badges, and live
  available/unavailable toggling.
- **Offers** — create/pause/delete percentage or flat-amount offers with a
  minimum order value. At checkout, customers see every offer they qualify
  for and pick which one to apply — the discount only applies if they
  select it, not automatically.
- **Taxes** — add as many named taxes/charges as you like (GST, service
  charge, etc). Each active one shows as its own line on the customer's
  bill and in your order records. Turn any of them off without deleting it.
- **Campaigns** — create a video-feedback campaign ("share a video, get
  20% off"). The customer completes it at checkout (terms → rating/feedback
  → video upload) and the discount applies **immediately to that order**
  — not a code for next time. Mutually exclusive with offers (pick one).
  Submissions (rating, text, video) land in the Submissions list below it.
- **Notifications** — add/remove the email addresses of whoever should
  know about a new order (chef, kitchen staff, etc). New orders email
  automatically to this list, and you can manually send any specific order
  from the Orders tab too. Actually sending requires SMTP configured in
  `.env` (see §9) — without it, you'll see a clear "not configured"
  message rather than a silent failure.
- **Tables & QR** — add tables, preview each table's live customer view,
  download/print its QR code, activate/deactivate.
- **Orders** — updates appear **instantly** (real-time push, not polling —
  see §9) with a toast for new orders. Only two statuses: Pending and
  Completed, matching what the customer sees. Mark cash or UPI orders as
  paid, send an order to a notification email on demand, or delete it.
- **Payment settings** — upload your PhonePe/UPI QR code image for
  customers to scan at checkout.
- **Billing** — view your subscription plan/cycle, and your (the platform
  owner's) phone + QR so you can pay your subscription anytime.
- **"👁️ View customer menu"** in the header — opens exactly what your
  customers see, using your first real table (not a hardcoded one).

## 4. The customer flow

`http://localhost:3000/r/spice-garden/table/1` (or `table/2`–`table/6`).

Welcome screen → search/filter menu → "🤖 Help me choose" → item detail with
notes/quantity → cart → checkout (cash or UPI-QR) → order placed → live
status → if the restaurant has an active campaign, an invite to submit
video feedback for a discount code on their next visit.

## 5. Uploaded images/videos

Stored locally under `public/uploads/` (restaurant cover photos, menu item
photos, PhonePe QR images, campaign video submissions). This is fine for
local testing; move to real object storage (S3/Supabase Storage) before
deploying anywhere persistent — see `technical-spec.md` §11.

## 6. Super admin

Open `http://localhost:3000/super-admin` (on Render: `https://YOUR-DOMAIN/super-admin`). It is a separate login from
restaurant clients. The first time, it shows a one-time setup form where you choose your own email and password
(plus a secret code for resetting it). Nothing is preset.

Check what Super Admin controls from the terminal (read-only, nothing is changed):

```bash
npm run check
```

It prints your account status, the current platform rates, the plans clients see, every client with their status and
due date, and payment screenshots waiting for you. Start the app once with `npm run dev` first so the database exists.

## 7. Project structure

```
app/
  page.js                          Login/signup gateway (the site's front door)
  login/, signup/                  Real email+password auth pages
  r/[restaurant]/table/[tableId]/  Customer ordering flow
  dashboard/[restaurant]/          Restaurant admin (auth-protected)
  super-admin/                     Platform-wide rate control & restaurant list
  api/
    auth/                          signup, login, logout
    uploads/                       Generic image/video upload (base64 → public/uploads)
    menu/[restaurant]/             Public menu data
    orders/                        Create + look up orders
    ai/recommend/                  Rule-based recommender (real Claude API is a later swap)
    campaigns/submit/              Customer video-feedback + consent submission
    admin/[restaurant]/            Categories, menu items, offers, campaigns, orders,
                                    tables/QR, payment settings — all full CRUD
    super-admin/                   Platform rates, restaurant status
lib/
  db.js                            SQLite schema + connection
  auth.js                          Password hashing, sessions, restaurant-access checks
  uploads.js                       Save base64 file data to public/uploads
  ids.js                           UUIDs + order number generation
scripts/seed.js                    Demo restaurant "Spice Garden" + demo login
technical-spec.md                  Full architecture, schema, and scale-up roadmap
```

## 8. Real-time updates & email setup

Orders appear on the dashboard and the customer's status screen **instantly**
— no polling, no manual refresh. This uses Server-Sent Events (SSE) with an
in-memory pub/sub (`lib/eventBus.js`): the moment an order is created or its
status changes, every open dashboard/confirmation-screen connection gets
pushed the update directly. This works because the app runs as one
persistent process on your machine; if you ever scale to multiple server
instances behind a load balancer, swap the event bus for a real one (Redis
pub/sub) — the subscribe/publish shape stays the same.

To actually send order emails (not just manage the recipient list), add SMTP
credentials to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=an app password, not your normal password
SMTP_FROM=you@gmail.com
```

Without these set, the "Notifications" tab and the per-order "Send to
email" button still work, but you'll see a clear "email isn't configured
yet" message instead of a silent failure.

## 9. What's still a placeholder

- **n8n notifications** — the webhook call exists and silently no-ops if
  `N8N_WEBHOOK_URL` isn't set in `.env`. (Email itself is real — see §8.)
- **AI recommendations** — rule-based, reads only real/available menu
  items; swapping in the live Claude API is a one-function change (see
  comments in `app/api/ai/recommend/route.js`).
- **Automated billing scheduler** — reminders / grace period / auto-suspend
  on non-payment is fully specified in `technical-spec.md` §5 but not yet
  running as a cron job; use the manual suspend toggle in Super Admin.
- **Online payment** is a manual PhonePe-QR-scan-and-confirm flow, not a
  gateway — money goes straight to the restaurant, so there's no automatic
  verification (see `technical-spec.md` §6 for why, and the trade-off). The
  per-order platform fee is disclosed on the bill and tracked as a balance
  the restaurant owes you (Super Admin → Platform fee balance) — collected
  by you separately via bank/UPI, not split automatically at payment time.

## 10. Moving to production

- Swap `lib/db.js` for a Postgres client (Supabase recommended).
- Move `public/uploads/` to real object storage.
- Add Row-Level Security policies per `technical-spec.md` §3.
- Swap the in-memory event bus (§8) for Redis pub/sub if you run more than
  one server instance.
- Set `N8N_WEBHOOK_URL`, `AI_API_KEY`, SMTP credentials, and a real payment
  gateway for your own subscription billing per `.env.example`.

---

## Billing mode (offline ordering) — added sections

The dashboard sidebar now has a **Billing** group above the original QR sections
(nothing from the QR flow was removed):

| Section | Purpose |
|---|---|
| Offline Menu | Staff tap items (round category icons, square item cards) and place an order |
| My Orders | Pick Cash / Online, optional discount, highlighted **Receipt** toggle, confirm payment |
| Menu Manager | Category boxes; add / edit / delete categories and items (square cards) |
| Analytics | Revenue for Today, Last 7 days, This month, Last 3 months, Last year, with comparison, cash vs online, top items, sales by category |
| Printer Connection | Installed (USB) printer or Bluetooth ESC/POS, paper width, copies, test print; **Billing history** below with re-print |
| User Account | Email, logo, phone, address, GSTIN, FSSAI, receipt footer |
| Customer Support | Raise a problem; shows your phone/email; replies appear here |

Super Admin: new **Support tickets** inbox (with the client's email, phone, GST) and a
**support email** field next to the phone number.

GST: enter the GSTIN in User Account and set the tax lines (e.g. CGST 2.5% + SGST 2.5%)
in the existing Taxes tab. Both print on every receipt. Offline bills carry no platform fee.

Silent printing: with an installed printer the browser still shows its own print dialog.
Start Chrome/Edge with `--kiosk-printing` and set the thermal printer as default to print with one tap.


## Clients (Super Admin)

`/super-admin` has a **Clients** section: one card per client with contact details, GSTIN, fees paid,
status and private notes, with search. "Import hosted restaurants" adds every online restaurant in one click.
Only the Super Admin can see or change it.

## Look and feel

The client dashboard, the login pages and the customer menu share one frosted-glass style (cream and leaf green).
Glass and animation styles live in `app/globals.css` (`.glass`, `.gd` for the dashboard, `.gv` for the customer view);
the dashboard frame is `components/glass/DashShell.jsx`.

**Menu Manager** (dashboard): type a name and price and press Enter to add a dish instantly, tap a name or price to
edit it, switch Chef's Pick / Popular / New on the card, reorder with the arrows, or open "With photo & details" for a
window that previews exactly how guests will see the dish.

**My Orders** (dashboard): a summary of the chosen period (orders, sales, money still to collect, cash vs online,
best seller, busiest table), filters and search, and a detailed card per order with a progress line, every dish with
its notes, the full bill, payment state and a one-tap "next step" button.

**Customer menu:** the banana-leaf hero stays on top; below it, "New on the menu" and the dish list are laid out
Swiggy-style (photo on the right, ADD button that becomes a - 1 + stepper), centred and two columns on wide screens.

**After login** clients land on a separate subscription page (`/dashboard/<slug>/subscription`): plans like an official
pricing page, the free trial ("Continue with free trial" opens the dashboard), and the pay step (scan the QR or pay to
your number, then upload the screenshot; platform fees can be submitted the same way). When you confirm the payment
the plan starts. When the trial date passes the page says the trial days have ended; after the grace days the
dashboard locks until a payment is confirmed. Super Admin can switch the landing page off under Default platform rates.

**What Super Admin edits reach every client:** the plans (price, platform fee, texts, features) update everyone already
on that plan, the "about" text and your contact details show on every client's page, and the default platform fee,
monthly fee and trial days apply to every client you have not given a custom value. A change to the default grace days
moves every client who was still on the old default. Anything you set by hand on one client's card stays for that client.

## Login: Google and email

Owners can log in or sign up with **Google** or with an **email and password**. The Google button only appears once
these two environment variables are set (on Render: your service -> Environment):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

To get them: Google Cloud Console -> APIs & Services -> Credentials -> Create credentials -> OAuth client ID ->
Web application. Under **Authorized redirect URIs** add `https://YOUR-DOMAIN/api/auth/google/callback`
(and `http://localhost:3000/api/auth/google/callback` for testing on your computer). Also set `BASE_URL` to
`https://YOUR-DOMAIN` so the address Google sends people back to is always right. On the OAuth consent screen,
publish the app (otherwise only the test users you list can sign in).

To test Google login on your computer, copy `.env.example` to `.env.local`, fill in the two Google values, add
`http://localhost:3000/api/auth/google/callback` as an authorized redirect URI, and restart `npm run dev`.
(The login page shows these steps while the keys are missing.)

A new person who signs up with Google only adds their restaurant name and phone number. An existing owner whose
email matches their Google account is simply logged in.

## Starting plans (edit anything in Super Admin)

The first time the app starts it creates two plans and sets the platform rates: a **Free Trial** plan, a **Standard**
plan at **₹600 / month**, a **₹2 platform fee per order** and no setup fee. Change the plans, their prices, the
per-order fee, the grace days and the trial length any time in Super Admin (Plans & client billing page, and Default
platform rates). They are only created once, so deleting or editing them is safe.

A dish appears in the big "Serve on Leaf" section at the top of the customer menu only when the owner switches
**Show on the Leaf** on for it (Menu Manager). Switched off, it only appears in the normal menu list.

The home page has no landing screen: it opens the login (or the dashboard when already signed in).

## Plans, free trial and suspension

Super Admin -> **Default platform rates** sets the free-trial length for new clients, the grace days and the
"suspend automatically when unpaid" switch. **Plans & client billing page** edits the plans, the "about the app"
text and your contact details that every client sees on their Billing tab after login.

Clients pay by UPI QR and upload a screenshot; confirming it in Super Admin starts a new 30-day period (paying early
extends from the current due date). If the due date and grace days pass without a confirmed payment the client is
suspended: the dashboard shows only the plans/pay screen and the customer QR menu stops taking orders.

## Deploying (GitHub -> Render)

The app stores its data in SQLite under `data/` (git-ignored). On Render, attach a **persistent disk** mounted at
`/opt/render/project/src/data`, otherwise the database and uploaded photos are wiped on every deploy.
