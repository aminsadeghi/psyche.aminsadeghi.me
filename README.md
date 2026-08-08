# psyche.aminsadeghi.me — The Psyche

The **Inner World** site of the [Three Worlds collection](https://aminsadeghi.me/PROJECT-SCOPE.md):
**psychology, read as story** — the mind and the self as case files.

Same architecture as The Archives, The Mirage, and The Mythos: a Cloudflare Worker
(`src/index.js`) that renders the homepage menu server-side and routes the reader
pages, over static JSON content in `public/data/`.

## Structure

```
src/
  index.js     Worker: /case-file/<slug>/<page> routing, /sitemap.xml, homepage render
  layout.js    the reader-page HTML template + JSON-LD
public/
  index.html   homepage (left menu + right dashboard)
  all.html     "Complete Works" print view (noindex), built from the data
  data/
    catalog.json   series list + every case and its metadata
    series-1.json  each case's pages (inline HTML content)
  favicons, site.webmanifest, robots.txt, amin-sadeghi-256.jpg
wrangler.json  Worker config (route: psyche.aminsadeghi.me)
```

Content is **inline HTML in the JSON** (the house pattern across the collection —
`content` holds `<p>…</p>` with key phrases in `<strong>`). No build step.

## Add a case (a piece)

1. Add a case object to `cases` in `public/data/catalog.json`:
   `{ "id", "slug", "seriesId", "title", "tagline", "status", "pageCount", "nodes" }`
   (`nodes` = three `{ image, label }` thumbnails for the homepage board; optional to start).
2. Add the body under `public/data/series-1.json` → `cases["<slug>"].pages[]`, one object
   per page: `{ page, slug, title, date (DD/MM/YYYY), description, content }`.
   `pages.length` must equal `pageCount`.
3. Thumbnails (if using nodes): `public/images/thumbs/<id>.{1,2,3}.webp`.

## Run / deploy

This is a Cloudflare Worker, so the homepage menu and the `/case-file/` reader only
render fully under the Worker runtime (`wrangler dev` / deploy). The static homepage
also works on its own — it falls back to fetching `/data/catalog.json` client-side.

Deploy the same way as the sibling sites (Cloudflare Workers Builds on push).
**Committing/pushing is left to you.**

## Homepage art (thumbnails + video)

- **Thumbnails (the 3-node board):** each case's `nodes` point at three images. The
  first case expects `public/images/thumbs/1.1.jpg`, `1.2.jpg`, `1.3.jpg` — **add your
  own files there** (until you do, those three slots show a broken-image icon). Naming
  convention: `<caseId>.{1,2,3}.jpg`.
- **Per-series background video (desktop):** drop `public/video/series-1.mp4` and the
  homepage plays it behind the board for that series' cases. Missing = plain dark
  background (fails gracefully). Path is relative (`/video/series-N.mp4`), so it works
  locally and in production.

## To-dos before launch

- The favicons and `amin-sadeghi-256.jpg` are copied from The Archives as placeholders — swap if you want a distinct Psyche identity.
- Add a site-verification file (the Archives' `BingSiteAuth.xml` was **not** copied — generate a fresh one if needed).
- Theme is the shared navy + gold. If you'd like The Psyche to carry the Inner-World amethyst accent instead, say so — it's a small change in `layout.js` + `index.html`.
- The top-right **World Map** button loads from `aminsadeghi.me/menu.js` (already wired with `?project=psyche`); it appears once that file is deployed on aminsadeghi.me.
