# Voice agent (Kannada / Hindi / English)

A Pro-plan feature. A **Speak** button appears at the top (in the dashboard header, right before **Kitchen Display**; clients not on a voice plan see it locked and it opens the Billing tab)
- in the **client dashboard** (owner / staff),
- on the **customer table page** (after the guest enters the menu).

## Turn it on
(To just see it while testing, set `VOICE_FORCE_ENABLE=1` and restart: it shows for every restaurant. Remove it before going live.)
1. Render > Environment: set `GEMINI_API_KEY` (free, from aistudio.google.com/apikey) **or** `AI_API_KEY` (paid Anthropic key). If both are set, Gemini is used. Optional: `GEMINI_MODEL`, `VOICE_AI_MODEL`, `VOICE_DAILY_LIMIT`.
2. Super Admin > Plans: a **Pro** plan (₹999, voice agent included) is added automatically the first time the app starts. Edit its price or text any time. To use another plan instead, edit it and tick **Voice agent included**. Every client on that plan gets it.
   Clients on other plans (including the free trial) do not see the mic and the API refuses their calls.

## What the owner can say
Add / change price / sold-out / delete dishes, add categories, move an order to preparing / served,
create / switch / delete offers, add tables. Deleting and price changes always ask "yes / no" first.
Not available by voice: payments, billing, taxes, subscription, plans, other restaurants.

## Hands-free mode (owner dashboard)
Tap the mic once and keep giving commands one after another; it listens again by itself after each one.
Say **"finish"** (or "done", "bas", "khatam", "ಮುಗಿಯಿತು", "बस") to stop. It also switches itself off after 3 quiet minutes,
and keeps the phone screen awake while it is on. Delete and price changes still ask yes / no (say "yes" / "haan" / "ಹೌದು").
Customers keep tap-per-command so background chatter at a table can't trigger anything.

## What the customer can say
Search and ask about the menu, add / remove / change quantity in the cart, open the cart, place the order
(always after the guest says or taps yes). No payment, no bills, no owner actions.

## Safety and cost
- Owner calls require the restaurant login; customer calls are limited to that restaurant and table.
- The AI can only point at dishes / orders / offers that exist (short refs like i3), never invent ids.
- Per-restaurant daily limit (`VOICE_DAILY_LIMIT`, default 400) and a per-device throttle.
- Speech recognition and spoken replies use the phone's own engine (free). Works best in Chrome (Android/desktop);
  Safari/iPhone may lack Kannada voice or recognition, in which case typing still works.
