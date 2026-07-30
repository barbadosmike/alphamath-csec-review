---
title: "AlphaMath CSEC Additional Mathematics Redesign — Implementation and Reproduction Guide"
document_type: "implementation-summary"
status: "review-ready"
version: "1.0.0"
date_created: "2026-07-30"
audience:
  - "Marion Sydney Enterprises"
  - "AlphaMath tutors and reviewers"
  - "Claude.ai and other authorized AI collaborators"
privacy_classification: "sanitized reviewer documentation"
curriculum: "CSEC Additional Mathematics, syllabus amended 2020"
delivery_mode: "static-first web suite with optional Node/PostgreSQL evidence service"
---

# AlphaMath CSEC Additional Mathematics Redesign

## Executive summary

The Additional Mathematics materials have been rebuilt as a seven-page,
responsive learning and evidence suite that mirrors the current AlphaMath CSEC
Mathematics experience while retaining the Additional Mathematics learning
plan, syllabus structure, and human-tutor decision model.

The result is not a cosmetic copy. The visual system, navigation, three-state
intake, KaTeX formula popovers, local autosave, tutorial review workflow,
simulated-exam workflow, PostgreSQL evidence path, and dashboard have been
carried over. The content, learning sequence, mastery rules, calculator
conditions, and evidence boundaries have been reworked for Additional
Mathematics.

The reviewer build is deliberately sanitized. It contains no real learner
identity, contact detail, roster mapping, submitted learner response, or
reproduced past-paper question. `REVIEW-DEMO` is a fictional interface
identifier.

## Deliverables

| Deliverable | Purpose |
|---|---|
| `index.html` | Suite landing page and navigation hub |
| `intake.html` | Four-section, 85-code intake with three explicit states |
| `learning-path.html` | Personalized priority sequence and mastery evidence rules |
| `tutorial.html` | Six-session quadratics foundation pathway |
| `simulated-exam.html` | Ten-question, 45-minute tutor-authored checkpoint |
| `dashboard.html` | PostgreSQL-backed intake, tutorial, exam, and review evidence view |
| `math-input.html` | Local image preview and learner-confirmed mathematical input |
| `assets/` | Shared design system, local fonts, KaTeX, MathLive, scripts, and data |
| `server/` | Optional Node evidence API and PostgreSQL repository |
| `test/` | API and contract tests |
| `tools/qa-static.mjs` | Static content, privacy, linking, and curriculum checks |

## Source-of-truth inputs reviewed

The implementation was grounded in the supplied Additional Mathematics
syllabus and the planning documents in the Additional Mathematics folder:

- `CSEC-Additional-Mathematics-Syllabus-Amended-2020.pdf`;
- `Additional Mathematics Tutor.md`;
- `CSEC Additional Mathematics — Engagement Scope.md`;
- `CSEC Additional Mathematics — Track Plan.md`;
- `Past-Paper Index (CSEC Additional Maths).md`;
- the existing Additional Mathematics intake, tutorial, progress, and
  diagnostic interfaces; and
- controlled learner-planning records used only to identify the initial
  instructional sequence.

Controlled records were read as private planning evidence. They were not
copied into the suite.

## Backup and change isolation

The ten editable top-level originals were copied before redesign to:

`Originals_Backup_2026-07-30/`

The backup includes `MANIFEST.sha256`, which records a checksum for every
backed-up file. The redesign is stored in a separate directory, so the original
files remain untouched and can be compared or restored independently.

## Curriculum architecture

The intake retains the established AlphaMath Additional Mathematics coding
contract because those codes already connect plans, tutor records, and
progress evidence.

| Section | Topic groups | Instructional role |
|---|---:|---|
| A1 — Algebra, Sequences and Series | 5 | Algebra spine and first priority |
| A2 — Coordinate Geometry, Vectors and Trigonometry | 3 | Geometric and trigonometric applications |
| A3 — Introductory Calculus | 2 | Highest Paper 2 weighting and second priority |
| A4 — Probability and Statistics | 2 | Data analysis and probability |

The resulting intake contains 12 topic groups and 85 syllabus-coded items.
Kinematics is correctly retained under Section 3 as an application of
differentiation and integration. Section 4 is named Probability and
Statistics.

The 85-code contract sometimes groups closely related syllabus objectives
under a single learner-facing item. That is a deliberate compatibility choice,
not a claim that every code maps one-to-one to every printed syllabus row.

## Personalized instructional sequence

The demonstration begins with the documented algebra priority rather than a
generic survey:

1. A1.2.2 — read maximum, minimum, and range from completed-square form;
2. A1.2.4 — connect the discriminant to the number of real roots and
   x-intercepts;
3. A1.2.3 — connect completed-square form to a fully labelled quadratic
   sketch; and
