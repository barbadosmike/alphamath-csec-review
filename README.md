---
title: "AlphaMath — Sanitized Reviewer Demonstration"
status: "pages-only; no evidence API is shipped"
built_by: "tools/build-review-demo.mjs (Marion Sydney Enterprises workspace)"
built_at: "2026-08-02"
---

# AlphaMath — Sanitized Reviewer Demonstration

The AlphaMath⁺ landing page is the front door; the two suites sit beneath it:

- **[CSEC Mathematics](csec-maths/index.html)**
- **[CSEC Additional Mathematics](add-maths/index.html)**

## What this is, exactly

A **Tier-1 static tour**: every page is clickable and the offline-first
instruments — intake, tutorials, simulated exams, pathways — work in full,
because they run in your browser and keep their working state there.

**No evidence API is shipped with this demonstration.** Sign-in surfaces
render, and they cannot connect to anything: the API source is not published
here, and the client's `apiBase` is empty. So the connected features — the
tutor workspace, marked work, the admin console, parent progress, *Tell your
tutor*, and set-password links — are visible as interface, and no request they
make can reach a server.

## The content boundary

- **No real learner work.** Issued tutorials and exams belong to a learner and
  are excluded; the cards that opened them say so where they stood.
- **No real identifiers.** `REVIEW-DEMO` is a fictional interface identifier
  standing in for the subject-scoped id used in the live system. No account
  ids, no partner school, no contributor names, no development origins.
- **No secrets, and no server.** The API source, its configuration, its tests,
  and its tooling are not part of this export.

Each of those is re-scanned in the built output and the build fails if any
survives — this file describes a boundary the tool enforces rather than a
promise a person made.

## What the interface will not do

No screen decides mastery. Every outcome shown in the live system is a named
tutor's judgment, and learner-facing pages carry subject-scoped identifiers
rather than names. CSEC® and CXC® are referenced only to describe curriculum
alignment; this demonstration is not affiliated with or endorsed by CXC, and
reproduced past-paper questions are deliberately excluded.
