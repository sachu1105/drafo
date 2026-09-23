# Drafo

A private portal an architect shares with one client for one project.

It exists to fix four specific failures of running a project on WhatsApp and
Google Drive:

1. **Approvals evaporate.** The client approves a drawing in a voice note and
   denies it six months later. Drafo records approvals with a name and a
   timestamp, and never lets that record be edited.
2. **Five PDFs are all called "plan".** Drawings live in named sets with
   numbered revisions. The current one is unmistakable; the old ones stay.
3. **Material choices scatter.** Tiles, sanitary, switches and paint go in one
   list the client can still find a year later.
4. **Invoicing slips.** Payment milestones are written down, so asking for
   money stops being a conversation the architect has to start from nothing.

**The timestamped approval record is the product.** Everything else supports
it.

## The one constraint that shapes everything

| | Architect | Client |
|---|---|---|
| Account | email + password | **none, ever** |
| Way in | `/login` | a long unguessable link |
| Can do | create projects, upload drawings, log materials and milestones | view, approve, comment |

The client is often 50+, sometimes abroad, and has no interest in learning
software. A signup screen shown to a client kills the product — they will say
"just send it on WhatsApp" and the architect stops paying. Nothing in this
codebase may ever ask a client to create an account.

## Running it

Compose runs Postgres and Django. The frontend is run on the host, because a
Next dev server watching files across a bind mount is slower to reload for no
benefit.

```bash
cp .env.example .env
docker compose up                                         # db + backend
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser

cd frontend && npm install && npm run dev                  # in its own terminal
```

That is the whole setup. Then:

- Architect: <http://localhost:3000/login>
- Django admin: <http://localhost:3000/django-admin/>

Nothing has to be configured to join the two up: `next.config.ts` falls back to
`http://localhost:8000`, which is where Compose publishes the backend.

The frontend image is still defined in `docker-compose.yml`, behind a profile,
so that it keeps being built and tested — `docker compose --profile frontend up`
runs everything in containers instead. Do that before a deploy, since that is
the arrangement production uses.

The admin is mounted at `/django-admin/` in Django itself, not `/admin/`, so
that it matches the path the frontend proxies it under. Django builds its own
links from its mount point: if the two disagree, the index page loads and
every link on it 404s.

`createsuperuser` will ask for an email and a practice name; there is no
username field.

### Accounts

Everyone who designs and builds — architects, civil and structural engineers,
contractors, interior designers — can create an account at
`/register`. **Clients cannot and must not.** A client arrives on `/p/<token>`
and is asked for nothing.

Registration is open. Four fields — name, practice, email, password — and the
server opens the session as it creates the account, so they land on `/projects`
without a second trip through the login form. There is no approval queue: it
does not survive the first fifty sign-ups, since someone has to be awake to let
each person in, and it guards nothing — a new account is empty, owns no
projects and can reach nothing but its own. Suspending an account from the
admin is the one switch left, and it is for abuse.

Self-registered accounts are never staff and never superusers: `create_user`
refuses both, the registration serializer cannot set them, and the profile
endpoint cannot either. A test holds that line, because a public form that can
grant Django admin access is the one mistake here that would be catastrophic.

### Confirming an email address

Nothing in the product is gated on a confirmed address, and nothing should be.
It exists because every notification — a client approval, a comment — goes to
that address, and an address with a typo in it fails silently forever.

So it is an offer, on the profile screen, taken up when the person feels like
it. **Send confirmation link** emails a `TimestampSigner` token, good for 24
hours, that lands on `/verify-email` and stamps `email_verified_at`. There is
no token table: the link has to survive a round trip through an inbox and come
back self-describing, and a signed string does that without rows to create,
index and sweep. The address is signed in beside the id, so a token stops
working the moment the address it was issued for changes.

`/verify-email` asks for no session on purpose — mail apps open links in their
own browser, which is rarely the one holding the session. The signed token
names the account, so it authenticates itself.

The admin shows the result as a tick in the Architects list, which answers the
only question ever asked of it: are they getting our mail.