4. A1.2.6 — extend to the sum and product of roots.

The tutorial contains 20 tutor-authored bridge questions distributed across
six sessions:

1. read the vertex;
2. read maximum, minimum, and range;
3. connect the discriminant;
4. sketch from structure;
5. optional procedural-fluency timing; and
6. a tutor-reviewed transfer checkpoint.

This sequence uses an existing algebra foothold to address the next documented
gap. It then connects representations instead of treating completing the
square, roots, and graphs as unrelated procedures.

## Intake UX and formula design

The intake mirrors the current CSEC Mathematics field-guide pattern:

- cards replace long, uninterrupted checklists;
- each syllabus item offers `Not started`, `Confident`, and `Needs practice`;
- `Not started` is explicitly separated from a weakness or failed skill;
- section progress and a sticky next-flagged-topic action support forward
  momentum;
- the five practice prompts adapt to selected gaps;
- tap targets and layouts are responsive for mobile use; and
- the CSEC Mathematics foundation check is linked when prerequisite fluency
  needs repair.

Each item displays a brief plain-language description below its title.
Formula-bearing items provide an information popover containing one centered,
KaTeX-rendered statement per row. The popover deliberately has no nested
headings. A comma links a descriptor to its abbreviation or mathematical
symbol; a colon introduces a natural-language result. Repetitive leading
descriptors are removed. Concept-only topics do not display a formula icon.

KaTeX, MathLive 0.110.0, the 20 required MathLive WOFF2 files, Lexend, and
Lora are bundled locally. The student-facing experience does not depend on a
CDN.

## Mastery and evidence alignment

The implementation preserves the mastery model documented by AlphaMath:

- at least 80% accuracy;
- at least four authentic Additional Mathematics items;
- correct method where Paper 2 awards method marks;
- at least one clean spaced-retrieval checkpoint;
- bridge questions do not count as authentic mastery evidence;
- completion does not imply mastery;
- self-reported confidence does not imply mastery;
- timing is an advisory pace signal, never a mastery gate; and
- only a named human tutor may record `mastery_confirmed`.

Spaced retrieval is configured for days 2, 7, 14, and 21, with the plan’s
required/desired distinction preserved. A lapse returns the skill to
`not-yet`, routes to a find-the-mistake intervention, and schedules a
three-day retest.

## Tutorial, exam, and dashboard evidence flow

The static client can be used entirely offline for reviewer exploration.
Browser storage preserves drafts. Nothing is sent to PostgreSQL until a tutor
explicitly configures the API address and access token and submits a record.

The optional evidence service supports this sequence:

1. intake submission records self-assessment data;
2. tutorial work remains a draft until tutor review;
3. the simulated exam must be submitted and locked before storage or review;
4. a tutor records item outcomes, feedback, verified syllabus codes, and an
   explicit overall decision; and
5. the dashboard retrieves the linked evidence for a stable external learner
   ID.

Database credentials remain server-side. The browser receives only the API
origin and a run-time tutor token. The shared-token demonstration must be
replaced with individual authentication and role-based authorization before
real student personally identifiable information is collected in a hosted
environment.

## Deliberate deviations and deferrals

### SBA excluded

The scope defers the Paper 031 SBA unless separately approved. No SBA workflow
was added.

### No controlled past-paper content in the reviewer build

The tutorial and simulated exam use newly authored bridge questions. The
supplied past-paper index is treated as a controlled source map, not a license
to publish question text. Authentic, cited items can be assigned privately by
an authorized tutor and may support mastery only after review.

### No automatic pace benchmark

Solve time is captured only as optional advisory telemetry. The supplied
materials do not define a tutor-approved benchmark, so the system does not
label a learner “slow” or use time to change mastery.

### No automated mastery inference

The dashboard can display evidence and human decisions, but it does not infer
mastery from completion, response presence, confidence, or an unreviewed
score.

### Sanitized pathway

The sequence reflects documented instructional priorities while removing the
learner’s identity and private responses. It is therefore a faithful
demonstration of the plan, not a public learner record.

### Corpus integrity safeguard

One supplied past-paper filename and its apparent internal year require source
verification. No item from that file was reproduced or cited in the reviewer
build. An authorized tutor should reconcile the filename, internal paper code,
year, and source before using it as evidence.

## How this improves the previous Additional Mathematics materials

The former materials were useful but fragmented across standalone pages. This
redesign adds:

- consistent navigation from every page;
- one visual and interaction system across intake, pathway, tutorial, exam,
  and dashboard;
- a clear distinction between coverage, confidence, practice need, evidence,
  and mastery;
- explicit privacy and copyright boundaries;
- a local-first draft model;
- connected tutorial and exam review records;
- a PostgreSQL-ready evidence architecture;
- mobile-responsive layouts and larger controls;
- accessible skip links, semantic regions, live status messages, and keyboard
  operability; and
