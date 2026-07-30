BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  display_name text,
  school text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  client_submission_id text NOT NULL UNIQUE,
  source_version text NOT NULL,
  submitted_at timestamptz NOT NULL,
  tutor jsonb NOT NULL DEFAULT '{}'::jsonb,
  topic_responses jsonb NOT NULL,
  practice_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tutorial_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  client_attempt_id text NOT NULL UNIQUE,
  instrument_id text NOT NULL,
  source_version text NOT NULL,
  started_at timestamptz,
  submitted_at timestamptz NOT NULL,
  responses jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tutorial_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_attempt_id uuid NOT NULL REFERENCES tutorial_attempts(id) ON DELETE RESTRICT,
  client_review_id text NOT NULL UNIQUE,
  reviewer_external_id text NOT NULL,
  reviewer_name text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  overall_outcome text NOT NULL CHECK (
    overall_outcome IN ('continue_practice', 'evidence_of_progress', 'mastery_confirmed')
  ),
  overall_feedback text,
  item_reviews jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  client_attempt_id text NOT NULL UNIQUE,
  instrument_id text NOT NULL,
  source_version text NOT NULL,
  started_at timestamptz,
  submitted_at timestamptz NOT NULL,
  elapsed_seconds integer NOT NULL CHECK (elapsed_seconds >= 0),
  timed_out boolean NOT NULL DEFAULT false,
  responses jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE RESTRICT,
  client_review_id text NOT NULL UNIQUE,
  reviewer_external_id text NOT NULL,
  reviewer_name text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  overall_outcome text NOT NULL CHECK (
    overall_outcome IN ('continue_practice', 'evidence_of_progress', 'mastery_confirmed')
  ),
  overall_feedback text,
  item_reviews jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type IN ('tutorial_review', 'exam_review')),
  source_id uuid NOT NULL,
  syllabus_code text NOT NULL,
  decision text NOT NULL CHECK (
    decision IN ('continue_practice', 'evidence_of_progress', 'mastery_confirmed')
  ),
  reviewer_external_id text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  UNIQUE (source_type, source_id, syllabus_code)
);

CREATE INDEX IF NOT EXISTS intake_submissions_learner_date
  ON intake_submissions (learner_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS tutorial_attempts_learner_date
  ON tutorial_attempts (learner_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS exam_attempts_learner_date
  ON exam_attempts (learner_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS evidence_objectives_learner_code
  ON evidence_objectives (learner_id, syllabus_code, reviewed_at DESC);

COMMIT;
