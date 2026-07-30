import {randomUUID} from "node:crypto";

export class MemoryRepository {
  constructor(){
    this.learners = new Map();
    this.intakes = [];
    this.tutorialReviews = [];
    this.examAttempts = [];
    this.examReviews = [];
  }

  learner(payload){
    const existing = this.learners.get(payload.externalId);
    const record = {
      id: existing?.id || randomUUID(),
      ...existing,
      ...payload
    };
    this.learners.set(payload.externalId, record);
    return record;
  }

  async saveIntake(payload){
    const learner = this.learner(payload.learner);
    const existing = this.intakes.find(item => item.clientSubmissionId === payload.clientSubmissionId);
    if(existing) return existing;
    const record = {id: randomUUID(), learnerId: learner.id, ...payload};
    this.intakes.push(record);
    return record;
  }

  async saveTutorialReview(payload){
    const learner = this.learner(payload.learner);
    const existing = this.tutorialReviews.find(item => item.clientReviewId === payload.clientReviewId);
    if(existing) return existing;
    const record = {id: randomUUID(), attemptId: randomUUID(), learnerId: learner.id, ...payload};
    this.tutorialReviews.push(record);
    return record;
  }

  async saveExamAttempt(payload){
    const learner = this.learner(payload.learner);
    const existing = this.examAttempts.find(item => item.clientAttemptId === payload.clientAttemptId);
    if(existing) return existing;
    const record = {id: randomUUID(), learnerId: learner.id, ...payload};
    this.examAttempts.push(record);
    return record;
  }

  async saveExamReview(payload){
    const attempt = this.examAttempts.find(item => item.id === payload.examAttemptId);
    if(!attempt){
      const error = new Error("Exam attempt not found");
      error.statusCode = 404;
      throw error;
    }
    const existing = this.examReviews.find(item => item.clientReviewId === payload.clientReviewId);
    if(existing) return existing;
    const record = {id: randomUUID(), learnerId: attempt.learnerId, ...payload};
    this.examReviews.push(record);
    return record;
  }

  async dashboard(externalId){
    const learner = this.learners.get(externalId);
    if(!learner) return null;
    const intakes = this.intakes.filter(item => item.learnerId === learner.id);
    const tutorials = this.tutorialReviews.filter(item => item.learnerId === learner.id);
    const attempts = this.examAttempts.filter(item => item.learnerId === learner.id);
    const attemptIds = new Set(attempts.map(item => item.id));
    const examReviews = this.examReviews.filter(item => attemptIds.has(item.examAttemptId));
    const evidence = [
      ...tutorials.map(item => ({
        type: "tutorial_review",
        sourceId: item.id,
        reviewedAt: item.review.reviewedAt,
        outcome: item.review.overallOutcome,
        syllabusCodes: item.review.syllabusCodes,
        reviewerName: item.review.reviewerName,
        instrumentId: item.instrumentId
      })),
      ...examReviews.map(item => {
        const attempt = attempts.find(candidate => candidate.id === item.examAttemptId);
        return {
          type: "exam_review",
          sourceId: item.id,
          reviewedAt: item.reviewedAt,
          outcome: item.overallOutcome,
          syllabusCodes: item.syllabusCodes,
          reviewerName: item.reviewerName,
          instrumentId: attempt?.instrumentId || "simulated-exam"
        };
      })
    ].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    const objectiveMap = new Map();
    evidence.forEach(item => item.syllabusCodes.forEach(code => {
      if(!objectiveMap.has(code)){
        objectiveMap.set(code, {
          syllabusCode: code,
          latestDecision: item.outcome,
          reviewedAt: item.reviewedAt,
          reviewerName: item.reviewerName,
          evidenceCount: 0
        });
      }
      objectiveMap.get(code).evidenceCount++;
    }));
    return {
      learner,
      counts: {
        intakeSubmissions: intakes.length,
        tutorialReviews: tutorials.length,
        examAttempts: attempts.length,
        examReviews: examReviews.length
      },
      objectives: [...objectiveMap.values()],
      recentEvidence: evidence.slice(0, 20),
      latestIntake: intakes.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] || null
    };
  }

  async health(){
    return {database: "memory"};
  }

  async close(){}
}
