(function(){
  "use strict";
  if(!window.AlphaMath || !AlphaMath.auth) return;

  const gate = document.querySelector("[data-auth-gate]");
  const loadStatus = document.querySelector("[data-load-status]");
  const workPanel = document.querySelector("[data-learner-work]");
  const itemsMount = document.querySelector("[data-items]");
  const releaseButton = document.querySelector("[data-release]");
  if(!gate || !itemsMount) return;

  // The query parameter is an opaque id and is validated as one. It is never
  // interpolated into markup, only encoded into request paths.
  const attemptId = new URLSearchParams(location.search).get("attempt") || "";
  const OPAQUE_ID = /^[A-Za-z0-9._-]{1,100}$/;

  const overlays = new Map();     // itemId -> tutor overlay PNG data URL
  let tutorId = "";
  let draftState = null;

  function setDraftState(text){
    if(!draftState){
      draftState = document.createElement("p");
      draftState.className = "fine";
      draftState.setAttribute("role", "status");
      draftState.setAttribute("aria-live", "polite");
      document.querySelector("[data-learner-work] .review-heading")?.append(draftState);
    }
    draftState.textContent = text;
  }

  const when = (value) => {
    if(!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString();
  };
  const setText = (selector, text) => {
    const node = document.querySelector(selector);
    if(node) node.textContent = text;
  };

  /* Renders the learner's read-only work. Typed answers arrive inline with the
     attempt; each drawing is fetched separately as PNG bytes, so an item with
     no drawing costs no request and the page is usable before images land. */
  function renderLearnerWork(attempt, canMark, draft){
    itemsMount.innerHTML = attempt.responses.map(item => {
      const parts = Object.entries(item.parts || {}).filter(([, v]) => String(v || "").trim());
      const answered = parts.length || String(item.answer || "").trim();
      return `
      <article class="card" style="margin-bottom:16px">
        <h3>Question ${AlphaMath.escapeHTML(String(item.itemId))}${item.flagged ? ' <span class="pill">Flagged by learner</span>' : ""}</h3>
        ${
          answered
            ? (parts.length
                ? parts.map(([id, value]) => `
                    <div class="review-response-part">
                      <strong>Part ${AlphaMath.escapeHTML(id)}</strong>
                      <math-field read-only aria-label="Learner response, part ${AlphaMath.escapeHTML(id)}">${AlphaMath.escapeHTML(String(value))}</math-field>
                    </div>`).join("")
                : `<math-field read-only aria-label="Learner response">${AlphaMath.escapeHTML(String(item.answer))}</math-field>`)
            : "<p><em>No typed answer.</em></p>"
        }
        ${
          item.hasDrawing
            ? `<figure class="draw-panel" data-drawing-for="${AlphaMath.escapeHTML(String(item.itemId))}">
                 <figcaption class="fine">Learner sketchpad working — read-only evidence. Your red marks are a separate layer and never alter it.</figcaption>
                 <p class="fine" data-drawing-status>Loading working…</p>
               </figure>`
            : `<p class="fine">No sketchpad working saved for this question.</p>`
        }
      </article>`;
    }).join("");

    AlphaMath.initMathFields(itemsMount);
    attempt.responses
      .filter(item => item.hasDrawing)
      .forEach(item => loadDrawing(attempt, item, canMark, draft));
  }

  const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

  /*
   * Composite the tutor's red pen OVER the learner's drawing without ever
   * touching it.
   *
   * Two stacked layers, never flattened together:
   *   the learner's PNG, an <img> with pointer-events disabled — evidence,
   *   a transparent canvas above it — the tutor's marks, saved separately.
   *
   * The overlay is pinned to the learner's stored sketchpadSize. Resizing it
   * would resample through drawImage and misregister every mark against the
   * working it refers to, so the size controls are removed rather than disabled.
   */
  async function loadDrawing(attempt, item, canMark, draft){
    const itemId = String(item.itemId);
    const figure = itemsMount.querySelector(`[data-drawing-for="${CSS.escape(itemId)}"]`);
    if(!figure) return;
    const statusNode = figure.querySelector("[data-drawing-status]");
    try{
      const response = await AlphaMath.auth.fetch(
        `/v1/exam-attempts/${encodeURIComponent(attempt.id)}/items/${encodeURIComponent(itemId)}/drawing`
      );
      if(!response.ok) throw new Error(`Working unavailable (${response.status}).`);
      const blob = await response.blob();

      const stack = document.createElement("div");
      stack.className = "layer-stack";

      const image = new Image();
      // Object URL, not a re-encoded data URL: what is displayed is byte-identical
      // to what the learner submitted.
      image.src = URL.createObjectURL(blob);
      image.alt = `Learner sketchpad working for question ${itemId}`;
      image.className = "learner-layer";
      await new Promise(resolve => image.addEventListener("load", resolve, {once: true}));
      stack.append(image);
      statusNode?.remove();
      figure.append(stack);

      if(!canMark) return;

      const padHost = document.createElement("div");
      padHost.className = "tutor-pad-tools";
      const size = item.sketchpadSize || "standard";
      const overlayState = {sketchpadSize: size, drawing: ""};

      const pad = AlphaMath.createDrawingPad(padHost, {
        state: overlayState,
        transparent: true,
        penColor: "#c62828",
        eraserMode: "destination-out",
        fixedSize: size,
        label: `Tutor marks for question ${itemId}. Your marks are a separate layer; the learner's working is not changed.`,
        onSave: async (dataUrl) => {
          overlays.set(itemId, dataUrl);
          try{
            await AlphaMath.drafts.saveAnnotation(
              attempt.id, tutorId, itemId, await dataUrlToBlob(dataUrl), size
            );
            setDraftState("Saved on this device.");
          }catch{
            setDraftState("Could not save locally — keep this tab open.");
          }
        }
      });

      pad.canvas.classList.add("tutor-layer");
      stack.append(pad.canvas);       // the canvas sits over the image
      figure.append(padHost);         // its tools sit below the stack

      // Restore a local overlay draft, but only if it was drawn against the same
      // canvas size. A mismatch means the marks would sit in the wrong place, so
      // it is refused rather than shown misaligned.
      const saved = draft?.annotations?.[itemId];
      if(saved?.blob){
        if(saved.sketchpadSize !== size){
          setDraftState(`A saved overlay for question ${itemId} was drawn at a different canvas size and was not restored.`);
        }else{
          const url = URL.createObjectURL(saved.blob);
          const restored = new Image();
          restored.addEventListener("load", () => {
            pad.canvas.getContext("2d").drawImage(restored, 0, 0, pad.canvas.width, pad.canvas.height);
            URL.revokeObjectURL(url);
            overlays.set(itemId, pad.canvas.toDataURL("image/png"));
          }, {once: true});
          restored.src = url;
        }
      }
    }catch(error){
      if(statusNode) statusNode.textContent = error.message;
    }
  }

  async function start(account){
    tutorId = account.externalId;
    if(!OPAQUE_ID.test(attemptId)){
      loadStatus.textContent = "No attempt was specified. Choose one from the review queue.";
      return;
    }

    loadStatus.textContent = "Claiming the attempt…";
    let claim = null;
    let readOnlyReason = "";
    try{
      claim = await AlphaMath.auth.json(`/v1/exam-attempts/${encodeURIComponent(attemptId)}/claim`, {method: "POST"});
      setText("[data-claim-state]", `Claim held until ${when(claim.claimExpiresAt)}`);
    }catch(error){
      // A 409 means the attempt is held by another tutor or already reviewed.
      // Either way it may still be readable, so degrade to read-only rather than
      // showing a blank page — but keep the reason on screen.
      if(error.signedOut){ location.reload(); return; }
      setText("[data-claim-state]", "Not claimed — read-only");
      readOnlyReason = `${error.message} You can read this attempt, but marking it requires an active claim.`;
    }

    let attempt;
    try{
      attempt = await AlphaMath.auth.json(`/v1/exam-attempts/${encodeURIComponent(attemptId)}`);
    }catch(error){
      loadStatus.textContent = error.message;
      if(error.signedOut) location.reload();
      return;
    }

    setText("[data-attempt-title]", `Marking ${attempt.instrumentId}`);
    setText("[data-attempt-subtitle]",
      `${attempt.responses.length} question${attempt.responses.length === 1 ? "" : "s"} · locked ${when(attempt.lockedAt)}`);
    setText("[data-attempt-learner]", `Learner ${attempt.learnerExternalId}`);
    setText("[data-attempt-submitted]", `Submitted ${when(attempt.submittedAt)}`);
    loadStatus.textContent = readOnlyReason;
    workPanel.hidden = false;

    if(claim){
      releaseButton.hidden = false;
      releaseButton.addEventListener("click", async () => {
        releaseButton.disabled = true;
        try{
          await AlphaMath.auth.json(`/v1/exam-attempts/${encodeURIComponent(attemptId)}/release`, {method: "POST"});
          location.href = "tutor-queue.html";
        }catch(error){
          loadStatus.textContent = error.message;
          releaseButton.disabled = false;
        }
      });
    }

    // Local draft, if this tutor has one for this attempt on this device.
    const draft = AlphaMath.drafts.available()
      ? await AlphaMath.drafts.load(attempt.id, tutorId)
      : null;
    if(draft) setDraftState(`Restored your local draft from ${when(draft.updatedAt)}. It is saved on this device only, and is not evidence until submitted.`);

    renderLearnerWork(attempt, Boolean(claim), draft);

    /* No claim, no marking panel.
       Rendering a submit form the server will refuse with 409 invites a tutor to
       type a full review and lose it. The learner's work stays readable; the
       means of recording a judgement does not appear unless it can be used. */
    if(!claim){
      const note = document.createElement("p");
      note.className = "callout warning";
      note.textContent = attempt.reviewStatus === "reviewed"
        ? "This attempt has already been reviewed. It is shown here as a record; it cannot be marked again."
        : "Another tutor holds the claim on this attempt. Marking will be possible once they submit or release it, or their claim expires.";
      workPanel.append(note);
      return;
    }

    // Same renderer as the learner page, given a remote attempt and a reviewer
    // identity from the session rather than typed in.
    AlphaMath.createReviewPanel({
      kind: "exam",
      questions: attempt.responses.map(item => ({label: String(item.itemId), parts: []})),
      getAttempt: () => ({...attempt, locked: true}),
      reviewer: {externalId: account.externalId, displayName: account.displayName},
      defaultCodes: document.body.dataset.syllabusCodes,
      async onSubmit(review){
        const result = await AlphaMath.auth.json("/v1/exam-reviews", {
          method: "POST",
          body: JSON.stringify({examAttemptId: attempt.id, ...review})
        });
        /* Only after the server has accepted it. Clearing earlier would lose a
           tutor's marking if the request failed; clearing later risks a stale
           local draft overwriting a finalised review on the next visit. */
        await AlphaMath.drafts.clear(attempt.id, tutorId);
        setDraftState("Submitted. The local draft for this attempt has been cleared.");
        return result;
      }
    });

    // Persist typed marking as it is entered. Debounced, because a keystroke is
    // not worth a write, and a tutor who loses a tab mid-sentence is.
    const panel = document.querySelector("#tutor-review");
    if(panel){
      let timer = null;
      const persist = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const text = {};
          panel.querySelectorAll("[data-review-item]").forEach(row => {
            text[row.dataset.reviewItem] = {
              outcome: row.querySelector("[data-item-outcome]")?.value || "not_reviewed",
              feedback: row.querySelector("[data-item-feedback]")?.value || ""
            };
          });
          text.__overall = {
            outcome: panel.querySelector("#reviewOutcome")?.value || "",
            feedback: panel.querySelector("#reviewFeedback")?.value || "",
            codes: panel.querySelector("#reviewCodes")?.value || ""
          };
          try{
            await AlphaMath.drafts.save(attempt.id, tutorId, {text});
            setDraftState(navigator.onLine
              ? "Saved on this device."
              : "Saved on this device; waiting to sync.");
          }catch{
            setDraftState("Could not save locally — keep this tab open.");
          }
        }, 400);
      };
      panel.addEventListener("input", persist);
      panel.addEventListener("change", persist);

      // Restore typed marking from the local draft.
      if(draft?.text){
        panel.querySelectorAll("[data-review-item]").forEach(row => {
          const saved = draft.text[row.dataset.reviewItem];
          if(!saved) return;
          const outcome = row.querySelector("[data-item-outcome]");
          const feedback = row.querySelector("[data-item-feedback]");
          if(outcome && saved.outcome) outcome.value = saved.outcome;
          if(feedback && saved.feedback) feedback.value = saved.feedback;
        });
        const overall = draft.text.__overall;
        if(overall){
          const o = panel.querySelector("#reviewOutcome");
          const f = panel.querySelector("#reviewFeedback");
          const c = panel.querySelector("#reviewCodes");
          if(o && overall.outcome) o.value = overall.outcome;
          if(f && overall.feedback) f.value = overall.feedback;
          if(c && overall.codes) c.value = overall.codes;
        }
      }

      window.addEventListener("online", () => setDraftState("Back online."));
      window.addEventListener("offline", () => setDraftState("Offline. Marking is saved on this device; submit when you reconnect."));
    }
  }

  AlphaMath.auth.requireTutor(gate, start);
})();