Signed-in professionals edit their own details at `/profile`. Three panels,
one of them folded shut, because this is a page somebody visits twice: once on
their first day and once when they change their phone number.

| Panel | Holds |
|---|---|
| **You** | photo, name, profession, about, phone, location, website, email |
| **Your practice** | folded to a sentence saying what it is for; opens to practice name and logo |
| **Your card** | cover image, the publish switch, the link |

The fold is not decoration. "Your practice" as a bare heading above two fields
is a thing people have to open to understand, so shut it says what it does —
*your clients see "X" at the top of every page you share with them* — and a
**Change** button opens it. It springs open on its own if a save comes back
with an error inside it, because an error in a shut panel is an error nobody
can read.

The panels separate two things the first version of this screen ran together:

| | What it is | Where it shows |
|---|---|---|
| **You** | name, profession, photo, a few lines about yourself | your card |
| **Your practice** | practice name and logo | the top of every client page, and your card |
| **Your card** | a cover image, the link, and whether it is published | your card |

A one-person studio types the same words into both. A practice with three
architects does not, and a client looking at a drawing needs a human name to
put against it. `full_name` falls back to `practice_name` wherever a person is
named, so an account that never fills it in behaves exactly as it did before.

That page is still private settings. There is no directory and no discovery
anywhere in this product.

### Invoices and estimates

An architect raises a bill from the Payments tab, under the payment stages —
"what have I billed" and "what am I owed" are the same question, so they are on
the same screen. Lines are picked from the project's milestones and priced
materials, or typed by hand, and each carries its own tax rate: a design fee at
18% and a reimbursed printing charge at nil go on the same bill routinely.

**An estimate and an invoice are one model with two number series.** `EST-0001`
and `INV-0001`, both per practice rather than per project, because a client
asking "which invoice is this" needs an answer unique across the business.
Converting an accepted estimate copies its lines into a new invoice and leaves
the estimate standing — the client was sent a URL showing an estimate, and that
URL has to keep showing the estimate they agreed to.

**The invoice is a stamp, not a view.** The practice name, its billing address
and GSTIN, the client's details and the terms are all *copied* onto the invoice
when it is raised, and never refreshed. If they rendered from the live profile,
moving office next year would silently restate every invoice already issued,
including ones a client has paid and filed. For the same reason
`InvoiceLine.tax_percent` stores the number rather than pointing at `TaxRate`:
an invoice raised at 18% still says 18% after the slab changes.

**Lines are copied from milestones and materials, never linked to them.** A
stage agreed at ₹20,000 being billed at ₹18,000 this month is ordinary, and a
builder that wrote the ₹18,000 back into the project would corrupt the plan the
client agreed to. The `milestone` and `material` foreign keys exist only so the
picker can say a stage has been billed already, and are `SET_NULL` so deleting
a milestone never deletes the invoice that billed for it.

**Totals are summed from the lines every time, never stored.** A stored total
that disagrees with its own lines is the worst thing an invoice can do, and the
only way to guarantee it cannot happen is to have nowhere to keep the
disagreement. The API refuses a posted total for the same reason.

**Each invoice carries its own token**, at `/i/<token>` — not the project's.
Sending somebody a bill must not hand them the drawings. A draft returns 404 on
that link until it is sent, so a bill can be built over two sittings without a
client refreshing into a half-finished document.

**There is no PDF renderer.** The invoice page *is* the PDF: it is laid out for
A4 in the print stylesheet and the browser's own engine writes the file. A
server-side renderer would be a second implementation of the same document,
with its own fonts and its own bugs, and the day the two disagree is the day a
client is holding a PDF that says something the page does not.

**Tax settings are per practice, not per install.** GSTIN, billing address,
bank details, default rate and terms live on the architect's profile under
Billing, because GST registration is a fact about a business. Only the rate
*card* — the slabs offered in the dropdown — is shared, as `TaxRate` rows in the
admin beside Units.

### The profile card

