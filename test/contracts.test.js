import test from "node:test";
import assert from "node:assert/strict";
import {
  validateExamAttempt,
  validateHumanReview,
  validateIntake,
  validateTutorialReview
} from "../server/contracts.js";

const learner = {
  externalId: "REVIEW-DEMO",
  displayName: "Demo Learner",
  school: "Example School"
};

test("intake accepts topic statuses but rejects invented status values", () => {
  const valid = validateIntake({
    clientSubmissionId: "intake-001",
    sourceVersion: "review-test",
    submittedAt: "2026-07-30T12:00:00.000Z",
    learner,
    tutor: {name: "Tutor One"},
    topics: [{code: "M1.1.11", status: "practice", note: "Converting fractions"}],
    practiceQuestions: []
  });
  assert.equal(valid.topics[0].status, "practice");

  assert.throws(() => validateIntake({
    ...valid,
    topics: [{code: "M1.1.11", status: "mastered"}]
  }), /status/i);
});

test("tutorial review requires a named human reviewer and item outcomes", () => {
  const payload = {
    clientAttemptId: "tutorial-attempt-001",
    clientReviewId: "tutorial-review-001",
    instrumentId: "proportional-reasoning-foundation",
    sourceVersion: "review-test",
    startedAt: "2026-07-30T11:00:00.000Z",
    submittedAt: "2026-07-30T12:00:00.000Z",
    learner,
    attempt: {
      responses: [{itemId: "1", answer: "0.5", confidence: "sure", checked: true}]
    },
    review: {
      reviewerExternalId: "TUTOR-001",
      reviewerName: "Tutor One",
      reviewedAt: "2026-07-30T12:10:00.000Z",
      overallOutcome: "evidence_of_progress",
      overallFeedback: "Method is becoming consistent.",
      syllabusCodes: ["M1.1.11", "M1.1.13"],
      items: [{itemId: "1", outcome: "correct", feedback: "Clear conversion."}]
    }
  };
  assert.equal(validateTutorialReview(payload).review.reviewerName, "Tutor One");
  assert.throws(
    () => validateTutorialReview({...payload, review: {...payload.review, reviewerName: ""}}),
    /reviewerName/
  );
});

test("exam attempts must be locked before database submission", () => {
  const payload = {
    clientAttemptId: "exam-attempt-001",
    instrumentId: "simulated-exam-1",
    sourceVersion: "review-test",
    startedAt: "2026-07-30T11:00:00.000Z",
    submittedAt: "2026-07-30T11:30:00.000Z",
    elapsedSeconds: 1800,
    timedOut: false,
    locked: true,
    learner,
    responses: [{itemId: "1", answer: "25%", flagged: false}]
  };
  assert.equal(validateExamAttempt(payload).locked, true);
  assert.throws(() => validateExamAttempt({...payload, locked: false}), /locked/i);
});

test("mastery is accepted only as an explicit human review outcome", () => {
  const review = validateHumanReview({
    clientReviewId: "exam-review-001",
    reviewerExternalId: "TUTOR-001",
    reviewerName: "Tutor One",
    reviewedAt: "2026-07-30T12:10:00.000Z",
    overallOutcome: "mastery_confirmed",
    syllabusCodes: ["M1.1.11"],
    items: [{itemId: "1", outcome: "correct", feedback: ""}]
  });
  assert.equal(review.overallOutcome, "mastery_confirmed");
  assert.throws(
    () => validateHumanReview({...review, reviewerExternalId: ""}),
    /reviewerExternalId/
  );
});
