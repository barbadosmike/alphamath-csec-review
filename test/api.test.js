import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {createServer} from "node:http";
import {createApp} from "../server/app.js";
import {MemoryRepository} from "../server/memory-repository.js";

async function withServer(run){
  const repository = new MemoryRepository();
  const server = createServer(createApp({
    repository,
    allowedOrigins: ["https://example.test"],
    apiToken: "test-token"
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const {port} = server.address();
  try{
    await run({
      repository,
      request(path, options = {}){
        return fetch(`http://127.0.0.1:${port}${path}`, {
          ...options,
          headers: {
            origin: "https://example.test",
            authorization: "Bearer test-token",
            "content-type": "application/json",
            ...(options.headers || {})
          }
        });
      }
    });
  }finally{
    server.close();
    await once(server, "close");
  }
}

const learner = {
  externalId: "REVIEW-DEMO",
  displayName: "Demo Learner",
  school: "Example School"
};

test("intake, reviewed tutorial, and reviewed exam appear on one learner dashboard", async () => {
  await withServer(async ({request}) => {
    const intakeResponse = await request("/v1/intake-submissions", {
      method: "POST",
      body: JSON.stringify({
        clientSubmissionId: "intake-api-001",
        sourceVersion: "review-test",
        submittedAt: "2026-07-30T12:00:00.000Z",
        learner,
        tutor: {name: "Tutor One"},
        topics: [{code: "M1.1.11", status: "practice", note: "First uncertain step"}],
        practiceQuestions: []
      })
    });
    assert.equal(intakeResponse.status, 201);

    const tutorialResponse = await request("/v1/tutorial-reviews", {
      method: "POST",
      body: JSON.stringify({
        clientAttemptId: "tutorial-api-attempt-001",
        clientReviewId: "tutorial-api-review-001",
        instrumentId: "proportional-reasoning-foundation",
        sourceVersion: "review-test",
        startedAt: "2026-07-30T12:10:00.000Z",
        submittedAt: "2026-07-30T12:30:00.000Z",
        learner,
        attempt: {
          responses: [{itemId: "1", answer: "0.5", confidence: "sure", checked: true}]
        },
        review: {
          reviewerExternalId: "TUTOR-001",
          reviewerName: "Tutor One",
          reviewedAt: "2026-07-30T12:40:00.000Z",
          overallOutcome: "evidence_of_progress",
          overallFeedback: "Method is improving.",
          syllabusCodes: ["M1.1.11"],
          items: [{itemId: "1", outcome: "correct", feedback: ""}]
        }
      })
    });
    assert.equal(tutorialResponse.status, 201);

    const examAttemptResponse = await request("/v1/exam-attempts", {
      method: "POST",
      body: JSON.stringify({
        clientAttemptId: "exam-api-attempt-001",
        instrumentId: "simulated-exam-1",
        sourceVersion: "review-test",
        startedAt: "2026-07-30T13:00:00.000Z",
        submittedAt: "2026-07-30T13:30:00.000Z",
        elapsedSeconds: 1800,
        timedOut: false,
        locked: true,
        learner,
        responses: [{itemId: "1", answer: "25%", flagged: false}]
      })
    });
    assert.equal(examAttemptResponse.status, 201);
    const examAttempt = await examAttemptResponse.json();

    const examReviewResponse = await request("/v1/exam-reviews", {
      method: "POST",
      body: JSON.stringify({
        examAttemptId: examAttempt.id,
        clientReviewId: "exam-api-review-001",
        reviewerExternalId: "TUTOR-001",
        reviewerName: "Tutor One",
        reviewedAt: "2026-07-30T13:45:00.000Z",
        overallOutcome: "mastery_confirmed",
        overallFeedback: "Accurate and independent.",
        syllabusCodes: ["M1.1.11"],
        items: [{itemId: "1", outcome: "correct", feedback: ""}]
      })
    });
    assert.equal(examReviewResponse.status, 201);

    const dashboardResponse = await request("/v1/learners/REVIEW-DEMO/dashboard");
    assert.equal(dashboardResponse.status, 200);
    const dashboard = await dashboardResponse.json();
    assert.deepEqual(dashboard.counts, {
      intakeSubmissions: 1,
      tutorialReviews: 1,
      examAttempts: 1,
      examReviews: 1
    });
    assert.equal(dashboard.objectives[0].syllabusCode, "M1.1.11");
    assert.equal(dashboard.objectives[0].latestDecision, "mastery_confirmed");
  });
});

test("API rejects untrusted origins and missing credentials", async () => {
  await withServer(async ({request}) => {
    const noToken = await request("/health", {
      headers: {authorization: "", origin: "https://example.test"}
    });
    assert.equal(noToken.status, 401);

    const badOrigin = await request("/health", {
      headers: {origin: "https://attacker.test"}
    });
    assert.equal(badOrigin.status, 403);
  });
});