`/c/<slug>` is the one page here that anyone may open — a digital business
card: photo, name, profession, practice, phone, email, location, website, and
a **Save to contacts** button that hands over a vCard. It exists because a
link is a better business card than a business card: it cannot be lost, and it
drops straight into the recipient's phone.

It is **off until it is switched on**. Every account gets a slug at creation,
derived from its name, but `card_is_public` defaults to `False` and stays
there until the architect ticks the box. A card that is off, one whose account
was suspended, and one that never existed all return the same 404.

Nothing about any project is on it. `ProfileCardSerializer` names its fields
explicitly, and a test asserts that no project name, client name or access
token appears in the response.

**The cover is not the logo.** `cover` is its own field, and the two are not
interchangeable:

| | `logo` | `cover` |
|---|---|---|
| What it is | a mark | a photograph |
| Where | client-page header, a chip on the card's band | the band across the top of the card |
| Drawn | `object-contain`, max 28px tall, on its own | `object-cover`, full bleed, cropped to 3:1 |
| Limit | 2 MB, SVG allowed | 6 MB, no SVG |

A logo has to survive being small, alone and often transparent; a cover gets
cropped to a strip. Pointing one file at both jobs is how a wordmark comes out
as a smear, which is exactly what happens if you upload a skyline as a logo.

The card is laid out the way everyone already reads a profile:

```
┌──────────────────────────────────────┐
│░░░░ cover band, 3:1 ░░░░░░░  ┌──────┐│  logo rides on the band, on its
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ logo ││  own paper chip -- straight over
│░░░░░░┌────────┐░░░░░░░░░░░░░ └──────┘│  a photograph it is legible or
├──────│portrait│──────────────────────┤  not depending on the photograph
│      └────────┘                      │
│  Name                                │
│  Profession                          │
│  Practice                            │
│  About…                              │
├──────────────────────────────────────┤
│ PHONE · EMAIL · WEBSITE · LOCATION   │
└──────────────────────────────────────┘
```

The band is **always drawn**, photograph or not — with no cover it is a flat
brand-coloured band, so the layout never rearranges itself depending on which
pictures happen to have been filled in. The portrait needs `position: relative`
to sit on top of it; the band is positioned, so a static sibling paints
underneath.

Changing the slug breaks every card already handed out, so the page says so
next to the box and the slug is never rewritten automatically when a name
changes.

### Without Docker

Two terminals, no environment variables needed.

```bash
# backend -- falls back to SQLite at backend/dev.sqlite3
cd backend && python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # .venv/bin/python on macOS/Linux
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py createsuperuser
.venv/Scripts/python manage.py runserver

# frontend -- proxies /api to localhost:8000
cd frontend && npm install && npm run dev
```

**The two setups do not share a database.** Compose injects `DATABASE_URL`
from `.env` and you get Postgres in the `pgdata` volume; a bare `runserver`
sets nothing and you get a SQLite file. Your account and projects exist in
whichever one you created them in. Django itself never reads `.env` —
`env_file:` is a Compose feature — so set `DATABASE_URL` explicitly if you
want a local run to talk to Postgres.

Since production is Postgres, do the final pre-deploy pass under
`docker compose`, not SQLite.

**Keep the frontend on port 3000.** If 3000 is busy, Next silently falls back
to 3001 and two things break quietly: architect login fails CSRF, because
`CSRF_TRUSTED_ORIGINS` only trusts port 3000, and the Share tab prints a link
on the wrong port, because `PUBLIC_BASE_URL` says 3000. Free the port rather
than working on 3001.

Set `API_PROXY_TARGET` to point the frontend at a backend somewhere else.

## Tests

```bash
docker compose exec backend python manage.py test portal
cd frontend && npm run typecheck && npm run build
```

The backend suite is narrow on purpose. It covers the things that would end
the business if they broke: one architect reading another architect's project,
a wrong token revealing that a project exists, an approval that does not stick
or that a new revision silently erases, and a file that is really an
executable in a PDF's clothing.

## How it is put together

```
backend/config/     Django settings, URLs, WSGI
backend/portal/     the entire domain, one app
frontend/src/app/p/[token]/   the client view -- the screen that sells this
frontend/src/app/(architect)/ the architect's side
frontend/src/app/c/[slug]/    the profile card -- the only public page
```

