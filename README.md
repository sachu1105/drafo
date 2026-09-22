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

```bash
cp .env.example .env
docker compose up
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

That is the whole setup. Then:

- Architect: <http://localhost:3000/login>
- Django admin: <http://localhost:3000/django-admin/>

The admin is mounted at `/django-admin/` in Django itself, not `/admin/`, so
that it matches the path the frontend proxies it under. Django builds its own
links from its mount point: if the two disagree, the index page loads and
every link on it 404s.

`createsuperuser` will ask for an email and a practice name; there is no
username field.

### Accounts

Professionals — architects, engineers, designers — can request an account at
`/register`. **Clients cannot and must not.** A client arrives on `/p/<token>`
and is asked for nothing.

Registration is approval-gated. A new account is created with
`is_active=False`, so it exists but cannot sign in; every active superuser is
emailed, and the account appears at the top of the Architects list in the
admin marked `PENDING APPROVAL`. Select it and run **"Approve selected
accounts"** — they are emailed and can sign in immediately.

Self-registered accounts are never staff and never superusers: `create_user`
refuses both, the registration serializer cannot set them, and the profile
endpoint cannot either. Three tests hold that line, because a public form that
can grant Django admin access is the one mistake here that would be
catastrophic.

Signed-in professionals edit their own practice name, phone and logo at
`/profile`. That is a private settings page, not a profile in the directory
sense — there is no discovery anywhere in this product, by design.

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
- The architect's practice name sits at the top of every client screen, and
  the browser tab says the project name. Our name appears nowhere the client
  can see it.

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

One small VPS is plenty (Hetzner CX22 or similar, roughly €5–10/month).

- Caddy in front for automatic TLS.
- Gunicorn instead of `runserver`, `DJANGO_DEBUG=0`, a real `SECRET_KEY`.
- Swap `STORAGES` to Cloudflare R2 — S3-compatible, no egress fees, which
  matters because clients open the same drawings repeatedly.
- `pg_dump` to object storage nightly. These drawings are someone's house;
  losing them is not recoverable.
- Remove the `ports:` mapping from the `db` service.

## Definition of done

A real architect can, unaided: sign in, create a project, upload a floor plan,
send the link on WhatsApp, and see the approval — with its date and time —
after a client who installed nothing and created no account opened it on their
phone, typed their name once and tapped Approve. Then upload a revision, and
watch version 1 keep its approval while version 2 becomes current.

Ship that. Put it in front of two architects. Build nothing else until they
have used it on a live project.
