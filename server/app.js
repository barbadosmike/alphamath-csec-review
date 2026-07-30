import {
  ValidationError,
  validateExamAttempt,
  validateExamReview,
  validateIntake,
  validateTutorialReview
} from "./contracts.js";

const MAX_BODY_BYTES = 3_000_000;

function json(response, statusCode, body, origin){
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  if(origin){
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "origin");
  }
  response.end(JSON.stringify(body));
}

async function body(request){
  const chunks = [];
  let size = 0;
  for await (const chunk of request){
    size += chunk.length;
    if(size > MAX_BODY_BYTES){
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try{
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  }catch(_error){
    const error = new ValidationError("Request body must be valid JSON");
    throw error;
  }
}

function matchDashboard(pathname){
  const match = pathname.match(/^\/v1\/learners\/([^/]+)\/dashboard$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createApp({repository, allowedOrigins = [], apiToken = ""}){
  if(!repository) throw new Error("repository is required");
  const originSet = new Set(allowedOrigins.filter(Boolean));
  return async function app(request, response){
    const origin = request.headers.origin || "";
    try{
      if(origin && !originSet.has(origin)){
        return json(response, 403, {error: "Origin is not allowed"});
      }
      if(request.method === "OPTIONS"){
        response.statusCode = 204;
        response.setHeader("access-control-allow-origin", origin);
        response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
        response.setHeader("access-control-allow-headers", "authorization, content-type");
        response.setHeader("access-control-max-age", "600");
        response.setHeader("vary", "origin");
        return response.end();
      }
      const authorization = request.headers.authorization || "";
      if(!apiToken || authorization !== `Bearer ${apiToken}`){
        return json(response, 401, {error: "Authentication required"}, origin);
      }

      const url = new URL(request.url, "http://localhost");
      if(request.method === "GET" && url.pathname === "/health"){
        return json(response, 200, {ok: true, ...(await repository.health())}, origin);
      }
      if(request.method === "POST" && url.pathname === "/v1/intake-submissions"){
        const record = await repository.saveIntake(validateIntake(await body(request)));
        return json(response, 201, {id: record.id, status: "stored"}, origin);
      }
      if(request.method === "POST" && url.pathname === "/v1/tutorial-reviews"){
        const record = await repository.saveTutorialReview(validateTutorialReview(await body(request)));
        return json(response, 201, {
          id: record.id,
          attemptId: record.attemptId,
          status: "stored"
        }, origin);
      }
      if(request.method === "POST" && url.pathname === "/v1/exam-attempts"){
        const record = await repository.saveExamAttempt(validateExamAttempt(await body(request)));
        return json(response, 201, {id: record.id, status: "stored"}, origin);
      }
      if(request.method === "POST" && url.pathname === "/v1/exam-reviews"){
        const record = await repository.saveExamReview(validateExamReview(await body(request)));
        return json(response, 201, {id: record.id, status: "stored"}, origin);
      }
      const learnerId = request.method === "GET" ? matchDashboard(url.pathname) : null;
      if(learnerId){
        const dashboard = await repository.dashboard(learnerId);
        if(!dashboard) return json(response, 404, {error: "Learner not found"}, origin);
        return json(response, 200, dashboard, origin);
      }
      return json(response, 404, {error: "Route not found"}, origin);
    }catch(error){
      const statusCode = error.statusCode || (error.code === "23505" ? 409 : 500);
      const safeMessage = statusCode >= 500 ? "Internal server error" : error.message;
      if(statusCode >= 500) console.error(error);
      return json(response, statusCode, {error: safeMessage}, origin);
    }
  };
}