Three URL namespaces, and which one a request is on is meant to be obvious
from its path alone:

```
/api/...             architect, session required
/api/p/<token>/      client, the token is the whole credential
/api/card/<slug>/    public, one architect's own card and nothing else
```

**One Django app.** Eight models: `Architect`, `Project`, `DrawingSet`,
`DrawingVersion`, `Approval`, `Comment`, `Material`, `Milestone`. The domain is
small; splitting it into apps would cost more than it returns.

**Two auth paths that never meet.** The architect gets a Django session. The
client gets nothing at all: every client endpoint lives under
`/api/p/<access_token>/`, and a permission class resolves that token to a
project. A token that does not resolve returns **404, never 403** — a wrong
token must not confirm that anything exists.

**Immutability where it matters.** `DrawingVersion` is never updated or
deleted. `Approval` cannot be created, changed or deleted through the API by
anyone, and is registered view-only in the admin. A second approval on the
same revision (a double tap on a slow connection) returns the existing record
rather than writing another.

**Files are never linked directly.** There is no `MEDIA_URL` and no public
media route. Every file goes out through a view that re-checks the token, so a
copied file URL is worthless on its own. `portal/storage.py` is the seam:
moving to Cloudflare R2 or S3 is a change to `STORAGES` in settings and
nothing else.

**Previews.** A 12 MB PDF in an iframe is unreadable on a phone, so page one is
rasterised at upload (`portal/previews.py`, via `pypdfium2` — permissive
licence, no system packages) and the client is shown that. The original stays
one tap away. A failed preview never fails an upload.

**The frontend proxies `/api` to Django** rather than calling it cross-origin.
The session cookie is then same-origin, CSRF is unremarkable, and every path
the API returns works unchanged in the browser. Note `skipTrailingSlashRedirect`
and the `(.*)` rewrite capture in `next.config.ts`: without both, Next strips
the trailing slash Django requires and every browser POST dies mid-flight.

**The client view renders on the server** so it arrives complete on a phone on
3G, with no spinner and no second round trip.

## Design

The customers are architects. They judge typography and spacing before they
judge features.

- Two families: Instrument Serif for display, Inter for text.
- Near-monochrome on warm off-white, one restrained accent, used for approval
  state and nothing else.
- The drawings are the only things on screen with visual weight.
- Animation is opacity and a 4px translate, under 200ms. Nothing bounces.
- **A material is several pictures, not one.** A tile is a colour, a finish, an
  edge, and how it reads laid across a whole floor, and one photograph answers
  about one of those. `MaterialPhoto` rows hang off the material in an explicit
  order, up to eight; the first is the thumbnail everywhere. The client swipes
  through them in the card with native scroll snapping, with dots underneath —
  a photograph that fills the frame gives no clue that three more are behind
  it, and the row carries a count badge for the same reason.
- **Units are a table, not an enum.** A material's price is quoted per
  something, and this trade has a long tail of it — per running foot, per bag,
  per brass. `Unit` rows are edited in the admin under **Units**, so adding one
  never needs a deploy; untick Active to retire one without losing the
  materials priced in it. `Material.unit` stays free text and is deliberately
  *not* a foreign key: the list is a set of suggestions, an architect typing
  something nobody anticipated must never be stopped, and nothing in the admin
  can rewrite a unit already recorded against a material.
- **A material can carry its invoice.** The photos are what the tile looks
  like, `invoice` is what was paid for it — a PDF an ImageField will not take,
  and the one a client is actually looking for a year later. Served through the
  same token-checked view as everything else, so the bill is no more public
  than the drawings.
- **Notes are announced where they can be seen.** A note lives against a
  revision, on the drawing page. The client's overview shows the count on the
  row, because otherwise the architect writes one, the client never opens that
  drawing, and it is never read.
