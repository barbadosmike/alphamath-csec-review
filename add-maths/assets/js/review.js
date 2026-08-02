(function(){
  "use strict";
  if(!window.AlphaMath) return;

  /*
   * ONE REVIEW RENDERER, THREE SOURCES.
   *
   * This panel used to read window.AlphaMathExam / window.AlphaMathTutorial
   * directly, which bound it to the learner's own page and to their browser
   * storage — the reason marking could only happen on the machine the student
   * sat at. The renderer is unchanged in behaviour; what changed is that the
   * attempt now ARRIVES rather than being looked up.
   *
   * config:
   *   kind          'exam' | 'tutorial'
   *   questions     the instrument's question list
   *   getAttempt()  returns the attempt to render
   *   container     where to mount (defaults to <main>)
   *   reviewer      {externalId, displayName} -> known at render time, shown
   *                 read-only. null -> not known yet, because the in-page
   *                 tutorial and exam pages render offline and only reach a
   *                 session at the moment of saving. Either way the identity in
   *                 the record is the server's: it takes the reviewer from the
   *                 authenticated principal and discards whatever this page
   *                 sends. There is no longer any mode in which a reviewer
   *                 types who they are.
   *   onSubmit(review, attempt) -> submits, returns {id}
   *   defaultCodes  comma-separated syllabus codes
   *   headingText / ledeText  optional copy overrides
   */
  AlphaMath.createReviewPanel = function createReviewPanel(config){
  const kind = config.kind;
  const isExam = kind === "exam";
  const source = {questions: config.questions, getAttempt: config.getAttempt};
  const reviewer = config.reviewer || null;

  const mount = document.createElement("section");
  mount.className = "tutor-review panel";
  mount.id = "tutor-review";
  mount.setAttribute("aria-labelledby", "tutor-review-title");
  /* Empty, not a guess.
     This used to fall back to "A1.2.1,A1.2.2,A1.2.3,A1.2.4" — four Additional
     Mathematics codes — for any page that declared none. Every page in this build
     declares its own, so the fallback was invisible here; on a page from another
     syllabus it silently pre-filled a reviewer's field with foreign objectives,
     ready to be submitted unchanged against a real mastery decision. A blank
     field asks the reviewer to supply the codes. A wrong one does not. */
  const defaultCodes = config.defaultCodes || "";
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
      ${reviewer ? `
      <div><span class="label">Tutor ID</span>
        <p class="review-identity-fixed" data-reviewer-external-id>${AlphaMath.escapeHTML(reviewer.externalId)}</p></div>
      <div><span class="label">Tutor name</span>
        <p class="review-identity-fixed" data-reviewer-name>${AlphaMath.escapeHTML(reviewer.displayName)}</p>
        <span class="fine">From your signed-in account. The server records the authenticated reviewer and ignores any name sent by this page.</span></div>
      ` : `
      <div><span class="label">Tutor ID</span>
        <p class="review-identity-fixed" data-reviewer-external-id>Set when you save</p></div>
      <div><span class="label">Tutor name</span>
        <p class="review-identity-fixed" data-reviewer-name>Set when you save</p>
        <span class="fine">You sign in when you save this review, and the server records that account as the reviewer.</span></div>
      `}
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

  (config.container || document.querySelector("main"))?.append(mount);
  const itemsMount = mount.querySelector("[data-review-items]");
  const status = mount.querySelector("[data-database-status]");
  const stateBadge = mount.querySelector("[data-review-state]");
  const submitButton = mount.querySelector("[data-submit-review]");

  function attempt(){
    return source.getAttempt();
  }

  function responseMarkup(question,response){
    if(!response) return "<em>No answer</em>";
    const parts = Array.isArray(question.parts) && question.parts.length
      ? question.parts
      : [{id:"answer",label:"Answer"}];
    const partRows = parts.map(part => {
      const value = String(response.parts?.[part.id] || "").trim();
      if(!value) return "";
      return `<div class="review-response-part">
        <strong>${AlphaMath.escapeHTML(part.label || part.id)}</strong>
        <math-field read-only aria-label="Saved response ${AlphaMath.escapeHTML(part.label || part.id)}">${AlphaMath.escapeHTML(value)}</math-field>
      </div>`;
    }).filter(Boolean);
    const legacy = String(response.legacyAnswer || "").trim();
    if(legacy){
      partRows.push(`<div class="review-response-part legacy">
        <strong>Earlier saved answer</strong>
        <math-field read-only aria-label="Earlier saved response">${AlphaMath.escapeHTML(legacy)}</math-field>
      </div>`);
    }
    if(partRows.length) return partRows.join("");
    const answer = String(response.answer || "").trim();
    if(!answer) return "<em>No answer</em>";
    return answer.split(/\r?\n/).filter(Boolean).map((line,index) =>
      `<math-field read-only aria-label="Saved response${index ? ` line ${index+1}` : ""}">${AlphaMath.escapeHTML(line)}</math-field>`
    ).join("");
  }

  function renderItems(){
    const current = attempt();
    const responseMap = new Map(current.responses.map(item => [String(item.itemId), item]));
    const rows = source.questions.map((question,index) => {
      const itemId = String(question.label || index+1);
      if(!responseMap.has(itemId) && !isExam) return "";
      return `<tr data-review-item="${AlphaMath.escapeHTML(itemId)}">
        <td><strong>${AlphaMath.escapeHTML(itemId)}</strong></td>
        <td class="review-response"><em>No answer</em></td>
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
    syncResponses();
  }

  function syncResponses(){
    const current = attempt();
    const responseMap = new Map(current.responses.map(item => [String(item.itemId), item]));
    source.questions.forEach((question,index) => {
      const itemId = String(question.label || index+1);
      const row = itemsMount.querySelector(`[data-review-item="${CSS.escape(itemId)}"]`);
      const cell = row?.querySelector(".review-response");
      if(!cell) return;
      cell.innerHTML = responseMarkup(question,responseMap.get(itemId));
      AlphaMath.initMathFields(cell);
    });
  }

  function reviewPayload(){
    // With a session these are display values only: the server takes the
    // reviewer from the authenticated principal and discards what we send.
    const reviewerExternalId = reviewer ? reviewer.externalId : "";
    const reviewerName = reviewer ? reviewer.displayName : "";
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

  async function showSignedInReviewer(){
    const account = await AlphaMath.auth?.me().catch(() => null);
    if(!account) return;
    const id = mount.querySelector("[data-reviewer-external-id]");
    const name = mount.querySelector("[data-reviewer-name]");
    if(id) id.textContent = account.externalId;
    if(name) name.textContent = account.displayName;
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
      const result = await config.onSubmit(review, current);
      AlphaMath.storage.set(`alphamath:${kind}:database-review-draft`, "");
      /* "Set when you save" has to stop being true once it is saved. Read the
         account back rather than assuming the sign-in was ours — the tutor may
         already have had a session open in this tab. */
      if(!reviewer) showSignedInReviewer();
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
  document.addEventListener("alphamath:attempt-changed",event => {
    if(!event.detail?.kind || event.detail.kind === kind) syncResponses();
  });
  renderItems();
  return {mount, refresh: syncResponses, rerender: renderItems};
  };

  /* ---------------------------------------------------------------------------
     In-page adapter — the learner exam and tutorial pages, unchanged.
     The attempt still comes from the page global and the submit path is exactly
     what it was before the renderer was parameterised: for an exam, store the
     attempt then the review; for a tutorial, one combined call.
     --------------------------------------------------------------------------- */
  const kind = document.body.dataset.reviewKind;
  if(!kind) return;
  const inPageSource = kind === "exam" ? window.AlphaMathExam : window.AlphaMathTutorial;
  if(!inPageSource) return;

  AlphaMath.createReviewPanel({
    kind,
    questions: inPageSource.questions,
    getAttempt: () => inPageSource.getAttempt(),
    reviewer: null,
    defaultCodes: document.body.dataset.syllabusCodes,
    async onSubmit(review, current){
      if(kind === "exam"){
        const savedAttempt = await AlphaMath.api.submit("/v1/exam-attempts", current);
        return AlphaMath.api.submit("/v1/exam-reviews", {
          examAttemptId: savedAttempt.id,
          ...review
        });
      }
      return AlphaMath.api.submit("/v1/tutorial-reviews", {
        ...current,
        clientReviewId: review.clientReviewId,
        attempt: {responses: current.responses},
        review
      });
    }
  });
})();