- automated regression checks for counts, codes, privacy, and contracts.

The strongest conceptual improvement is that the suite now represents a
learning system rather than a set of forms. Intake identifies the next
instructional need, the tutorial builds connected understanding, the exam
captures a locked attempt, the tutor evaluates the evidence, and the dashboard
shows the resulting record without allowing any interface action to masquerade
as mastery.

## Local operation

### Static reviewer mode

From the suite directory:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/index.html`.

### Optional PostgreSQL evidence mode

Prerequisites are Node 20 or later and PostgreSQL.

```sh
createdb alphamath
npm install
export DATABASE_URL=postgresql://localhost/alphamath
export ALPHAMATH_API_TOKEN="$(openssl rand -hex 32)"
export ALLOWED_ORIGINS=http://127.0.0.1:8765
npm run db:migrate
npm start
```

Do not commit the generated token or database URL. Enter the API address and
token in the interface only for the current local session.

## Verification

Run:

```sh
npm test
node tools/qa-static.mjs
```

The static QA checks the seven-page navigation, local assets, four sections,
12 topic groups, 85 unique codes, 73 formula guides, 20 tutorial questions,
10 exam questions, the pinned MathLive dependency and 20 local font files,
mastery configuration, YAML frontmatter, and prohibited private-data residues.

Browser QA should additionally confirm:

- every navigation target opens;
- formula popovers render without KaTeX errors;
- the three intake states update the section and total progress;
- the next-flagged-topic action moves focus correctly;
- the tutorial displays all six sessions;
- the exam starts with ten question-navigation controls and a 45-minute timer;
- no horizontal page overflow occurs at approximately 390 × 844 pixels; and
- the dashboard clearly explains API configuration when no server is
  connected.

## Reproduction instructions for AI collaborators

An authorized Claude.ai persona, Codex agent, or other collaborator should
follow this order.

### 1. Establish the content boundary

1. Treat syllabus and planning documents as source material, not as permission
   to publish controlled questions or private learner data.
2. Inventory all source files and classify each as public curriculum,
   internal planning, controlled assessment content, or learner PII.
3. Create a timestamped backup before modifying any original.
4. Generate a SHA-256 manifest for the backup.
5. Work in a new directory.

### 2. Preserve the learning contract

1. Retain the existing `A1.*` through `A4.*` codes unless an explicit migration
   plan updates every dependent record.
2. Verify module placement against the syllabus; do not infer it from a
   filename or a previous interface.
3. Keep `Not started`, `Confident`, and `Needs practice` semantically distinct.
4. Do not convert an untouched topic into a weakness.
5. Keep the initial pathway algebra-first and use the documented priority
   sequence.
6. Route missing CSEC Mathematics prerequisites to foundation repair.

### 3. Preserve the evidence contract

1. Keep local drafts separate from submitted evidence.
2. Lock a simulated exam before review.
3. Require a named human tutor for review and mastery decisions.
4. Do not count tutor-authored bridge items as authentic mastery evidence.
5. Do not use solve time as a mastery gate.
6. Retain syllabus codes on every tutorial and exam instrument.

### 4. Preserve the interface contract

1. Use the shared navigation and design tokens on all seven pages.
2. Show the plain-language explanation below each intake heading.
3. Put only formula statements in the popover.
4. Typeset formula rows with the bundled KaTeX assets.
5. Use a comma for `descriptor, symbol = expression`.
6. Use a colon for `instruction: result`.
7. Suppress a descriptor when the formula already repeats it.
8. Test keyboard, touch, desktop, and mobile interactions.

### 5. Preserve privacy and deployment safety

1. Replace learner identifiers with `REVIEW-DEMO`.
2. Remove names, schools, email addresses, phone numbers, saved responses, and
   roster mappings.
3. Never place a PostgreSQL connection string or API token in browser code.
4. Do not publish authentic question text without verified authority.
5. Run the privacy scan and automated tests before packaging or publishing.

### 6. Validate before handoff

1. Run `npm test`.
2. Run `node tools/qa-static.mjs`.
3. Check every page in a real browser at desktop and mobile widths.
4. Inspect representative early and late formula popovers.
5. Confirm there are no console errors, missing local assets, broken links, or
   horizontal overflow.
6. Re-run the private-data scan after copying the final deliverable.
7. Record any unresolved curriculum or corpus ambiguity as a deferral; never
   fill the gap with invented data.

## Handoff rule

Future revisions should preserve the original backup, this summary, the
sanitized-content boundary, and the human-tutor mastery rule. If a requested
feature would weaken any of those controls, document the conflict before
implementation and obtain explicit authorization.
