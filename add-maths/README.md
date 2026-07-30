---
title: "AlphaMath CSEC Additional Mathematics — Sanitized Reviewer Demonstration"
status: "review-ready-with-optional-evidence-api"
version: "addmaths-review-1.0.0-20260730"
created: "2026-07-30"
privacy: "sanitized public demonstration"
---

# AlphaMath CSEC Additional Mathematics — Sanitized Reviewer Demonstration

This repository contains the static reviewer interface plus an optional Node evidence API for PostgreSQL.

## Privacy and content boundary

- No real student identity, roster mapping, submitted response, or saved learner record is committed.
- `REVIEW-DEMO` is a fictional interface identifier.
- Interactive work remains in the reviewer’s browser unless a tutor explicitly connects the evidence API and submits it.
- PostgreSQL credentials never enter browser code.
- The tutor access token is entered at run time and retained only for the current browser tab.
- The tutorial and simulated exam use tutor-authored bridge questions only.
- Reproduced CSEC past-paper questions are intentionally excluded.
- CSEC® and CXC® are referenced only to describe curriculum alignment. This demonstration is not affiliated with or endorsed by CXC.

## Evidence workflow

1. Intake records self-assessed topic states and confidence-drop notes.
2. Tutorial practice remains a local draft until a named tutor reviews at least one attempted item.
3. A simulated exam must be submitted and locked before it can be stored or reviewed.
4. Tutor reviews record item outcomes, feedback, verified syllabus codes, and an explicit overall decision.
5. The dashboard reads the learner’s linked record from PostgreSQL.
6. Completion never creates mastery. Only a named tutor can submit `mastery_confirmed`.

## Static pages

- `index.html` — review entry point
- `intake.html` — syllabus-aligned intake and explicit database submission
- `learning-path.html` — illustrative mastery pathway
- `tutorial.html` — tutorial plus human-review checkpoint
- `simulated-exam.html` — locked exam attempt plus human-review checkpoint
- `dashboard.html` — PostgreSQL-backed learner evidence view
- `math-input.html` — local math-entry prototype

## Intake formula cards

Each intake card places its short, plain-language description directly below
the syllabus-coded title. Formula-bearing topics then provide a compact
popover containing only centered, consistently typeset KaTeX statements, one
relationship per row. A comma links a descriptor to its abbreviation or
mathematical symbol (for example, “Interquartile range, \(IQR=\cdots\)”); a
colon introduces a natural-language result. Redundant leading labels are
suppressed.

KaTeX and its fonts are bundled under `assets/vendor/katex/`, so formulas render without a CDN. Concept-only topics do not display a formula panel, and topics for which the syllabus requires comparison rather than calculation state that boundary explicitly.

## Local database and API

Prerequisites: Node 20+ and PostgreSQL.

```sh
createdb alphamath
npm install
DATABASE_URL=postgresql://localhost/alphamath npm run db:migrate
```

Generate a long token locally, then start the API without committing the value:

```sh
export DATABASE_URL=postgresql://localhost/alphamath
export ALPHAMATH_API_TOKEN="$(openssl rand -hex 32)"
export ALLOWED_ORIGINS=http://127.0.0.1:8765,https://barbadosmike.github.io
npm start
```

Serve the static pages separately:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/dashboard.html`, enter the API address, and enter the token created in the same terminal session.

## Hosted deployment

GitHub Pages can host only the static files. Deploy `server/` to a Node-capable host with:

- `DATABASE_URL`
- `ALPHAMATH_API_TOKEN`
- `ALLOWED_ORIGINS=https://barbadosmike.github.io`
- `PORT` supplied by the host

Then set `apiBase` in `assets/js/runtime-config.js` to the HTTPS API origin. Do not place the token or a database connection string in that file.

For real student use, replace the shared tutor-token mechanism with per-user authentication and role-based authorization before collecting personally identifiable information.

## Verification

```sh
npm test
node tools/qa-static.mjs
```

The automated contract tests cover intake submission, tutorial review, locked exam submission, exam review, dashboard aggregation, CORS, and authentication.