- **The client's page shows the drawing.** A page about drawings whose rows
  are filenames and a chevron is a list of filenames. Each row carries the
  generated preview and a visible `Review & approve`, because the one thing
  the whole product asks anyone to do was previously a text link with no
  affordance, read on a phone by someone who was sent it on WhatsApp.
- **One offer per screen.** A tab shows its "Add" button *or* an empty state
  with one button in it, never both; the project header hides "Share with
  client" while you are on the Share tab. Every place the product offered the
  same action twice, it was because two people added a button to the same
  screen a month apart.
- **A tab is its own heading.** The Materials tab does not also print
  "Materials" and a sentence explaining what materials are. Copy written for
  somebody's first visit is still on screen at their four hundredth.
- **Forms share one bed.** `components/architect/Form.tsx` holds the twelve
  column grid, the labelled field, the money input and the actions row. Three
  add-forms grew up separately and drifted to two, three and one column
  layouts with three different paddings; nothing is laid out by hand any more.
- **A disabled primary is an outline, not a ghost.** At 40% opacity a filled
  button is a grey slab that reads as broken rather than as not-yet.
- The architect's practice name sits at the top of every client screen, and
  the browser tab says the project name. Our name appears nowhere the client
  can see it — including on the profile card.
- The card is one component, rendered twice: the live preview on `/profile`
  and the public page at `/c/<slug>`. A preview that could drift from what was
  published would be worse than no preview.
- `html, body { overflow-x: clip }` in `globals.css`, **not** `hidden`.
  Both stop the client's phone scrolling sideways, but `hidden` makes the
  element a scroll container, and a scroll container is what `position: sticky`
  sticks inside — so with `hidden` every sticky panel on the site silently
  stops sticking. If sideways scroll ever reappears, fix the element that
  overflows; do not change this back. The same rule bites the other way on a
  tab strip: setting `overflow-x` makes the browser compute `overflow-y` to
  `auto`, so one pixel of vertical overflow — a `-mb-px` on a tab button, say
  — earns a vertical scrollbar beside four tabs. Put the rule on a wrapper and
  the negative margin on the strip.

### Two themes

Every colour in the product is a CSS variable, defined twice in
`globals.css` — once for light, once for dark — and named in
`tailwind.config.ts`. **There is no `dark:` prefix anywhere in the codebase**,
and that is the point: a component asks for `bg-card` and gets the right
surface for whichever theme is on. A codebase where half the colours switch by
themselves and half need a prefix is one where somebody always forgets the
prefix.

The channels are stored bare (`244 243 230`, not `#F4F3E6`) so Tailwind can
compose `rgb(var(--paper) / <alpha-value>)`. That is not a detail: `bg-ink/50`,
`text-sand/85` and `bg-paper/95` are all in use, and a plain `var(--paper)`
would have broken every opacity modifier in the app without an error.

**The dark set is not the light one inverted.** Inverting sage-on-cream gives a
magenta-grey that belongs to nothing, so it is built the same way the light one
was — from the same four source colours, lit from the other side. Two
relationships reverse and both matter: a card is *lighter* than the page in
both themes but for opposite reasons, and the brand steps *up* rather than down,
because Ocean Deep is a button on cream and a bruise on charcoal. Hover goes
lighter in the dark theme, since on a dark ground "brighter" is what "pressed"
looks like. Contrast ratios are held where the light theme holds them.

The choice is light, dark or **follow the system**, and the third is the
default — somebody whose laptop turns dark in the evening has already said what
they want. An inline script in `<head>` applies it before the first paint,
which is the one place a blocking script earns its keep: the alternative is a
cream page repainted black a moment later.

Two things deliberately do not follow the theme. `sheet` is true white in both,
because a drawing is ink on white paper and showing one on a dark ground is
showing a different drawing. And printing overrides the palette to black on
white whatever is on screen — nobody wants a dark-mode invoice through a laser
printer.

## Non-goals

Not built, deliberately, and not to be added without a reason that traces back
to one of the four failures above:

marketplace or directory · client accounts of any kind · payment gateway ·
websockets, push, presence · Celery, Redis, workers · PDF annotation or
pin-on-drawing comments · 3D, IFC, DWG, BIM, AI · teams, roles, permissions
matrices · mobile apps · analytics dashboards · custom domains, white-label,
dark mode · i18n · subscription billing

