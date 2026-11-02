# QR Restaurant Ordering Platform — Full Technical Specification

## 1. Overview

A multi-tenant SaaS web application. One codebase serves many restaurants ("clients"). Each restaurant pays you a subscription to use the platform. Their customers use it for free, scanning a per-table QR code to browse the menu and order — no app download, no customer login.

Two completely separate user experiences:

- **Customer app** (`/r/{restaurantId}/table/{tableId}`) — no login, mobile-first, ordering flow.
- **Platform** — two admin layers:
  - **Restaurant Admin Dashboard** — each client manages their own menu, tables, offers, orders, campaign, billing.
  - **Super Admin Dashboard** (you) — manage all restaurants, subscriptions/invoices, platform-wide revenue (₹3/order fee), suspend/reactivate clients.

---

## 2. Tech Stack (recommended)

| Layer | Choice | Why |
|---|---|---|
| Frontend (customer + dashboards) | Next.js (React, App Router) | SSR for fast QR-scan load, API routes built in, PWA-friendly |
| Styling | Tailwind CSS | Fast, mobile-first |
| Backend | Next.js API routes / Node.js (Express if separated later) | Keeps server-side secrets off the client |
| Database | PostgreSQL (Supabase recommended) | Relational integrity, row-level security for multi-tenancy |
| Auth | Supabase Auth / NextAuth | Restaurant owner + staff login, roles |
| File storage | Supabase Storage / S3 | Menu images, logos, PhonePe QR image, video feedback uploads |
| QR generation | `qrcode` npm package | Generates static PNG/SVG per table |
| AI recommendation | Anthropic API (Claude) via server-side call | Menu-grounded, no invented items |
| Automation / notifications | n8n (self-hosted or cloud) | Order alerts, billing reminders, email/SMS |
| Payments (subscription, future gateway option) | Razorpay/Stripe (optional, mockable) | For your own ₹10k/₹7k billing collection |
| Customer online payment | Client-uploaded PhonePe static QR image | No gateway; trust-based, manually confirmed |

---

## 3. Multi-Tenancy Model

Every tenant-scoped table carries `restaurant_id`. Two enforcement layers:

1. **Application layer** — every query is scoped by the authenticated user's `restaurant_id` (from their session/JWT).
2. **Database layer (defense in depth)** — PostgreSQL Row-Level Security (RLS) policies on every tenant table, e.g.:

```sql
CREATE POLICY restaurant_isolation ON menu_items
  USING (restaurant_id = current_setting('app.current_restaurant_id')::uuid);
```

Super admin role bypasses RLS via a service-role key used only in server-side super-admin routes — never exposed to the browser.

---

## 4. Database Schema

### 4.1 Platform / Tenant Core

**restaurants**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| slug | text unique | used in `/r/{slug}` |
| logo_url | text | |
| cover_image_url | text | |
| description | text | |
| address | text | |
| phone | text | |
| currency | text default 'INR' | |
| tax_percent | numeric | client-editable |
| opening_hours | jsonb | |
| welcome_animation_enabled | boolean | |
| welcome_sound_enabled | boolean | |
| status | enum: active, suspended, trial | driven by subscription |
| created_at | timestamptz | |

**users** (platform-wide login table)
| id, email, phone, password_hash, role (super_admin / restaurant_owner / restaurant_staff), created_at |

**restaurant_users** (join table — staff can belong to one restaurant, owner can too)
| id, user_id FK, restaurant_id FK, role (owner/manager/staff), created_at |

### 4.2 Subscription & Billing (new)

**platform_settings** (super admin only, single row or versioned)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| onboarding_fee | numeric | current default, e.g. 10000 |
| monthly_fee | numeric | current default, e.g. 7000 |
| order_fee | numeric | current default, e.g. 3 |
| grace_period_days | int | default 3 |
| effective_from | timestamptz | when this rate set took effect |
| updated_by | uuid FK → users | which super admin changed it |
| created_at | timestamptz | |

Super admin can update these values at any time from the super-admin dashboard. Keep this as a small **history table** (insert a new row on every change, rather than updating in place) so you always have an audit trail of what the rates were on any given date — this matters for invoice disputes ("why was I charged ₹8,000 last month?").

