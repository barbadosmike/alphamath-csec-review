# AlphaMath evidence API

All routes require `Authorization: Bearer <token>` and an origin listed in `ALLOWED_ORIGINS`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Verify API and database connectivity |
| `POST` | `/v1/intake-submissions` | Store one dated intake snapshot |
| `POST` | `/v1/tutorial-reviews` | Atomically store a tutorial attempt and its tutor review |
| `POST` | `/v1/exam-attempts` | Store a locked simulated-exam attempt |
| `POST` | `/v1/exam-reviews` | Store a tutor review for a saved exam attempt |
| `GET` | `/v1/learners/:externalId/dashboard` | Read linked counts, latest objective decisions, latest intake, and recent evidence |

Client-generated IDs make retries idempotent. The API validates record shape before writing, and the database constrains allowed topic statuses, review decisions, and evidence source types.

`mastery_confirmed` is valid only inside a named human review containing a reviewer ID, reviewer name, review date, syllabus code, and item-level review. It cannot be submitted by intake, tutorial completion, or exam completion.
