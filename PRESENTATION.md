# IIIT-BH Mess Management: 10 minute talk and demo

Speaking notes for the IWT lab presentation. Render URL: ________________

## Before you start (5 min)

1. **Restart the server** so it runs the latest code: Ctrl+C in its terminal, then `npm start`.
2. **Demo locally, not on Render.** Production mode hides the demo accounts and the demo clock, and the clock is how you show the 9 AM and 5 PM cut-offs. Open the Render URL 2 minutes early so the free plan wakes up, and mention it as "also deployed".
3. **Do one full dry run.** Then click "Reset demo data" on the admin Overview so you start clean.
4. **Prepare for trouble.** Zoom the browser to about 120% for the projector, and keep a screen recording as backup. The local demo needs MongoDB running but no internet.

## Timeline

| Time | Part |
| --- | --- |
| 0:00 to 1:00 | Problem |
| 1:00 to 2:30 | Architecture and IWT concepts |
| 2:30 to 7:30 | Live demo |
| 7:30 to 9:00 | Under the hood |
| 9:00 to 10:00 | Limits and wrap-up |

## 0:00 to 1:00: Problem

Say: "IIIT-BH has three messes with different payment rules, and today it is manual. I built one system for all three."

- **First Floor:** weekly coupons (breakfast ₹20, lunch ₹55, dinner ₹45), minimum ₹432 a week. A missed coupon can be covered by an advance booking: lunch ₹60 by 9 AM, dinner ₹55 by 5 PM.
- **Ground Floor and P Block:** ₹17,000 a semester with fingerprint entry.
- **Who gets which:** 1st year must use P Block, 2nd year must use Ground Floor. 3rd and 4th year and staff choose.

## 1:00 to 2:30: Architecture and concepts

Say: "The frontend is exactly three files, as the brief asked: index.html, style.css, script.js. I added a Node and MongoDB backend so data persists and the rules cannot be bypassed from the browser console."

Draw this: `Browser (3 files) -> fetch JSON -> Express REST API -> MongoDB`

Adjust this table to your lab's experiment list:

| Concept | Where |
| --- | --- |
| Semantic HTML5, forms, input types, `<dialog>` | index.html |
| Flexbox, grid, media queries (960/760/480), keyframes, CSS variables, print stylesheet | style.css |
| DOM, event delegation, async/await with fetch (AJAX), JSON | script.js |
| Hash-based single page routing | script.js |
| Client and server validation | script.js and server |
| localStorage (demo clock) | script.js |
| Cookies and sessions, REST methods, status codes | server |

## 2:30 to 7:30: Demo

Demo passwords are `demo123`, and `admin123` for the mess office. The sign-in page has one-click buttons.

### 1. P Block, semester plan (1:15)

- Show the 3D hero on the sign-in page (Three.js and GSAP). Click "1st year, fee due".
- Say that 1st year is forced to P Block.
- Open My mess and click Pay. Type `abc` as the UPI ID to show validation, then use `sneha@oksbi`. Show the receipt with its order number.
- Hold the fingerprint pad to enrol.

### 2. First Floor coupons and cut-offs (1:30)

- Sign out, then click "4th year, First Floor, no coupons".
- Tap 3 meals to show the ₹432 meter and the disabled Pay button.
- Click the "Lunch and dinner" preset (₹700) and pay with card `4242 4242 4242 4242`, `12/39`, `123`.
- On the Advance booking tab, click the clock chip and choose "9:05 AM after lunch cut-off". Today's lunch is closed.
- Choose "8:55 AM before lunch cut-off". Book today's lunch for ₹60 and pay.

### 3. Kiosk (0:50)

- Sign out and click "Mess office". Set the clock to "1:00 PM lunch".
- Open Kiosk, then P Block, and pick Sneha. Hold the pad: Verified. Hold again: Already served.
- Choose "Unregistered finger": not recognised.
- Open the First Floor counter and enter `B523033`: Booking accepted. Enter it again: Already redeemed.

### 4. Admin dashboard (1:00)

- Overview: tiles, footfall chart, recent orders.
- Orders: search "Sourav" and click an order number. Show line items, contact, payment reference, and the CSV export.
- Bookings: filter by status.
- Members: open Sourav's profile (email, phone, registered, last sign-in, orders, bookings).
- Say: "What students did two minutes ago is already stored in MongoDB."

When you finish, click the clock chip and choose "Use live time".

## 7:30 to 9:00: Under the hood

- **Server owns the rules.** The ₹432 minimum, cut-offs and plan locks are enforced in the API. Time is computed on the server in IST, so changing the browser clock cannot cheat. The demo clock only works when `ALLOW_DEMO_CLOCK=true`.
- **No double spending.** MongoDB unique indexes and atomic updates stop double purchases and double scans. 5 simultaneous identical purchases were tested and exactly one succeeded.
- **Security:**
  - Passwords are hashed with scrypt.
  - The sign-in is a random token in an httpOnly cookie, and only its hash is stored.
  - There is a strict Content Security Policy and a login rate limit.
  - The card number and CVV are never stored, only the last 4 digits.
- **Open these 3 spots if asked, and read them first:**
  - the `api()` function in [public/script.js](public/script.js)
  - `assertCouponPurchase` in [server/rules.js](server/rules.js)
  - `bookingOpen` in [server/time.js](server/time.js)

## 9:00 to 10:00: Limits and wrap-up

- **Simulated parts:** fingerprint and payments. A real scanner would call the same kiosk API with a finger ID.
- **Deployment:** the app is deployed on Render with MongoDB Atlas.
- **Next steps:** a payment gateway, scanner hardware, password reset, and automated tests.

## Likely questions

- **"Why not 3 files?"** The frontend is exactly 3 files. The backend and database were added so data persists.
- **"Where is validation?"** In both places. The browser gives instant feedback and the server (zod) is the authority.
- **"Is the fingerprint real?"** No, it is a simulated hold-to-scan pad. Say so up front.
- **"Admin password?"** In production it comes from the `ADMIN_PASSWORD` environment variable.

## Don't say

- Don't say "real-time". The admin pages refresh when you load or filter them.
- Don't say "real payments" or "real fingerprint".
- Don't claim you understand code you haven't read. Spend 15 minutes reading the three spots above, because your teacher is likely to ask about them.
