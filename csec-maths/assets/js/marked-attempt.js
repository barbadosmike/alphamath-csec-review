/*
 * PORTED FILE — from the CSEC Additional Mathematics build's
 * assets/js/marked-attempt.js. qa-suite.mjs pins that file's SHA-256; when it
 * changes upstream the suite fails and tells you to re-port this one. See
 * PHASE8_ADAPTER.md.
 *
 * Nothing here is syllabus-specific: every value is read from the evidence API,
 * which is why one implementation serves both syllabuses. The `parts` branch in
 * renderItems() is inert for CSEC Mathematics — this instrument submits answer
 * schema version 1, with no lettered parts — and falls through to item.answer.
 * It is kept rather than stripped so re-porting stays a copy, not a merge.
 */
(function(){
  "use strict";
  if(!window.AlphaMath || !AlphaMath.auth) return;

  const gate = document.querySelector("[data-auth-gate]");
  const loadStatus = document.querySelector("[data-load-status]");
  const listPanel = document.querySelector("[data-returned-list]");
  const listRows = document.querySelector("[data-returned-rows]");
  const markedPanel = document.querySelector("[data-marked]");
  const itemsMount = document.querySelector("[data-items]");
  const toggleButton = document.querySelector("[data-toggle-marks]");
  const marksState = document.querySelector("[data-marks-state]");
  if(!gate) return;

  const attemptId = new URLSearchParams(location.search).get("attempt") || "";
  const OPAQUE_ID = /^[A-Za-z0-9._-]{1,100}$/;

  const when = (value) => {
    if(!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.valueOf()) ? "—" : d.toLocaleString();
  };
  const setText = (sel, text) => { const n = document.querySelector(sel); if(n) n.textContent = text; };

  // CONTEXT.md's vocabulary: an outcome is evidence, never a grade.
  const OUTCOME_LABELS = {
    continue_practice: "Continue practice",
    evidence_of_progress: "Evidence of progress",
    mastery_confirmed: "Mastery confirmed by your tutor"
  };
  const ITEM_LABELS = {
    correct: "Correct", partial: "Partly correct",
    incorrect: "Not yet correct", not_reviewed: "Not reviewed"
  };

  /*
   * The caption has to follow the toggle, not the render.
   *
   * It used to be written once, when the item was rendered, and then say "with
   * your tutor's marks over it" even after the learner had hidden them — the
   * caption contradicting the image directly above it. That matters more than it
   * looks: this page exists so a learner can establish which marks on the page
   * are theirs, and a caption that lies about whose marks are showing defeats
   * the separation the whole evidence model is built on. Captions carrying
   * data-has-marks are rewritten by wireToggle().
   */
  const CAPTION_WITH_MARKS = "Your working, with your tutor's marks over it";
  const CAPTION_MARKS_HIDDEN = "Your working, exactly as you submitted it";
  const CAPTION_PLAIN = "Your working";

  /* ---------------- index of returned attempts ---------------- */

  async function showList(){
    listPanel.hidden = false;
    loadStatus.textContent = "Loading your returned work…";
    try{
      const payload = await AlphaMath.auth.json("/v1/learner/exam-attempts");
      if(!payload.attempts.length){
        listRows.innerHTML = `<tr><td colspan="5"><em>Nothing has been returned yet. Work appears here once a tutor has finished marking it.</em></td></tr>`;
        loadStatus.textContent = "";
        return;
      }
      listRows.innerHTML = payload.attempts.map(row => `
        <tr>
          <td><strong>${AlphaMath.escapeHTML(row.instrumentId || "—")}</strong></td>
          <td>${AlphaMath.escapeHTML(when(row.submittedAt))}</td>
          <td>${AlphaMath.escapeHTML(when(row.reviewedAt))}</td>
          <td>${AlphaMath.escapeHTML(row.reviewerName || "—")}</td>
          <td><a class="button primary" href="marked-attempt.html?attempt=${encodeURIComponent(row.id)}">Open</a></td>
        </tr>`).join("");
      loadStatus.textContent = "";
    }catch(error){
      loadStatus.textContent = error.message;
      if(error.signedOut) location.reload();
    }
  }

  /* ---------------- one marked attempt ---------------- */

  function renderItems(marked){
    const reviewByItem = new Map(
      (marked.itemReviews || []).map(r => [String(r.itemId), r])
    );

    itemsMount.innerHTML = marked.responses.map(item => {
      const id = String(item.itemId);
      const review = reviewByItem.get(id);
      const parts = Object.entries(item.parts || {}).filter(([, v]) => String(v || "").trim());
      const partFeedback = Object.entries(review?.partFeedback || {}).filter(([, v]) => String(v || "").trim());

      return `
      <article class="card" style="margin-bottom:16px">
        <h3>Question ${AlphaMath.escapeHTML(id)}${
          review ? ` <span class="pill">${AlphaMath.escapeHTML(ITEM_LABELS[review.outcome] || review.outcome)}</span>` : ""
        }</h3>

        ${
          parts.length
            ? parts.map(([partId, value]) => `
                <div class="review-response-part">
                  <strong>Part ${AlphaMath.escapeHTML(partId)}</strong>
                  <math-field read-only aria-label="Your answer, part ${AlphaMath.escapeHTML(partId)}">${AlphaMath.escapeHTML(String(value))}</math-field>
                </div>`).join("")
            : String(item.answer || "").trim()
              ? `<math-field read-only aria-label="Your answer">${AlphaMath.escapeHTML(String(item.answer))}</math-field>`
              : "<p><em>You did not type an answer for this question.</em></p>"
        }

        ${
          item.hasDrawing
            ? `<figure class="draw-panel" data-drawing-for="${AlphaMath.escapeHTML(id)}">
                 <figcaption class="fine" data-drawing-caption${item.hasTutorMarks ? " data-has-marks" : ""}>${
                   item.hasTutorMarks ? CAPTION_WITH_MARKS : CAPTION_PLAIN
                 }</figcaption>
                 <p class="fine" data-drawing-status>Loading your working…</p>
               </figure>`
            : ""
        }

        ${
          review?.feedback
            ? `<div class="callout info"><p><strong>Tutor comment.</strong> ${AlphaMath.escapeHTML(review.feedback)}</p></div>`
            : ""
        }
        ${
          partFeedback.length
            ? partFeedback.map(([partId, text]) =>
                `<div class="callout info"><p><strong>Part ${AlphaMath.escapeHTML(partId)}.</strong> ${AlphaMath.escapeHTML(text)}</p></div>`).join("")
            : ""
        }
      </article>`;
    }).join("");

    AlphaMath.initMathFields(itemsMount);
    marked.responses
      .filter(item => item.hasDrawing)
      .forEach(item => loadLayers(marked.id, item));
  }

  /*
   * Composite AT RENDER TIME, never by flattening.
   *
   * The learner's PNG and the tutor's overlay are fetched as two separate
   * images and stacked. Neither file is modified, and the learner can turn the
   * top layer off to see exactly what they submitted — which is the point: their
   * own work has to remain inspectable independently of anyone's marks on it.
   */
  async function loadLayers(id, item){
    const itemId = String(item.itemId);
    const figure = itemsMount.querySelector(`[data-drawing-for="${CSS.escape(itemId)}"]`);
    if(!figure) return;
    const statusNode = figure.querySelector("[data-drawing-status]");
    try{
      const res = await AlphaMath.auth.fetch(
        `/v1/exam-attempts/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/drawing`);
      if(!res.ok) throw new Error(`Your working could not be loaded (${res.status}).`);

      const stack = document.createElement("div");
      stack.className = "layer-stack";
      const own = new Image();
      own.src = URL.createObjectURL(await res.blob());
      own.alt = `Your sketchpad working for question ${itemId}`;
      own.className = "learner-layer";
      await new Promise(r => own.addEventListener("load", r, {once: true}));
      stack.append(own);
      statusNode?.remove();
      figure.append(stack);

      if(!item.hasTutorMarks) return;

      const marks = await AlphaMath.auth.fetch(
        `/v1/exam-attempts/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/annotation`);
      if(!marks.ok) return;   // no marks on this item is not an error
      const overlay = new Image();
      overlay.src = URL.createObjectURL(await marks.blob());
      overlay.alt = `Your tutor's marks on question ${itemId}`;
      overlay.className = "tutor-layer tutor-marks";
      stack.append(overlay);
    }catch(error){
      if(statusNode) statusNode.textContent = error.message;
    }
  }

  function wireToggle(){
    let showing = true;
    toggleButton.addEventListener("click", () => {
      showing = !showing;
      document.querySelectorAll(".tutor-marks").forEach(node => {
        node.style.display = showing ? "" : "none";
      });
      // Only captions on items that actually carry marks; an item with none
      // reads "Your working" in both states, because that is what it is.
      document.querySelectorAll("[data-drawing-caption][data-has-marks]").forEach(node => {
        node.textContent = showing ? CAPTION_WITH_MARKS : CAPTION_MARKS_HIDDEN;
      });
      toggleButton.textContent = showing ? "Hide tutor marks" : "Show tutor marks";
      toggleButton.setAttribute("aria-pressed", String(showing));
      marksState.textContent = showing
        ? "Tutor marks are shown over your working."
        : "Tutor marks hidden. This is exactly what you submitted.";
    });
  }

  async function showAttempt(){
    if(!OPAQUE_ID.test(attemptId)){
      loadStatus.textContent = "That link does not look right. Choose an attempt from your returned work.";
      return showList();
    }
    loadStatus.textContent = "Loading your marked work…";
    let marked;
    try{
      marked = await AlphaMath.auth.json(
        `/v1/learner/exam-attempts/${encodeURIComponent(attemptId)}/review`);
    }catch(error){
      loadStatus.textContent = error.message;
      if(error.signedOut) location.reload();
      return;
    }

    setText("[data-title]", `${marked.instrumentId} — marked`);
    setText("[data-subtitle]",
      `${marked.responses.length} question${marked.responses.length === 1 ? "" : "s"} · submitted ${when(marked.submittedAt)}`);
    setText("[data-meta-reviewer]", `Marked by ${marked.reviewerName || "your tutor"}`);
    setText("[data-meta-reviewed]", `Returned ${when(marked.reviewedAt)}`);
    setText("[data-meta-outcome]", OUTCOME_LABELS[marked.overallOutcome] || marked.overallOutcome);
    setText("[data-overall-feedback]", marked.overallFeedback || "Your tutor did not leave an overall comment.");

    loadStatus.textContent = "";
    markedPanel.hidden = false;

    const anyMarks = marked.responses.some(r => r.hasTutorMarks);
    if(anyMarks){
      wireToggle();
      marksState.textContent = "Tutor marks are shown over your working.";
    }else{
      // Old reviews predate annotations entirely, and a tutor may simply not have
      // drawn anything. Offering a toggle for marks that do not exist is noise.
      toggleButton.hidden = true;
      marksState.textContent = "Your tutor left written comments on this attempt.";
    }

    renderItems(marked);
  }

  AlphaMath.auth.requireLearner(gate, () => {
    document.querySelector("[data-sign-out]")?.addEventListener("click", async () => {
      await AlphaMath.auth.logout();
      location.reload();
    });
    return attemptId ? showAttempt() : showList();
  });
})();
