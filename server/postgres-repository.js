import pg from "pg";

const {Pool} = pg;

async function upsertLearner(client, learner){
  const result = await client.query(
    `INSERT INTO learners (external_id, display_name, school, email)
     VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''))
     ON CONFLICT (external_id) DO UPDATE SET
       display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), learners.display_name),
       school = COALESCE(NULLIF(EXCLUDED.school, ''), learners.school),
       email = COALESCE(NULLIF(EXCLUDED.email, ''), learners.email),
       updated_at = now()
     RETURNING id, external_id AS "externalId", display_name AS "displayName",
       school, email, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [learner.externalId, learner.displayName, learner.school, learner.email]
  );
  return result.rows[0];
}

async function transaction(pool, operation){
  const client = await pool.connect();
  try{
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}

export class PostgresRepository {
  constructor({connectionString, pool} = {}){
    this.pool = pool || new Pool({
      connectionString,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30_000
    });
  }

  async saveIntake(payload){
    return transaction(this.pool, async client => {
      const learner = await upsertLearner(client, payload.learner);
      const result = await client.query(
        `INSERT INTO intake_submissions (
           learner_id, client_submission_id, source_version, submitted_at,
           tutor, topic_responses, practice_questions
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
         ON CONFLICT (client_submission_id) DO UPDATE
           SET client_submission_id = EXCLUDED.client_submission_id
         RETURNING id`,
        [
          learner.id,
          payload.clientSubmissionId,
          payload.sourceVersion,
          payload.submittedAt,
          JSON.stringify(payload.tutor),
          JSON.stringify(payload.topics),
          JSON.stringify(payload.practiceQuestions)
        ]
      );
      return {id: result.rows[0].id};
    });
  }

  async saveTutorialReview(payload){
    return transaction(this.pool, async client => {
      const learner = await upsertLearner(client, payload.learner);
      const attemptResult = await client.query(
        `INSERT INTO tutorial_attempts (
           learner_id, client_attempt_id, instrument_id, source_version,
           started_at, submitted_at, responses
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (client_attempt_id) DO UPDATE
           SET client_attempt_id = EXCLUDED.client_attempt_id
         RETURNING id`,
        [
          learner.id,
          payload.clientAttemptId,
          payload.instrumentId,
          payload.sourceVersion,
          payload.startedAt,
          payload.submittedAt,
          JSON.stringify(payload.attempt.responses)
        ]
      );
      const attemptId = attemptResult.rows[0].id;
      const review = payload.review;
      const reviewResult = await client.query(
        `INSERT INTO tutorial_reviews (
           tutorial_attempt_id, client_review_id, reviewer_external_id,
           reviewer_name, reviewed_at, overall_outcome, overall_feedback, item_reviews
         ) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8::jsonb)
         ON CONFLICT (client_review_id) DO UPDATE
           SET client_review_id = EXCLUDED.client_review_id
         RETURNING id`,
        [
          attemptId,
          review.clientReviewId,
          review.reviewerExternalId,
          review.reviewerName,
          review.reviewedAt,
          review.overallOutcome,
          review.overallFeedback,
          JSON.stringify(review.items)
        ]
      );
      const reviewId = reviewResult.rows[0].id;
      for(const code of review.syllabusCodes){
        await client.query(
          `INSERT INTO evidence_objectives (
             learner_id, source_type, source_id, syllabus_code, decision,
             reviewer_external_id, reviewed_at
           ) VALUES ($1, 'tutorial_review', $2, $3, $4, $5, $6)
           ON CONFLICT (source_type, source_id, syllabus_code) DO NOTHING`,
          [learner.id, reviewId, code, review.overallOutcome, review.reviewerExternalId, review.reviewedAt]
        );
      }
      return {id: reviewId, attemptId};
    });
  }

  async saveExamAttempt(payload){
    return transaction(this.pool, async client => {
      const learner = await upsertLearner(client, payload.learner);
      const result = await client.query(
        `INSERT INTO exam_attempts (
           learner_id, client_attempt_id, instrument_id, source_version,
           started_at, submitted_at, elapsed_seconds, timed_out, responses
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (client_attempt_id) DO UPDATE
           SET client_attempt_id = EXCLUDED.client_attempt_id
         RETURNING id`,
        [
          learner.id,
          payload.clientAttemptId,
          payload.instrumentId,
          payload.sourceVersion,
          payload.startedAt,
          payload.submittedAt,
          payload.elapsedSeconds,
          payload.timedOut,
          JSON.stringify(payload.responses)
        ]
      );
      return {id: result.rows[0].id};
    });
  }

  async saveExamReview(payload){
    return transaction(this.pool, async client => {
      const attemptResult = await client.query(
        `SELECT id, learner_id FROM exam_attempts WHERE id = $1`,
        [payload.examAttemptId]
      );
      if(!attemptResult.rowCount){
        const error = new Error("Exam attempt not found");
        error.statusCode = 404;
        throw error;
      }
      const attempt = attemptResult.rows[0];
      const result = await client.query(
        `INSERT INTO exam_reviews (
           exam_attempt_id, client_review_id, reviewer_external_id,
           reviewer_name, reviewed_at, overall_outcome, overall_feedback, item_reviews
         ) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8::jsonb)
         ON CONFLICT (client_review_id) DO UPDATE
           SET client_review_id = EXCLUDED.client_review_id
         RETURNING id`,
        [
          attempt.id,
          payload.clientReviewId,
          payload.reviewerExternalId,
          payload.reviewerName,
          payload.reviewedAt,
          payload.overallOutcome,
          payload.overallFeedback,
          JSON.stringify(payload.items)
        ]
      );
      const reviewId = result.rows[0].id;
      for(const code of payload.syllabusCodes){
        await client.query(
          `INSERT INTO evidence_objectives (
             learner_id, source_type, source_id, syllabus_code, decision,
             reviewer_external_id, reviewed_at
           ) VALUES ($1, 'exam_review', $2, $3, $4, $5, $6)
           ON CONFLICT (source_type, source_id, syllabus_code) DO NOTHING`,
          [
            attempt.learner_id,
            reviewId,
            code,
            payload.overallOutcome,
            payload.reviewerExternalId,
            payload.reviewedAt
          ]
        );
      }
      return {id: reviewId};
    });
  }

  async dashboard(externalId){
    const learnerResult = await this.pool.query(
      `SELECT id, external_id AS "externalId", display_name AS "displayName",
         school, email, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM learners WHERE external_id = $1`,
      [externalId]
    );
    if(!learnerResult.rowCount) return null;
    const learner = learnerResult.rows[0];
    const [countsResult, objectiveResult, evidenceResult, intakeResult] = await Promise.all([
      this.pool.query(
        `SELECT
           (SELECT count(*)::int FROM intake_submissions WHERE learner_id = $1) AS "intakeSubmissions",
           (SELECT count(*)::int FROM tutorial_reviews tr
             JOIN tutorial_attempts ta ON ta.id = tr.tutorial_attempt_id
             WHERE ta.learner_id = $1) AS "tutorialReviews",
           (SELECT count(*)::int FROM exam_attempts WHERE learner_id = $1) AS "examAttempts",
           (SELECT count(*)::int FROM exam_reviews er
             JOIN exam_attempts ea ON ea.id = er.exam_attempt_id
             WHERE ea.learner_id = $1) AS "examReviews"`,
        [learner.id]
      ),
      this.pool.query(
        `SELECT DISTINCT ON (syllabus_code)
           syllabus_code AS "syllabusCode",
           decision AS "latestDecision",
           reviewed_at AS "reviewedAt",
           reviewer_external_id AS "reviewerExternalId",
           count(*) OVER (PARTITION BY syllabus_code)::int AS "evidenceCount"
         FROM evidence_objectives
         WHERE learner_id = $1
         ORDER BY syllabus_code, reviewed_at DESC`,
        [learner.id]
      ),
      this.pool.query(
        `SELECT eo.source_type AS type, eo.source_id AS "sourceId",
           eo.reviewed_at AS "reviewedAt", eo.decision AS outcome,
           array_agg(eo.syllabus_code ORDER BY eo.syllabus_code) AS "syllabusCodes",
           eo.reviewer_external_id AS "reviewerExternalId"
         FROM evidence_objectives eo
         WHERE eo.learner_id = $1
         GROUP BY eo.source_type, eo.source_id, eo.reviewed_at, eo.decision, eo.reviewer_external_id
         ORDER BY eo.reviewed_at DESC
         LIMIT 20`,
        [learner.id]
      ),
      this.pool.query(
        `SELECT id, submitted_at AS "submittedAt", topic_responses AS topics,
           practice_questions AS "practiceQuestions"
         FROM intake_submissions
         WHERE learner_id = $1
         ORDER BY submitted_at DESC LIMIT 1`,
        [learner.id]
      )
    ]);
    return {
      learner,
      counts: countsResult.rows[0],
      objectives: objectiveResult.rows,
      recentEvidence: evidenceResult.rows,
      latestIntake: intakeResult.rows[0] || null
    };
  }

  async health(){
    const result = await this.pool.query("SELECT current_database() AS database, now() AS time");
    return result.rows[0];
  }

  async close(){
    await this.pool.end();
  }
}