**subscriptions** (per-restaurant — snapshots the rate that applies to them)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK | |
| plan_name | text | e.g. "Standard" |
| onboarding_fee | numeric | copied from `platform_settings` at signup time |
| onboarding_paid | boolean | |
| monthly_fee | numeric | copied from `platform_settings` at signup; **overridable per-restaurant** by super admin (e.g. custom discount for one client) |
| order_fee_override | numeric nullable | if set, used instead of the current global `order_fee` for this restaurant |
| billing_cycle_start | date | |
| billing_cycle_end | date | |
| status | enum: active, grace_period, suspended, cancelled | |
| grace_period_days | int | copied from `platform_settings`, overridable | |
| created_at | timestamptz | |

**platform_invoices**
| id, restaurant_id FK, amount, type (onboarding/monthly), due_date, paid_date, status (pending/paid/overdue), payment_reference, created_at |

**platform_fees** (per-order platform revenue tracking)
| id, restaurant_id FK, order_id FK, fee_amount, billing_period (month), settled boolean, created_at |

`fee_amount` is captured **at order time** from whatever the current rate is (the restaurant's `order_fee_override` if set, otherwise the live `platform_settings.order_fee`) — never recalculated later. This way, if you raise the order fee from ₹3 to ₹5 mid-month, past orders keep their original ₹3 and only new orders get ₹5. Same principle applies to `subscriptions.monthly_fee`: a rate change you make in the super-admin panel takes effect on that restaurant's **next** billing cycle, not retroactively on the current one — unless you explicitly force an immediate change.

> Since customer online payments go straight to the restaurant's own PhonePe (no gateway you control), the ₹3/order fee is **not** deducted per-transaction. It accumulates in `platform_fees` and is added as a line item to that restaurant's next `platform_invoices` monthly bill (monthly_fee + Σ order fees for the period).

**billing_notifications**
| id, restaurant_id FK, invoice_id FK, type (reminder_5day, reminder_1day, suspended, reactivated), sent_at, channel (email/sms) |

### 4.3 Menu

**categories**
| id, restaurant_id FK, name, sort_order, active |

**menu_items**
| id, restaurant_id FK, category_id FK, name, description, price, discounted_price, image_url, is_veg, spice_level (none/mild/medium/hot), tags (text[]), ingredients (text[]), allergens (text[]), prep_time_minutes, available (bool), is_popular (bool), is_recommended (bool), created_at, updated_at |

**menu_item_addons**
| id, menu_item_id FK, name, price, required (bool), max_selectable |

### 4.4 Tables & QR

**tables**
| id, restaurant_id FK, table_number, table_name, qr_url, qr_image_url, active (bool), created_at |

QR URL format is stable (`/r/{restaurant_slug}/table/{table_number}`) — regenerating the menu never changes it, satisfying requirement #2.

### 4.5 Offers & Campaigns

**offers**
| id, restaurant_id FK, title, description, discount_type (percent/flat), discount_value, min_order_value, start_date, end_date, eligible_item_ids (uuid[] nullable = all items), usage_limit, times_used, active, terms_text |

**campaigns** (video feedback / Instagram content campaign)
| id, restaurant_id FK, title, description, discount_type, discount_value, requires_video (bool), allow_instagram_repost (bool), terms_version, active |

**consents**
| id, campaign_id FK, order_id FK, session_id, consent_timestamp, terms_version, agreed_to_submit_content (bool), agreed_to_instagram_use (bool nullable) |

**reviews**
| id, restaurant_id FK, order_id FK, campaign_id FK nullable, rating, text_feedback, video_url, submitted_at, is_positive nullable — honesty enforced, never gated on positivity |

### 4.6 Orders

**orders**
| id, order_number (e.g. ORD-20260904-0012), restaurant_id FK, table_id FK, status (pending/confirmed/preparing/ready/completed/cancelled), subtotal, discount_amount, applied_offer_id nullable, applied_campaign_discount nullable, tax_amount, platform_fee default 3, total, payment_method (cash/online_upi), payment_status (unpaid/pending_confirmation/paid/failed), customer_note, session_id, created_at, updated_at |

**order_items**
| id, order_id FK, menu_item_id FK, quantity, unit_price, addons (jsonb), item_note |

**payments** (customer-facing payment attempts)
| id, order_id FK, method (cash/online_upi), amount, status (initiated/pending_confirmation/confirmed/failed), confirmed_by (staff user_id, nullable), confirmed_at, screenshot_url nullable — customer can optionally upload payment screenshot as evidence |

### 4.7 Restaurant Payment Config (new)

**restaurant_payment_settings**
| id, restaurant_id FK, phonepe_qr_image_url, upi_id (optional, text shown alongside QR), cash_enabled (bool), online_enabled (bool) |

### 4.8 Analytics / Events

**analytics_events**
| id, restaurant_id FK, event_type (ai_recommendation_shown, ai_recommendation_add_to_cart, offer_applied, order_placed, etc.), metadata jsonb, session_id, created_at |

### 4.9 Sessions (temporary, expirable)

**customer_sessions**
| id, restaurant_id FK, table_id FK, cart_data jsonb, created_at, expires_at default now()+24h |

A scheduled cleanup job (cron / n8n / Supabase Edge Function) deletes expired rows from `customer_sessions` only — never touches `orders`, `menu_items`, `offers`, or billing records, per requirement #19. Order/business record retention is configurable via an env-level `ORDER_RETENTION_DAYS` (default: indefinite).

---

## 5. Subscription / Auto-Suspend Logic (new)

1. On restaurant signup: create `subscriptions` row, `onboarding_paid = false`, `restaurants.status = trial`.
2. Owner pays ₹10,000 onboarding → `onboarding_paid = true`, `restaurants.status = active`, `billing_cycle_end = today + 30 days`.
3. A daily scheduled job checks all active subscriptions:
   - `billing_cycle_end - 5 days` → send reminder ("renew in 5 days")
   - `billing_cycle_end - 1 day` → send final reminder
   - `billing_cycle_end` passed, unpaid → move to `grace_period` for `grace_period_days`, still serving customers but owner dashboard shows a banner
   - grace period passed, still unpaid → `restaurants.status = suspended`
4. When `restaurants.status = suspended`, the customer-facing `/r/{slug}/table/{id}` route serves a "This restaurant's menu is temporarily unavailable" page instead of the menu — no data is deleted.
5. On payment received → `status = active`, cycle extended, reactivation notification sent.
6. All reminders/suspension notices sent via n8n → email (and SMS later), logged in `billing_notifications`.
7. Discount/fee changes: the super-admin dashboard has a "Platform Rates" screen where you can update `platform_settings` (onboarding fee, monthly fee, order fee, grace period) at any time — this becomes the default for all **new** restaurants signing up from that point on. For an **existing** restaurant, you can separately override just their `subscriptions.monthly_fee` or `order_fee_override` (e.g. a one-off discount for a specific client) without touching the global default. Either kind of change should trigger a notification to the affected restaurant(s) explaining the new rate and when it takes effect.

This entire module needs its own scheduler — recommend Supabase Edge Functions on a cron trigger, or an n8n workflow polling daily.

---

## 6. Payment Flows

### Cash
`payment_method = cash`, `payment_status = paid` is only set once staff marks the order "Completed" or "Confirmed" on the dashboard — not automatically.

### Online (client's PhonePe QR)
1. Customer selects "Pay Online."
2. App displays the restaurant's uploaded PhonePe QR image (from `restaurant_payment_settings.phonepe_qr_image_url`) with the order total shown clearly.
3. Customer pays via their own UPI app, then taps "I've Paid" (optionally uploads a screenshot).
4. Order is created with `payment_status = pending_confirmation`.
5. Restaurant staff sees it flagged on the dashboard and manually marks it `confirmed` after checking their own PhonePe account.
6. **No automatic verification happens** — this must be clearly communicated to clients during onboarding as a trust-based flow, not a gateway-verified one.

### Your own subscription billing
Separate from the above — for collecting ₹10,000/₹7,000 from restaurant owners, use a real gateway (Razorpay/Stripe) with server-side verification, since this is money coming to *you* and needs to be auditable. Mockable in dev via `PAYMENT_API_KEY=mock`.

---

## 7. AI Recommendation Architecture

- Server-side endpoint `/api/ai/recommend` receives: customer's natural-language input + `restaurant_id`.
- Server fetches only that restaurant's **currently available** menu items (name, price, discounted_price, tags, spice_level, is_veg, is_popular) and active offers.
- This data is injected into the Claude API system prompt as the *only* source of truth, with an explicit instruction: never invent items, prices, or availability; only choose from the provided JSON list.
- Response parsed as structured JSON: `[{item_id, reason}]`, then the server looks up full item details to return to the frontend (never trusting the model to echo prices back).
- Every recommendation shown and every resulting add-to-cart logs an `analytics_events` row for the conversion metric in section 17 of the original spec.

---

## 8. n8n Integration Layer

Server-side only — webhook URL and secret live in env vars, never sent to the browser.

- `POST {N8N_WEBHOOK_URL}/order-created` — triggered after order insert, HMAC-signed with `N8N_WEBHOOK_SECRET`, payload = restaurant, table, order, items, total, payment method.
- `POST {N8N_WEBHOOK_URL}/billing-event` — triggered by the subscription scheduler for reminders/suspensions.
- n8n workflows handle: email to restaurant on new order, email/SMS billing reminders, and are the natural place to later add WhatsApp/SMS notification channels without touching app code.

---

## 9. Security Checklist

- Auth: Supabase Auth / NextAuth, JWT with `restaurant_id` + `role` claims.
- RLS on every tenant table (section 3).
- Rate limiting on public customer routes (menu view, AI recommend, order placement) to prevent abuse.
- Input validation with a schema library (Zod) on every API route.
- File upload validation (type/size limits) for menu images, logos, PhonePe QR, video feedback.
- Webhook signature verification for all n8n calls.
- No secrets in any client-side bundle — verified via a build-time check.
- Parameterized queries only (Supabase client / an ORM like Prisma or Drizzle) — no raw string SQL concatenation.

---

## 10. Environment Variables (`.env.example`)

```
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

AI_API_KEY=

N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=

PLATFORM_PAYMENT_API_KEY=
PLATFORM_PAYMENT_SECRET=

EMAIL_API_KEY=

STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

SEED_ONBOARDING_FEE=10000
SEED_MONTHLY_FEE=7000
SEED_ORDER_FEE=3
SEED_GRACE_PERIOD_DAYS=3
# ^ used only to seed the initial platform_settings row on first setup —
#   after that, rates are changed live from the super-admin dashboard, not env vars.

ORDER_RETENTION_DAYS=
```

---

## 11. Folder Structure

```
/app
  /r/[restaurant]/table/[tableId]      # customer flow (public)
  /dashboard/[restaurant]              # restaurant admin (auth required)
  /super-admin                         # your platform admin (auth required)
  /api
    /orders
    /ai/recommend
    /webhooks/n8n
    /billing
    /qr
/lib
  /db            # queries, Drizzle/Prisma schema
  /auth
  /payments
  /ai
  /n8n
  /qr
/components
  /customer
  /dashboard
  /super-admin
/emails          # templates
.env.example
```

---

## 12. Build Roadmap

**Stage 1 — Core**: restaurants, menu, tables/QR, customer menu view, cart, order creation (cash only), basic restaurant dashboard.

**Stage 2 — Operations**: n8n order webhook, email notification, order status updates, staff order queue.

**Stage 3 — Money**: subscription/billing module + auto-suspend, PhonePe QR online payment flow, offers system.

**Stage 4 — Growth**: AI recommendation, video-feedback campaign + consent, analytics dashboards (including your platform-wide revenue view), production hardening (RLS, rate limiting, retention job).

Demo restaurant "Spice Garden" seeded at the end of Stage 1 for testing throughout.

---

## 13. Open Decisions Before Coding

- Which auth/DB provider: Supabase (fastest to stand up RLS + storage + auth together) vs. self-managed Postgres + custom auth?
- SMS provider for billing reminders (or email-only for v1)?
- Do you want a free trial period before the ₹10,000 onboarding charge, or payment required before first login to the dashboard?
