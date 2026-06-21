# MadeNews Server — Technical Architecture Report

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [Application Bootstrap](#4-application-bootstrap)
5. [Middleware Layer](#5-middleware-layer)
6. [Routing Architecture](#6-routing-architecture)
7. [Service Layer](#7-service-layer)
8. [Prompt Engineering Architecture](#8-prompt-engineering-architecture)
9. [Content Moderation Pipeline](#9-content-moderation-pipeline)
10. [Weekly Refresh Pipeline](#10-weekly-refresh-pipeline)
11. [Email Verification Flow](#11-email-verification-flow)
12. [Firestore Data Model](#12-firestore-data-model)
13. [Frontend & Public Assets](#13-frontend--public-assets)
14. [Deployment](#14-deployment)
15. [Environment Variables](#15-environment-variables)
16. [Known Issues & Technical Debt](#16-known-issues--technical-debt)

---

## 1. Project Overview

MadeNews is a satirical AI-powered news generation server. It exposes a REST API that uses a large language model (Groq-hosted `llama-3.3-70b-versatile`) to produce structured satirical news articles. The system supports:

- **On-demand generation**: A caller supplies a topic; the server returns a generated satire article.
- **Character-mode generation**: Articles are narrated through one of 10 fixed character personas (e.g. Trump-style, Gen Z, Wall Street Guru).
- **Weekly batch generation**: A cron-triggered endpoint generates 5 articles per category across 5 predefined categories (25 articles total), persists them to Firestore, and serves them to clients on demand.
- **Email verification**: JWT-based email verification flow tied to a Firestore `users` collection.

The server is designed to be deployed as a Vercel serverless function but runs equally well as a standalone Node.js process.

---

## 2. Technology Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Runtime | Node.js | — | Server runtime |
| HTTP Framework | Express | ^5.1.0 | Routing, middleware, request handling |
| LLM Provider | Groq API | REST (via axios) | `llama-3.3-70b-versatile` inference |
| HTTP Client | axios | ^1.9.0 | All outbound HTTP to Groq |
| Database | Firebase Firestore | firebase-admin ^13.4.0 | Persistent article + user storage |
| Auth SDK | Firebase Admin | ^13.4.0 | Firestore + Auth access |
| Email Transport | Nodemailer | ^7.0.5 | Sending verification emails via SMTP |
| Token Auth | jsonwebtoken (JWT) | (unlisted — see §16) | Verification token signing/verification |
| Environment | dotenv | ^16.5.0 | `.env` loading |
| Cross-origin | cors | ^2.8.5 | CORS headers |
| Deployment | Vercel | vercel.json v2 | Serverless deployment target |
| Scheduling | node-cron | ^4.0.7 | (declared but not actively used in code) |
| CSS Tooling | clean-css, html-minifier-terser, terser | various | Asset optimization (declared, not wired) |

---

## 3. Repository Structure

```
made-news-server-main/
├── server.js                   # Process entry point — binds Express app to port
├── app.js                      # Express app factory — registers all middleware and routes
├── refreshWeekly.js            # Standalone weekly generation function (legacy, buggy — see §16)
├── categories.json             # Static category definitions (5 entries with prompt + label)
├── vercel.json                 # Vercel serverless deployment config
├── package.json
│
├── routes/
│   ├── newsRoutes.js           # /api/* — on-demand generation + weekly article reads
│   ├── publicRoutes.js         # Unprotected routes: homepage, /story/random, /verify/:token
│   ├── emailRoutes.js          # /api/email/* — send + check email verification
│   └── cronRoute.js            # /cron/refreshWeekly — triggers batch generation
│
├── services/
│   ├── firebaseAdmin.js        # Firebase Admin singleton initializer
│   ├── SatireService.js        # Core LLM orchestration and generation logic
│   ├── weeklyPostsStorageServices.js  # Firestore read/write for weekly batch
│   └── emailVerificationService.js    # Full JWT email verification lifecycle
│
├── prompts/
│   ├── SystemPromptsManager.js # Persona registry + random/ID selection
│   ├── restrictionsPrompt.js   # Hard content restrictions injected on every call
│   ├── situationalPrompt.js    # Default satirical tone and style guidelines
│   ├── formatPrompt.js         # Output format rules (title + 3 paragraphs)
│   └── characterFormatPrompt.js # Character-mode format rules
│
├── middleware/
│   └── authMiddleware.js       # x-api-key header enforcement for protected routes
│
├── config/
│   └── email.js                # Legacy Nodemailer transporter (not actually used — see §16)
│
├── utils/
│   ├── promptValidation.js     # Regex + obfuscation-aware banned keyword filter
│   ├── escapeHtml.js           # XSS-safe HTML entity encoder
│   ├── formatResponse.js       # Uniform { success, message, data } envelope
│   └── dateHelpers.js          # ISO week calculation helpers (unused in routes — see §16)
│
├── public/
│   ├── index.html              # Marketing landing page
│   ├── script.js               # Client-side scroll animation + download handler
│   ├── styles.css              # Full landing page design system
│   ├── story.css               # Two-column story display layout
│   └── fonts.css               # Google Fonts Rubik import
│
└── templates/
    └── story.html              # Server-rendered story page template ({{TITLE}}, {{BODY}})
```

---

## 4. Application Bootstrap

### `server.js`

The process entry point. Its sole job is to conditionally start the HTTP listener — the `require.main === module` guard means the file can also be `require()`-d by Vercel without spawning a listener.

```
server.js
  └─ require('./app')  →  app.js (Express app instance)
       └─ app.listen(3000)   [only when run directly]
```

### `app.js`

The Express application factory. Responsibilities in registration order:

1. **Static file serving** — `express.static('./public')` serves the landing page and assets before any middleware runs.
2. **Body parsers** — `express.json` and `express.urlencoded` both with a 10 MB limit, covering both JSON APIs and potential form submissions.
3. **CORS** — wildcard origin (`*`), GET and POST only, `Content-Type` and `Authorization` allowed headers.
4. **Auth middleware** — `authMiddleware` runs on every request after CORS (see §5).
5. **Route mounting**:
   - `publicRoutes` — mounted at `/` (no prefix), must come before auth-gated routes since the middleware check happens before route matching
   - `/api/email` → `emailRoutes`
   - `/api` → `newsRoutes`
   - `/cron` → `cronRoute`

**Startup side effect**: `require('./services/firebaseAdmin')` is called in `app.js` at module load time, which triggers the Firebase Admin singleton initialization before any request arrives.

---

## 5. Middleware Layer

### `middleware/authMiddleware.js`

A single middleware function applied globally. Logic:

```
Request arrives
  → Is path in PUBLIC_PATHS?
      YES → next()  (no auth required)
      NO  → Does header x-api-key === process.env.APP_API_KEY?
              YES → next()
              NO  → 401 { success: false, error: "Unauthorized access" }
```

**Public paths** (bypass auth entirely):
- `/story/random`
- `/style.css`, `/script.js`, `/app-logo.png`, `/instagram.png`, `/favicon.ico`
- `/verify` (prefix match — covers `/verify/:token`)

Everything else — including `/api/*`, `/cron/*`, and `/` (root) — requires the `x-api-key` header. This means the homepage (`GET /`) is also behind the API key wall at the middleware level, though `publicRoutes` serves it. In practice the static file middleware for `index.html` fires before the auth middleware processes the route, so the landing page is still reachable.

---

## 6. Routing Architecture

### `routes/newsRoutes.js` — mounted at `/api`

| Method | Path | Handler summary |
|---|---|---|
| GET | `/api/generate` | On-demand story generation. Reads `?title=` and optional `?satireStyle=`. Calls `generateSatireStory`. |
| GET | `/api/generate/random` | Generates a story with a self-chosen topic. Calls `generateRandomStory`. |
| GET | `/api/weeklyArticles` | Reads the `weekly_posts/weekly_posts` Firestore document and returns `data.articles`. |

**`/api/generate` flow**:
- Missing `title` → 400
- `satireStyle` present → passes it as `satireType` to `generateSatireStory` (character mode)
- `satireStyle` absent → passes `null` (default mode, random persona selected)
- `result.error` truthy → 500 with LLM error message
- Success → 200 with full story object spread into response

### `routes/publicRoutes.js` — mounted at `/`

| Method | Path | Handler summary |
|---|---|---|
| GET | `/story/random` | Generates a random story and renders it into `templates/story.html` via string replacement |
| GET | `/refreshWeekly` | **Calls the buggy `refreshWeekly.js` module directly** (see §16) |
| GET | `/verify/:token` | Delegates to `emailVerificationService.verifyEmail(token)`, returns raw service result |
| GET | `/` | Serves `public/index.html` |

**`/story/random` rendering pipeline**:
1. Calls `generateRandomStory()` → gets `{ title, paragraphs[] }`
2. Reads `templates/story.html` synchronously via `fs.readFileSync`
3. Replaces `{{TITLE}}`, `{{DESCRIPTION}}` (first paragraph), `{{BODY}}` (all paragraphs wrapped in `<p>` tags)
4. All substitution values pass through `escapeHtml` before insertion (XSS protection)
5. Sends rendered HTML string

### `routes/emailRoutes.js` — mounted at `/api/email`

| Method | Path | Handler summary |
|---|---|---|
| POST | `/api/email/send-verification` | Validates `userId` from body, calls `emailVerificationService.sendVerificationEmail` |
| GET | `/api/email/is-verified/:uid` | Calls `emailVerificationService.isUserVerified`, returns boolean via `formatResponse` |

### `routes/cronRoute.js` — mounted at `/cron`

| Method | Path | Handler summary |
|---|---|---|
| GET | `/cron/refreshWeekly` | Triggers full batch generation across all 5 categories, awaits Firestore write, returns 200 |

This is the correct, fixed implementation of the refresh flow. It awaits `generateAll()` fully before sending the response (see §10 for full pipeline).

---

## 7. Service Layer

### `services/firebaseAdmin.js` — Firebase Singleton

Uses the standard `admin.apps.length` guard to ensure `admin.initializeApp()` is called exactly once regardless of how many modules `require` it. This is critical in serverless environments where module-level state can persist between warm invocations.

The service account JSON is read from the `GCP_SERVICE_KEY` environment variable as a raw JSON string, parsed at runtime. This avoids committing credentials to source and works cleanly with Vercel's environment variable system.

```js
if (!admin.apps.length) {
  serviceAccount = JSON.parse(process.env.GCP_SERVICE_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
```

Throws eagerly at startup if the variable is missing or malformed, failing fast before any request can arrive.

---

### `services/SatireService.js` — Core LLM Orchestration

This is the most complex module. It manages all interaction with the Groq inference API.

#### Module-level state

```js
const usedTitles = new Set();
```

A process-lifetime Set that accumulates generated titles. Passed as `disallowedTitles` to each subsequent call within a batch to prevent duplicate headlines. **Important caveat**: this Set is never cleared between HTTP requests, so across multiple `/cron/refreshWeekly` invocations in the same process lifetime, the exclusion list grows unboundedly.

#### `generateSatireStory(prompt, disallowedTitles, satireType)`

The core generation function. Full execution path:

**1. Mode resolution**
```
satireType !== null  →  isCharacterMode = true
                         systemPrompt = promptManager.getPromptById(satireType)
satireType === null  →  isCharacterMode = false
                         systemPrompt = promptManager.getRandomPrompt()
```

**2. Message stack construction**

The Groq API receives a multi-system-message array. Order matters — later messages can reinforce earlier ones:

```
Character Mode OFF:
  [system: restrictionsPrompt]
  [system: situationalPrompt]
  [system: formatPrompt]
  [system: selectedPersona.prompt]
  [user: userPrompt]

Character Mode ON:
  [system: restrictionsPrompt]
  [system: characterFormatPrompt]
  [system: selectedPersona.prompt]
  [user: userPrompt]
```

`restrictionsPrompt` always leads. This ensures content policy rules are the first context the model receives, before any style or persona instructions that might conflict.

**3. User prompt construction**

```
{topic}

Avoid using any of these topics or people: {title1}, {title2}, ...   ← omitted if no exclusions

Format strictly:
<One-line title>

<Three standalone paragraphs separated by a blank line>
```

**4. Pre-flight validation**

`validatePromptOrThrow(prompt)` runs before the API call. If it throws (banned keyword detected), the error propagates into the catch block where `NO_GO_AREA_DETECTED` is handled.

**5. Groq API call parameters**

| Parameter | Character mode | Default mode |
|---|---|---|
| `model` | `llama-3.3-70b-versatile` | `llama-3.3-70b-versatile` |
| `temperature` | 0.88 | 0.70 |
| `top_p` | 0.9 | 0.9 |
| `max_tokens` | 1000 | 1100 |

Character mode uses slightly higher temperature (more expressive, personality-driven output). Default mode uses lower temperature for more controlled deadpan delivery.

**6. Response parsing**

```
raw string
  → split on /\n\s*\n/   (blank-line delimiter)
  → first segment  → titleLine (trimmed)
  → remaining segments joined → content
  → content split on /\n\s*\n/  → paragraphs[]
```

Validation: requires `finalTitle` to be non-empty and `paragraphs.length >= 2`. Failure throws `"Incomplete model response"`.

**7. Sentinel check**

If the model's response starts with `NO_GO_AREA_DETECTED`, it means the model itself flagged the topic (via the restrictions prompt instructing it to emit this sentinel). This is caught and re-thrown into the catch block.

**8. Return shape**

```js
{
  title: string,
  paragraphs: string[],
  appGenerated: false,      // always false here; set to true in batch pipeline
  createdAt: ISO8601 string,
  satireStyle: string | null
}
```

**9. Error handling**

Three distinct error categories returned (not thrown) to callers:

| Condition | Return value |
|---|---|
| `NO_GO_AREA_DETECTED` | `{ error: true, message: "🚫 ..." }` |
| HTTP 429 from Groq | `{ error: true, rateLimited: true, message: "Rate limit reached." }` |
| All other failures | `{ error: true, message: "We're having technical difficulties..." }` |

---

#### `generateRandomStory()`

Thin wrapper. Sends a self-directed prompt:
```
"Write a new MadeNews satire story. Generate a fresh satirical topic on your own."
```
No `disallowedTitles`, no `satireType`. The model selects both topic and persona randomly.

---

#### `generateWeeklyCategoryStories(category, count = 5, customPrompt = null)`

Batch generation loop for a single category.

```
for i in 0..count-1:
  prompt = customPrompt || "Write a MadeNews satire story in the category: {category}."
  result = await generateSatireStory(prompt, usedTitles)

  if result.rateLimited:
    wait 60 seconds
    result = await generateSatireStory(prompt, usedTitles)   ← one retry

  if result has title + paragraphs:
    add title to usedTitles
    push article to articles[]
  else:
    warn and skip

  if not last iteration:
    wait 5 seconds   ← inter-request throttle
```

The 5-second inter-request delay is a proactive TPM (tokens-per-minute) throttle to avoid hitting rate limits in the first place. The 60-second retry handles cases where the throttle wasn't enough.

---

### `services/weeklyPostsStorageServices.js`

Minimal Firestore access layer. Uses a single named document (`weekly_posts/weekly_posts`) as a singleton store for the entire article batch — not a collection of documents, but one document whose `articles` field holds the entire categorized map.

```
Collection: weekly_posts
  Document: weekly_posts
    articles: {
      "Politics": [ { title, content, createdAt, appGenerated, category }, ... ],
      "Aliens": [...],
      "Education": [...],
      "Technology": [...],
      "Conspiracies": [...]
    }
    updatedAt: ISO8601 string   (JS Date — not server timestamp)
    createdAt: FieldValue.serverTimestamp()
```

Note the asymmetry: `updatedAt` uses `new Date().toISOString()` (client-generated), while `createdAt` uses `FieldValue.serverTimestamp()` (server-generated). On every `saveWeeklyArticles` call, `docRef.set()` replaces the entire document — there is no partial update or merge.

---

### `services/emailVerificationService.js`

A class-based service exported as a singleton instance (`module.exports = new EmailVerificationService()`).

Full lifecycle methods:

| Method | Purpose |
|---|---|
| `generateVerificationToken(userId, email)` | Signs a JWT with 5-minute expiry |
| `extractEmailFromUid(userId)` | Reads `users/{userId}` from Firestore, returns `email` field |
| `sendVerificationEmail(userId)` | Full send flow (see §11) |
| `verifyEmail(token)` | Validates JWT, checks Firestore record, marks user verified |
| `isUserVerified(userId)` | Reads `users/{userId}.emailVerified`, cleans up verification record if true |
| `resendVerificationEmail(userId)` | Rate-limited (2-minute cooldown) resend |
| `getVerificationStatus(userId)` | Returns composite status object from both collections |
| `cleanupExpiredVerifications()` | Batch-deletes expired, unverified records |

JWT payload structure:
```js
{
  userId,
  email,
  type: "email_verification",
  iat: unix_seconds,
  exp: iat + 300   // 5 minutes
}
```

Both the JWT expiry and a separate `expiresAt` Firestore timestamp are checked during verification. The token string itself is also compared (`verificationData.token !== token`) as an additional binding check to invalidate tokens superseded by a resend.

---

## 8. Prompt Engineering Architecture

### `prompts/SystemPromptsManager.js`

The persona registry. Implements a `SystemPromptManager` class with:

- An internal array of 10 persona definitions
- `getRandomPrompt()` — picks a random persona, but uses a `usageHistory` Set to avoid repeating recently used ones. When all personas have been used, the history resets.
- `getPromptById(id)` — direct lookup by persona ID string

**10 defined personas:**

| ID | Character | Absurdity scale |
|---|---|---|
| `nostalgicUncle` | Conspiracy-prone older relative | 7/10 |
| `techBroVisionary` | Silicon Valley evangelist | 8/10 |
| `trumpStyle` | Bombastic political figure | 9/10 |
| `genZ` | Chronically online Gen Z | 8/10 |
| `globalDiplomat` | Overly diplomatic ambassador | 7/10 |
| `prManager` | Corporate spin doctor | 7/10 |
| `gossipAunt` | Small-town gossip | 8/10 |
| `wallStreetGuru` | Finance bro | 9/10 |
| `hollywoodProducer` | Delusional entertainment exec | 9/10 |
| (9th entry) | (varies) | — |

Each persona definition includes: name, absurdity scale, personality traits, characteristic speech patterns, and specific forbidden behaviors to maintain internal consistency.

A singleton `promptManager` is exported:
```js
module.exports = { promptManager: new SystemPromptManager() };
```

---

### Prompt Stack Breakdown

#### `restrictionsPrompt.js`

The content firewall. Injected first in every request. Instructs the model to:
- Never generate sexual, violent, hateful, or self-harm content
- Never produce real misinformation about real people
- Emit the string `NO_GO_AREA_DETECTED: "{topic}"` if the request violates any rule

This sentinel is checked in `generateSatireStory` before parsing, allowing the model itself to act as a second-layer content filter after the server-side `validatePromptOrThrow`.

#### `situationalPrompt.js`

Tone and conceptual guidelines for standard (non-character) mode:
- Escalate human ego and institutional absurdity
- Deadpan delivery — treat ridiculous premises as factual reporting
- Fake expert quotes stated with complete authority
- Invented statistics presented as gospel
- Surrealist escalation across paragraphs

#### `formatPrompt.js`

Output structure enforcement for standard mode:
- One-line title followed by exactly 3 paragraphs
- Blank line separating each paragraph
- No HTML, no Markdown, no formatting characters
- Corporate-sincere dialogue
- Increasingly absurd paragraph escalation

#### `characterFormatPrompt.js`

Character mode format rules override the standard format prompt:
- 3 paragraphs of 4–6 sentences each
- Opens with an in-character memory or hot take
- Contains off-topic tangents consistent with the persona
- Ends with a character-specific punchline
- Absolute zero self-awareness — the character never breaks frame

---

## 9. Content Moderation Pipeline

The system uses a two-layer moderation architecture: server-side regex before the LLM call, and model-side sentinel after.

### Layer 1 — `utils/promptValidation.js` (server-side, pre-call)

Runs synchronously before any API request is made.

**Mechanism**:

1. **Keyword list** — ~40 banned terms across categories: sexual/abuse, hate speech, violence/terror, suicide/self-harm, drugs/illegal activity, cults.

2. **Pattern compilation** — Each keyword is converted to a `RegExp` that allows arbitrary non-word characters between letters:
   ```js
   keyword → escaped → spaces replaced with [\s\W_]* → wrapped in \b...\b with 'i' flag
   ```
   This catches `"mass shooting"` as well as `"mass-shooting"` or `"mass  shooting"`.

3. **Obfuscation patterns** — 7 additional hardcoded patterns specifically targeting character-substitution obfuscation (e.g. `r4pe`, `r-a-p-e`):
   ```js
   /r[\W_]*a[\W_]*p[\W_]*e/i
   /p[\W_]*e[\W_]*d[\W_]*o/i
   // etc.
   ```

4. **Throw behavior** — On match, throws `Error("NO_GO_AREA_DETECTED: User tried topic ...")`. This propagates into `generateSatireStory`'s catch block where it is recognized by the `startsWith("NO_GO_AREA_DETECTED")` check and returned as a user-facing error object rather than an internal error.

### Layer 2 — Model sentinel (post-call)

The `restrictionsPrompt` instructs `llama-3.3-70b-versatile` to emit `NO_GO_AREA_DETECTED` if the topic violates policy. After receiving the raw response, `generateSatireStory` checks:
```js
if (raw.startsWith("NO_GO_AREA_DETECTED")) { throw new Error(raw); }
```
This catches cases where the prompt itself passed validation but the model's interpretation of it raised a flag.

---

## 10. Weekly Refresh Pipeline

The full execution path for `GET /cron/refreshWeekly`:

```
cronRoute.js: GET /cron/refreshWeekly
  │
  └─ await generateAll()
       │
       ├─ For each of 5 categories (sequential, not parallel):
       │    │
       │    └─ generateWeeklyCategoryStories(category, 5, customPrompt)
       │         │
       │         ├─ For each of 5 stories (sequential):
       │         │    ├─ Build prompt string
       │         │    ├─ await generateSatireStory(prompt, usedTitles)
       │         │    │    ├─ validatePromptOrThrow()
       │         │    │    ├─ POST https://api.groq.com/openai/v1/chat/completions
       │         │    │    └─ Parse response → { title, paragraphs, ... }
       │         │    │
       │         │    ├─ [if rateLimited] await delay(60_000) → retry once
       │         │    │
       │         │    ├─ [if success] push to articles[], add title to usedTitles
       │         │    └─ [if not last] await delay(5_000)
       │         │
       │         └─ return articles[]
       │
       ├─ categorizedArticles = { Politics: [...], Aliens: [...], ... }
       │
       └─ await saveWeeklyArticles(categorizedArticles)
            └─ Firestore: weekly_posts/weekly_posts.set({ articles, updatedAt, createdAt })

  └─ res.status(200).json({ success: true })   ← only after full pipeline completes
```

**Timing characteristics** (worst case, no rate limiting):
- 5 categories × 5 stories = 25 LLM calls
- 5-second inter-story delay × (5-1) gaps per category × 5 categories = 100 seconds of enforced delay
- Plus actual LLM inference time (typically 2–5 seconds per call at 70B scale)
- Total worst case: ~200–325 seconds for a clean run

With a rate-limit retry, add 60 seconds per triggered retry.

**`categories.json` schema**:
```json
{
  "prompt": "string — custom generation instruction passed to the LLM",
  "category": "string — label used as Firestore key and article metadata"
}
```

---

## 11. Email Verification Flow

### Send Flow

```
POST /api/email/send-verification  { userId }
  │
  ├─ Validate userId (non-empty string)
  │
  └─ emailVerificationService.sendVerificationEmail(userId)
       ├─ Read users/{userId} from Firestore → get email, username
       ├─ Check userData.emailVerified → throw if already verified
       ├─ jwt.sign({ userId, email, type, exp: now+300 }, JWT_SECRET)
       ├─ Write email_verifications/{userId}:
       │    { email, token, sentAt, expiresAt: now+5min, verified: false, attempts: 0 }
       ├─ Construct verificationUrl: ${SERVER_URL}/verify/${token}
       └─ transporter.sendMail() → HTML email with verify button + raw link
```

### Verify Flow

```
GET /verify/:token
  │
  └─ emailVerificationService.verifyEmail(token)
       ├─ jwt.verify(token, JWT_SECRET) → decoded { userId, email, type }
       ├─ Check decoded.type === "email_verification"
       ├─ Read email_verifications/{userId} from Firestore
       ├─ Check: record exists, not already verified, not expired, token matches stored token
       ├─ Update email_verifications/{userId}: { verified: true, verifiedAt, attempts++ }
       └─ Update users/{userId}: { emailVerified: true, emailVerificationDate }
```

### Check Flow

```
GET /api/email/is-verified/:uid
  │
  └─ emailVerificationService.isUserVerified(uid)
       ├─ Read users/{uid}.emailVerified
       ├─ If true: delete email_verifications/{uid} (cleanup)
       └─ Return boolean
```

**Security properties**:
- Token is short-lived (5 min JWT expiry)
- Expiry is doubly enforced: JWT `exp` claim + Firestore `expiresAt` field
- Token binding: stored token must match the presented token (invalidates superseded tokens from resends)
- Resend rate-limited to once per 2 minutes
- Token type field prevents token reuse across different flows

---

## 12. Firestore Data Model

### Collection: `users`

```
users/{userId}
  email: string
  username: string
  emailVerified: boolean
  emailVerificationDate: Timestamp | null
```

### Collection: `email_verifications`

```
email_verifications/{userId}
  email: string
  token: string           (full JWT string)
  sentAt: Timestamp
  expiresAt: Date
  verified: boolean
  attempts: number
  lastAttemptAt: Timestamp
  verifiedAt: Timestamp   (added on verification)
```

### Collection: `weekly_posts`

```
weekly_posts/weekly_posts
  articles: {
    [category: string]: Array<{
      title: string
      content: string           (paragraphs joined with \n\n)
      createdAt: ISO8601 string
      appGenerated: true
      category: string
    }>
  }
  updatedAt: string             (client ISO8601)
  createdAt: Timestamp          (server timestamp)
```

---

## 13. Frontend & Public Assets

### `public/index.html`

Static marketing landing page. Sections:
- **Hero**: App logo, tagline, description, APK download button
- **How it works**: 3-step explainer
- **Satire styles**: Grid of 6 character type cards
- **Testimonials**: Dark-background social proof section
- **CTA**: Final download prompt

No client-side framework. Pure HTML/CSS with `script.js` for progressive enhancement.

### `public/script.js`

Three behaviors:
1. **IntersectionObserver scroll reveals** — Elements with `.animate-on-scroll` gain `visible` class when entering viewport at 0.1 threshold, triggering CSS transitions.
2. **Ripple effect** — Click on `.ripple-btn` spawns an absolutely positioned `span` that expands and fades via CSS animation.
3. **APK download handler** — Button with `#downloadBtn` triggers a blob download from a hardcoded APK URL.

### `templates/story.html`

Server-side rendered template (not a client-side framework). Uses three `{{PLACEHOLDER}}` tokens replaced via `String.replace()` in `publicRoutes.js`:
- `{{TITLE}}` — article headline
- `{{DESCRIPTION}}` — first paragraph (used for meta description and Open Graph)
- `{{BODY}}` — all paragraphs as `<p>` elements

Includes Open Graph meta tags for social sharing previews.

### CSS Architecture

| File | Scope |
|---|---|
| `styles.css` | Full landing page — gradient design system, animations, responsive grid |
| `story.css` | Story display page — 30/70 sidebar/content split, mobile stacking |
| `fonts.css` | Rubik (300–900 weight) from Google Fonts |

---

## 14. Deployment

### `vercel.json`

```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}
```

All routes are rewritten to `server.js`. Vercel wraps it as a Node.js serverless function. The `require.main === module` guard in `server.js` ensures `app.listen()` is not called in the serverless context (Vercel handles port binding externally).

**Serverless caveats**:
- The `usedTitles` Set in `SatireService.js` is module-level state. In a warm Lambda/serverless invocation it persists; in a cold start it resets. This makes the deduplication behavior non-deterministic across invocations.
- The `/cron/refreshWeekly` endpoint takes 200–325+ seconds. Vercel's default function timeout is 10 seconds (Hobby plan) / 60 seconds (Pro plan) / 900 seconds (Enterprise). Without a Vercel Pro or Enterprise plan, this endpoint will time out before completion.
- `node-cron` (declared in `package.json`) requires a persistent process to fire scheduled jobs. In a stateless serverless environment, cron jobs do not run — the `/cron/refreshWeekly` route is designed to be triggered externally (e.g. by a cron service like cron-job.org, EasyCron, or GitHub Actions on a schedule).

---

## 15. Environment Variables

| Variable | Used in | Purpose |
|---|---|---|
| `GROQ_API_KEY` | `SatireService.js` | Groq API authentication |
| `GCP_SERVICE_KEY` | `firebaseAdmin.js` | Firebase service account JSON (full JSON as string) |
| `JWT_SECRET` | `emailVerificationService.js` | JWT signing secret |
| `EMAIL_SERVICE` | `emailVerificationService.js` | Nodemailer service name (e.g. `"gmail"`) |
| `EMAIL_USER` | `emailVerificationService.js` | SMTP sender address |
| `EMAIL_PASSWORD` | `emailVerificationService.js` | SMTP password / app password |
| `SERVER_URL` | `emailVerificationService.js` | Base URL for verification link (e.g. `https://your-domain.vercel.app`) |
| `APP_API_KEY` | `authMiddleware.js` | Secret key required in `x-api-key` header |

---

## 16. Known Issues & Technical Debt

### Critical

**Duplicate `/refreshWeekly` route with buggy implementation**

`publicRoutes.js` registers `GET /refreshWeekly` and calls the `refreshWeekly.js` module directly. That module still contains the original argument-order bug: it passes `categoryObject.prompt` as `category` and `categoryObject.category` as `count`. Since `count` receives a string like `"Politics"`, the loop condition `0 < "Politics"` is `false` and the loop never executes — every category returns an empty array and empty records are saved to Firestore.

The correct implementation lives in `cronRoute.js` at `GET /cron/refreshWeekly`. The `publicRoutes.js` route should either be removed or updated to call `cronRoute`'s `generateAll` function.

**`jsonwebtoken` not in `package.json`**

`emailVerificationService.js` calls `require('jsonwebtoken')` but `jwt` is not listed in `package.json` dependencies. It works if `jsonwebtoken` happens to be a transitive dependency of another package, but this is fragile. It should be added explicitly: `npm install jsonwebtoken`.

### Moderate

**`usedTitles` Set grows unboundedly**

The module-level `usedTitles` Set in `SatireService.js` is never cleared. Across multiple batch runs in the same process lifetime, the exclusion list passed to each `generateSatireStory` call grows indefinitely. This increases prompt size over time and may degrade generation quality or hit token limits on very long-lived processes.

**`@tensorflow-models/toxicity` and `@tensorflow/tfjs` declared but unused**

These are listed in `package.json` dependencies but are not imported anywhere in the codebase. Together they add significant bundle weight (~50–100 MB of model weights). They should be removed unless TensorFlow-based toxicity classification is planned.

**`utils/dateHelpers.js` exports unused functions**

`getLastWeekId`, `getCurrentWeekId`, and `isNewWeek` are not imported by any route, service, or middleware. They appear to be leftovers from an earlier week-based rotation design.

**`config/email.js` exports an unused transporter**

`emailRoutes.js` imports from `config/email.js` but never uses the imported `transporter`. `emailVerificationService.js` creates its own internal transporter using environment variables. The `config/email.js` transporter has hardcoded Ethereal test credentials and should be removed to avoid confusion.

### Minor

**`publicRoutes.js` imports `refreshWeekly` and `getFirestore` unnecessarily**

`const { getFirestore } = require("firebase-admin/firestore")` and `const db = getFirestore()` are imported at the module level in `publicRoutes.js` but `db` is never used in any handler. Dead code.

**`emailRoutes.js` has `dotenv.config` without call parentheses**

Line: `const dotenv = require("dotenv"); dotenv.config` — missing `()`. The call is a no-op. Environment variables work because `dotenv.config()` is correctly called in `SatireService.js` and `emailVerificationService.js`, which load before this route in practice.

**`app.js` comment misleads about route order**

The comment `// Should be above auth-protected` next to `publicRoutes` registration is correct in intent but misleading in mechanism — `publicRoutes` being registered first does not bypass the global `authMiddleware` that runs before route matching. The actual bypass happens in `authMiddleware` via the `PUBLIC_PATHS` allowlist. The comment should clarify this distinction.