If one of these starts to feel necessary, the scope has drifted.

## Deployment

Frontend on Vercel, backend and database on one small droplet. **One git
repository, not two** — `docker-compose.yml` builds both folders and both read
the same root `.env`, so splitting them breaks local development for no gain.
Each platform is pointed at the subdirectory it needs.

The browser only ever talks to the Vercel domain. Next rewrites `/api`,
`/static` and `/django-admin` through to the droplet, which is what keeps the
session cookie same-origin — see *The one constraint that shapes everything*.
Drawings are streamed under `/api`, so they ride the same proxy and need no
separate rewrite or public bucket.

### Droplet

`docker-compose.prod.yml` is the production stack: Postgres, gunicorn, and
Caddy for automatic TLS. It is not the dev file with flags changed — it drops
the source bind-mounts, stops publishing Postgres to the host, and restarts on
reboot.

```bash
git clone https://github.com/<you>/drafo.git && cd drafo
cp .env.example .env          # then edit it, see the table below
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend   python manage.py createsuperuser
```

`migrate` and `collectstatic` run on every start, so a deploy is
`git pull && docker compose -f docker-compose.prod.yml up -d --build`.

Point `BACKEND_HOST`'s DNS A record at the droplet **before** first start, or
Caddy's certificate request fails and it will back off before retrying.

### Vercel

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework | Next.js (detected) |
| `API_PROXY_TARGET` | `https://<BACKEND_HOST>` |

Set an Ignored Build Step so backend-only commits do not rebuild the frontend:

```bash
git diff --quiet HEAD^ HEAD -- .
```

Vercel ignores `frontend/Dockerfile`; that file is only for local compose, and
it runs `npm run dev`, which is not a production server.

### The `.env` on the droplet

Everything below is wrong by default and will fail in a way that is obvious
only in production.

| Variable | Why it matters |
| --- | --- |
| `DJANGO_DEBUG=0` | Defaults to `1`. Secure cookies, HSTS and the proxy TLS header all live behind `if not DEBUG`. |
| `DJANGO_SECRET_KEY` | Sessions and signed tokens depend on it. Generate a fresh one. |
| `DJANGO_ALLOWED_HOSTS` | Must contain `BACKEND_HOST`, or every request 400s. |
| `CSRF_TRUSTED_ORIGINS` | Must contain the **Vercel** origin, not the droplet's. Miss this and sign-in fails CSRF while GETs look fine. |
| `PUBLIC_BASE_URL` | The Vercel origin. Client links are built from it, so if it is wrong every WhatsApp link points at localhost. |
| `BACKEND_HOST` | Bare hostname, no scheme. Caddy requests the certificate for it. |
| `POSTGRES_PASSWORD` | Not `changeme`. |

### Before you call it live

- [ ] `https://<BACKEND_HOST>/django-admin/` loads **with styling**. Unstyled
      means `collectstatic` or WhiteNoise is not working.
- [ ] Sign in on the Vercel domain. This is the CSRF and cookie path in one.
- [ ] Upload a PDF, open the client link in a private window, tap Approve.
- [ ] `docker compose -f docker-compose.prod.yml ps` shows `db` healthy and no
      published port on it.

### Still outstanding

- Swap `STORAGES` to Cloudflare R2 — S3-compatible, no egress fees, which
  matters because clients open the same drawings repeatedly. Until then
  `./media` on the droplet is the only copy of every drawing.
- `pg_dump` to object storage nightly. These drawings are someone's house;
  losing them is not recoverable.

## Definition of done

A real architect can, unaided: sign in, create a project, upload a floor plan,
send the link on WhatsApp, and see the approval — with its date and time —
after a client who installed nothing and created no account opened it on their
phone, typed their name once and tapped Approve. Then upload a revision, and
watch version 1 keep its approval while version 2 becomes current.

Ship that. Put it in front of two architects. Build nothing else until they
have used it on a live project.
