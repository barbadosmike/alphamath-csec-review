const TOPIC_STATUSES = new Set(["confident", "practice", "not-started"]);
const REVIEW_OUTCOMES = new Set([
  "continue_practice",
  "evidence_of_progress",
  "mastery_confirmed"
]);
const ITEM_OUTCOMES = new Set(["correct", "partial", "incorrect", "not_reviewed"]);

export class ValidationError extends Error {
  constructor(message){
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

function object(value, path){
  if(!value || typeof value !== "object" || Array.isArray(value)){
    throw new ValidationError(`${path} must be an object`);
  }
  return value;
}

function text(value, path, {required = true, max = 5000} = {}){
  const result = typeof value === "string" ? value.trim() : "";
  if(required && !result) throw new ValidationError(`${path} is required`);
  if(result.length > max) throw new ValidationError(`${path} is too long`);
  return result;
}

function date(value, path, {required = true} = {}){
  if(!value && !required) return null;
  const result = new Date(value);
  if(Number.isNaN(result.valueOf())) throw new ValidationError(`${path} must be an ISO date`);
  return result.toISOString();
}

function list(value, path, {max = 500} = {}){
  if(!Array.isArray(value)) throw new ValidationError(`${path} must be an array`);
  if(value.length > max) throw new ValidationError(`${path} has too many items`);
  return value;
}

function learner(value){
  const source = object(value, "learner");
  return {
    externalId: text(source.externalId, "learner.externalId", {max: 100}),
    displayName: text(source.displayName, "learner.displayName", {required: false, max: 200}),
    school: text(source.school, "learner.school", {required: false, max: 300}),
    email: text(source.email, "learner.email", {required: false, max: 320})
  };
}

function clientId(value, path){
  const id = text(value, path, {max: 160});
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]+$/.test(id)){
    throw new ValidationError(`${path} contains unsupported characters`);
  }
  return id;
}

function sourceVersion(value){
  return text(value, "sourceVersion", {max: 100});
}

function responses(value, path = "responses"){
  return list(value, path).map((entry, index) => {
    const item = object(entry, `${path}[${index}]`);
    return {
      itemId: text(String(item.itemId ?? ""), `${path}[${index}].itemId`, {max: 100}),
      answer: text(item.answer, `${path}[${index}].answer`, {required: false, max: 10000}),
      confidence: text(item.confidence, `${path}[${index}].confidence`, {required: false, max: 50}),
      checked: Boolean(item.checked),
      hintLevel: Math.max(0, Math.min(10, Number(item.hintLevel) || 0)),
      attempts: Math.max(0, Math.min(100, Number(item.attempts) || 0)),
      flagged: Boolean(item.flagged),
      drawing: text(item.drawing, `${path}[${index}].drawing`, {required: false, max: 2_500_000})
    };
  });
}

export function validateHumanReview(value){
  const review = object(value, "review");
  const overallOutcome = text(review.overallOutcome, "review.overallOutcome", {max: 40});
  if(!REVIEW_OUTCOMES.has(overallOutcome)){
    throw new ValidationError("review.overallOutcome is invalid");
  }
  const items = list(review.items, "review.items").map((entry, index) => {
    const item = object(entry, `review.items[${index}]`);
    const outcome = text(item.outcome, `review.items[${index}].outcome`, {max: 40});
    if(!ITEM_OUTCOMES.has(outcome)){
      throw new ValidationError(`review.items[${index}].outcome is invalid`);
    }
    return {
      itemId: text(String(item.itemId ?? ""), `review.items[${index}].itemId`, {max: 100}),
      outcome,
      feedback: text(item.feedback, `review.items[${index}].feedback`, {required: false, max: 5000})
    };
  });
  const syllabusCodes = [...new Set(list(review.syllabusCodes, "review.syllabusCodes", {max: 50})
    .map((code, index) => text(code, `review.syllabusCodes[${index}]`, {max: 60})))];
  if(!syllabusCodes.length) throw new ValidationError("review.syllabusCodes requires at least one code");
  return {
    clientReviewId: clientId(review.clientReviewId, "review.clientReviewId"),
    reviewerExternalId: text(review.reviewerExternalId, "review.reviewerExternalId", {max: 100}),
    reviewerName: text(review.reviewerName, "review.reviewerName", {max: 200}),
    reviewedAt: date(review.reviewedAt, "review.reviewedAt"),
    overallOutcome,
    overallFeedback: text(review.overallFeedback, "review.overallFeedback", {required: false, max: 10000}),
    syllabusCodes,
    items
  };
}

export function validateIntake(value){
  const payload = object(value, "payload");
  const topics = list(payload.topics, "topics").map((entry, index) => {
    const topic = object(entry, `topics[${index}]`);
    const status = text(topic.status, `topics[${index}].status`, {max: 30});
    if(!TOPIC_STATUSES.has(status)) throw new ValidationError(`topics[${index}].status is invalid`);
    return {
      code: text(topic.code, `topics[${index}].code`, {max: 60}),
      status,
      note: text(topic.note, `topics[${index}].note`, {required: false, max: 5000})
    };
  });
  return {
    clientSubmissionId: clientId(payload.clientSubmissionId, "clientSubmissionId"),
    sourceVersion: sourceVersion(payload.sourceVersion),
    submittedAt: date(payload.submittedAt, "submittedAt"),
    learner: learner(payload.learner),
    tutor: payload.tutor && typeof payload.tutor === "object" ? payload.tutor : {},
    topics,
    practiceQuestions: list(payload.practiceQuestions || [], "practiceQuestions", {max: 100})
  };
}

export function validateTutorialReview(value){
  const payload = object(value, "payload");
  const reviewSource = object(payload.review, "review");
  return {
    clientAttemptId: clientId(payload.clientAttemptId, "clientAttemptId"),
    clientReviewId: clientId(
      payload.clientReviewId || reviewSource.clientReviewId,
      "review.clientReviewId"
    ),
    instrumentId: text(payload.instrumentId, "instrumentId", {max: 160}),
    sourceVersion: sourceVersion(payload.sourceVersion),
    startedAt: date(payload.startedAt, "startedAt", {required: false}),
    submittedAt: date(payload.submittedAt, "submittedAt"),
    learner: learner(payload.learner),
    attempt: {
      responses: responses(object(payload.attempt, "attempt").responses)
    },
    review: validateHumanReview({
      ...reviewSource,
      clientReviewId: payload.clientReviewId || reviewSource.clientReviewId
    })
  };
}

export function validateExamAttempt(value){
  const payload = object(value, "payload");
  if(payload.locked !== true) throw new ValidationError("exam attempt must be locked before submission");
  const elapsedSeconds = Number(payload.elapsedSeconds);
  if(!Number.isInteger(elapsedSeconds) || elapsedSeconds < 0){
    throw new ValidationError("elapsedSeconds must be a non-negative integer");
  }
  return {
    clientAttemptId: clientId(payload.clientAttemptId, "clientAttemptId"),
    instrumentId: text(payload.instrumentId, "instrumentId", {max: 160}),
    sourceVersion: sourceVersion(payload.sourceVersion),
    startedAt: date(payload.startedAt, "startedAt", {required: false}),
    submittedAt: date(payload.submittedAt, "submittedAt"),
    elapsedSeconds,
    timedOut: Boolean(payload.timedOut),
    locked: true,
    learner: learner(payload.learner),
    responses: responses(payload.responses)
  };
}

export function validateExamReview(value){
  const payload = object(value, "payload");
  return {
    examAttemptId: text(payload.examAttemptId, "examAttemptId", {max: 100}),
    ...validateHumanReview(payload)
  };
}
