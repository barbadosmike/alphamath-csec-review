(function(){
  "use strict";

  const kind = document.body.dataset.reviewKind;
  if(!kind || !window.AlphaMath) return;
  const isExam = kind === "exam";
  const source = isExam ? window.AlphaMathExam : window.AlphaMathTutorial;
  if(!source) return;

  const mount = document.createElement("section");
  mount.className = "tutor-review panel";
  mount.id = "tutor-review";
  mount.setAttribute("aria-labelledby", "tutor-review-title");
  const defaultCodes = document.body.dataset.syllabusCodes || "A1.2.1,A1.2.2,A1.2.3,A1.2.4";
  mount.innerHTML = `
    <div class="review-heading">
      <div>
        <p class="eyebrow">Human review checkpoint</p>
        <h2 id="tutor-review-title">Tutor review and PostgreSQL record</h2>
        <p class="lede">Review the saved method, record an outcome for attempted items, then explicitly submit the evidence. No selection is inferred from completion.</p>
      </div>
      <span class="status not-yet" data-review-state>Not submitted</span>
    </div>
    <div class="callout info">
      <p><strong>Local draft first.</strong> Learner work remains saved in this browser. Database submission requires the separately deployed evidence API and a tutor access token.</p>
    </div>
    <div class="review-identity grid two">
      <div><label for="reviewerExternalId">Tutor ID</label><input id="reviewerExternalId" autocomplete="username" placeholder="e.g. TUTOR-001"></div>
      <div><label for="reviewerName">Tutor name</label><input id="reviewerName" autocomplete="name"></div>
      <div><label for="reviewOutcome">Overall evidence decision</label>
        <select id="reviewOutcome">
          <option value="continue_practice">Continue practice</option>
          <option value="evidence_of_progress">Evidence of progress</option>
          <option value="mastery_confirmed">Mastery confirmed by tutor</option>
        </select>
      </div>
      <div><label for="reviewCodes">Syllabus objective codes</label><input id="reviewCodes" value="${AlphaMath.escapeHTML(defaultCodes)}" aria-describedby="review-codes-help"><span id="review-codes-help" class="fine">Comma-separated verified codes.</span></div>
    </div>
    <div class="review-items">
      <h3>Item-level review</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Learner response</th><th>Tutor outcome</th><th>Feedback</th></tr></thead>
          <tbody data-review-items></tbody>
        </table>
      </div>
    </div>
    <div style="margin-top:16px">
      <label for="reviewFeedback">Overall feedback</label>
      <textarea id="reviewFeedback" rows="4" placeholder="Name the demonstrated method, the remaining gap, and the next instructional action."></textarea>
    </div>
    <div class="review-submit">
      <p class="fine" data-database-status role="status" aria-live="polite">Not connected. Local work is safe.</p>
      <button type="button" class="primary" data-submit-review>Submit reviewed evidence</button>
    </div>`;

  document.querySelector("main")?.append(mount);
  const itemsMount = mount.querySelector("[data-review-items]");
  const status = mount.querySelector("[data-database-status]");
  const stateBadge = mount.querySelector("[data-review-state]");
  const submitButton = mount.querySelector("[data-submit-review]");

  function attempt(){
    return source.getAttempt();
  }

  function renderItems(){
    const current = attempt();
    const responseMap = new Map(current.responses.map(item => [String(item.itemId), item]));
    const rows = source.questions.map((question,index) => {
      const itemId = String(question.label || index+1);
      const response = responseMap.get(itemId);
      if(!response && !isExam) return "";
      return `<tr data-review-item="${AlphaMath.escapeHTML(itemId)}">
        <td><strong>${AlphaMath.escapeHTML(itemId)}</strong></td>
        <td class="review-response">${response?.answer ? AlphaMath.escapeHTML(response.answer) : "<em>No answer</em>"}</td>
        <td><label class="sr-only" for="review-outcome-${index}">Tutor outcome for item ${AlphaMath.escapeHTML(itemId)}</label>
          <select id="review-outcome-${index}" data-item-outcome>
            <option value="not_reviewed">Not reviewed</option>
            <option value="correct">Correct</option>
            <option value="partial">Partially correct</option>
            <option value="incorrect">Incorrect</option>
          </select></td>
        <td><label class="sr-only" for="review-feedback-${index}">Feedback for item ${AlphaMath.escapeHTML(itemId)}</label>
          <input id="review-feedback-${index}" data-item-feedback placeholder="Optional concise note"></td>
      </tr>`;
    }).join("");
    itemsMount.innerHTML = rows || '<tr><td colspan="4"><em>No attempted tutorial items are ready for review yet.</em></td></tr>';
  }

  function reviewPayload(){
    const reviewerExternalId = mount.querySelector("#reviewerExternalId").value.trim();
    const reviewerName = mount.querySelector("#reviewerName").value.trim();
    if(!reviewerExternalId || !reviewerName) throw new Error("Enter the tutor ID and tutor name.");
    const items = [...itemsMount.querySelectorAll("[data-review-item]")].map(row => ({
      itemId: row.dataset.reviewItem,
      outcome: row.querySelector("[data-item-outcome]").value,
      feedback: row.querySelector("[data-item-feedback]").value.trim()
    }));
    if(!items.some(item => item.outcome !== "not_reviewed")){
      throw new Error("Review at least one attempted item before submitting.");
    }
    const syllabusCodes = mount.querySelector("#reviewCodes").value
      .split(",").map(value => value.trim()).filter(Boolean);
    if(!syllabusCodes.length) throw new Error("Enter at least one verified syllabus objective code.");
    return {
      clientReviewId: AlphaMath.ids.stable(
        `alphamath:${kind}:database-review-draft`,
        `${kind}-review`
      ),
      reviewerExternalId,
      reviewerName,
      reviewedAt: new Date().toISOString(),
      overallOutcome: mount.querySelector("#reviewOutcome").value,
      overallFeedback: mount.querySelector("#reviewFeedback").value.trim(),
      syllabusCodes,
      items
    };
  }

  async function submitReview(){
    submitButton.disabled = true;
    status.textContent = "Connecting and validating reviewed evidence…";
    try{
      const current = attempt();
      if(isExam && !current.locked){
        throw new Error("Submit and lock the simulated exam before tutor review.");
      }
      const review = reviewPayload();
      let result;
      if(isExam){
        const savedAttempt = await AlphaMath.api.submit("/v1/exam-attempts", current);
        result = await AlphaMath.api.submit("/v1/exam-reviews", {
          examAttemptId: savedAttempt.id,
          ...review
        });
      }else{
        result = await AlphaMath.api.submit("/v1/tutorial-reviews", {
          ...current,
          clientReviewId: review.clientReviewId,
          attempt: {responses: current.responses},
          review
        });
      }
      AlphaMath.storage.set(`alphamath:${kind}:database-review-draft`, "");
      status.textContent = `Stored in PostgreSQL. Evidence record ${result.id}.`;
      stateBadge.textContent = "Stored";
      stateBadge.className = "status approaching";
      AlphaMath.announce("Tutor-reviewed evidence stored in PostgreSQL.");
    }catch(error){
      status.textContent = error.message;
      stateBadge.textContent = "Not submitted";
      stateBadge.className = "status not-yet";
      if(!error.cancelled) AlphaMath.announce(error.message);
    }finally{
      submitButton.disabled = false;
    }
  }

  submitButton.addEventListener("click", submitReview);
  renderItems();
})();
