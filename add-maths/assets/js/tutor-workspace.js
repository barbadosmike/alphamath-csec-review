/*
 * Tutor workspace — the four sections, populated from PostgreSQL.
 *
 * This replaces a static prototype whose numbers were typed in. Everything below
 * is read from the evidence API at load; nothing is computed client-side that the
 * server has not already recorded.
 *
 * SESSION AUTH, NOT THE SHARED TOKEN — this is not a style choice.
 * GET /v1/learners/:externalId/dashboard wraps its authorization in
 * `if(principal.kind === "session")`. A learner reads only their own record; a
 * tutor must hold an assignment. Present the SHARED deployment token instead and
 * none of those checks run — the route returns any learner's record to anyone
 * holding it. So this page authenticates through AlphaMath.auth and never through
 * AlphaMath.api. A workspace built on the token would quietly be an any-learner
 * reader, which is the opposite of the Privacy boundary section it renders.
 *
 * NAMES ARE AVAILABLE AND DELIBERATELY NOT SHOWN.
 * /v1/tutor/exam-attempts returns learnerDisplayName. This page renders
 * learnerExternalId only. The subject-scoped id is what routine tutor work is
 * supposed to run on, and a screen a tutor leaves open in a classroom should not
 * carry a child's name.
 */
(function(){
  "use strict";
  if(!window.AlphaMath || !AlphaMath.auth) return;

  const gate = document.querySelector("[data-auth-gate]");
  if(!gate) return;
  const status = document.querySelector("[data-workspace-status]");
  const mount = sel => document.querySelector(sel);

  const STATUSES = ["submitted", "claimed", "reviewed"];
  const OUTCOME_LABELS = {
    continue_practice: "Continue practice",
    evidence_of_progress: "Evidence of progress",
    mastery_confirmed: "Mastery confirmed"
  };

  const esc = value => AlphaMath.escapeHTML(String(value == null ? "" : value));
  const when = value => {
    if(!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString();
  };

  async function loadQueues(){
    const byStatus = {};
    for(const name of STATUSES){
      try{
        byStatus[name] = (await AlphaMath.auth.json(`/v1/tutor/exam-attempts?status=${name}`)).attempts || [];
      }catch(error){
        if(error.signedOut) throw error;
        byStatus[name] = [];
      }
    }
    return byStatus;
  }

  /* One dashboard per learner the tutor is actually assigned to. A 403 here is a
     correct answer, not a failure: it means the assignment was withdrawn between
     the queue read and this one, and the learner is dropped rather than shown
     with empty evidence that would read as "no progress". */
  async function loadLearners(externalIds){
    const records = [];
    for(const externalId of externalIds){
      try{
        records.push(await AlphaMath.auth.json(`/v1/learners/${encodeURIComponent(externalId)}/dashboard`));
      }catch(error){
        if(error.signedOut) throw error;
      }
    }
    return records;
  }

  function renderOverview(account, queues, learners){
    const total = STATUSES.reduce((sum, name) => sum + queues[name].length, 0);
    const decisions = learners.reduce((sum, record) =>
      sum + (record.objectives || []).filter(o => o.latestDecision === "mastery_confirmed").length, 0);
    mount("[data-overview]").innerHTML = `
      <div class="metric-grid">
        <div class="metric-card"><span>Learners assigned</span><strong>${learners.length}</strong><span>subject-scoped IDs only</span></div>
        <div class="metric-card gold"><span>Awaiting review</span><strong>${queues.submitted.length}</strong><span>submitted, unclaimed</span></div>
        <div class="metric-card blue"><span>In progress</span><strong>${queues.claimed.length}</strong><span>claimed by a tutor</span></div>
        <div class="metric-card green"><span>Mastery confirmed</span><strong>${decisions}</strong><span>objectives, by a named human</span></div>
      </div>
      <p class="fine">Signed in as ${esc(account.displayName || account.externalId)} · ${esc(account.role)} · ${total} attempt${total === 1 ? "" : "s"} visible.</p>`;
  }

  function renderPathway(learners){
    if(!learners.length){
      mount("[data-pathway]").innerHTML =
        `<div class="callout info"><p>No learners are assigned to this account yet. Assignments are made by an administrator; this page shows nothing until one exists.</p></div>`;
      return;
    }
    mount("[data-pathway]").innerHTML = `
      <div class="table-wrap">
        <table>
          <caption class="sr-only">Assigned learners and their recorded evidence</caption>
          <thead><tr>
            <th scope="col">Learner ID</th><th scope="col">Objectives with a decision</th>
            <th scope="col">Marked attempts</th><th scope="col">Tutorial reviews</th>
            <th scope="col">Latest decision</th><th scope="col">Reviewed</th>
          </tr></thead>
          <tbody>${learners.map(record => {
            const objectives = record.objectives || [];
            const latest = (record.recentEvidence || [])[0];
            return `<tr>
              <td><strong>${esc(record.learner?.externalId)}</strong></td>
              <td>${objectives.length}</td>
              <td>${record.counts?.examReviews ?? 0} of ${record.counts?.examAttempts ?? 0}</td>
              <td>${record.counts?.tutorialReviews ?? 0}</td>
              <td>${latest ? esc(OUTCOME_LABELS[latest.outcome] || latest.outcome) : "—"}</td>
              <td>${esc(when(latest?.reviewedAt))}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>`;
  }

  /* The gate reports what the record does and does not yet satisfy. It never
     decides: mastery-config.json sets humanTutorDecisionRequired, and this page
     has no authority to confirm anything. */
  function renderEvidenceGate(learners, mastery){
    if(!learners.length){ mount("[data-evidence]").innerHTML = ""; return; }
    const need = mastery?.mastery || {};
    mount("[data-evidence]").innerHTML = learners.map(record => {
      const objectives = record.objectives || [];
      const confirmed = objectives.filter(o => o.latestDecision === "mastery_confirmed");
      const authentic = record.counts?.examReviews ?? 0;
      const checks = [
        [`At least ${need.minimumAuthenticItems ?? 4} marked authentic items`, authentic >= (need.minimumAuthenticItems ?? 4), `${authentic} recorded`],
        ["A retained checkpoint", Boolean(need.retainedCheckpointRequired) ? confirmed.length > 0 : true, confirmed.length ? `${confirmed.length} objective(s)` : "none yet"],
        ["Human tutor confirmation", confirmed.length > 0, need.humanTutorDecisionRequired ? "required" : "not required"]
      ];
      return `<article class="card" style="margin-bottom:14px">
        <h3>${esc(record.learner?.externalId)}</h3>
        <ul class="checklist">${checks.map(([label, met, detail]) =>
          `<li>${met ? "" : "Outstanding — "}${esc(label)} <span class="fine">(${esc(detail)})</span></li>`).join("")}</ul>
        <p class="fine">Thresholds come from mastery-config.json. This page reports them; it does not apply them.</p>
      </article>`;
    }).join("");
  }

  /* Tell your tutor (spec 2026-08-01): the learner's signals, newest first, per
     assigned learner. A signal is the learner's own voice — rendered verbatim
     (escaped), never summarised — and marking it read is the acknowledgement,
     one-way by design. Signals change nothing by themselves: the tracker states
     a tutor cycles remain the only authority, which is why this section sits
     beside the pathway rather than inside it. */
  async function loadSignals(externalIds){
    const byLearner = new Map();
    for(const externalId of externalIds){
      try{
        const result = await AlphaMath.auth.json(`/v1/learner-signals?learner=${encodeURIComponent(externalId)}`);
        if((result.signals || []).length) byLearner.set(externalId, result.signals);
      }catch(error){
        if(error.signedOut) throw error;
        // 403/404 = assignment withdrawn between reads; drop, as loadLearners does.
      }
    }
    return byLearner;
  }

  function renderSignals(signalsByLearner){
    const mountPoint = mount("[data-signals]");
    if(!mountPoint) return;
    if(!signalsByLearner.size){
      mountPoint.innerHTML = `<div class="callout info"><p>No messages yet. When a learner uses <strong>Tell your tutor</strong>, it appears here — started topics, practice requests, and notes, each attributed and dated.</p></div>`;
      return;
    }
    mountPoint.innerHTML = [...signalsByLearner.entries()].map(([externalId, signals]) => `
      <h3>${esc(externalId)}</h3>
      <ul class="tyt-list">${signals.map(signal => `
        <li class="tyt-chip ${signal.readAt ? "tyt-sent" : ""}">
          <p class="fine">${esc(new Date(signal.submittedAt).toLocaleString())}
            ${signal.readAt ? `· read ${esc(new Date(signal.readAt).toLocaleDateString())}` : ""}</p>
          ${(signal.started || []).length ? `<p><strong>Started:</strong> ${signal.started.map(esc).join(", ")}</p>` : ""}
          ${(signal.practice || []).length ? `<p><strong>Wants practice on:</strong> ${signal.practice.map(esc).join(", ")}</p>` : ""}
          ${signal.note ? `<p><strong>Note:</strong> ${esc(signal.note)}</p>` : ""}
          ${signal.readAt ? "" : `<button type="button" class="secondary" data-mark-read="${esc(signal.id)}">Mark read</button>`}
        </li>`).join("")}</ul>`).join("");
  }

  function renderPrivacy(learners){
    mount("[data-privacy]").innerHTML = `
      <div class="callout warning">
        <p><strong>This screen shows subject-scoped identifiers only.</strong> The API returns each learner's display name; this page does not render it, so a workspace left open in a classroom carries no child's name.</p>
        <p>${learners.length} learner record${learners.length === 1 ? "" : "s"} loaded, each one an account this tutor holds an assignment for. The server re-checks that assignment on every request — a changed URL returns 403, not another learner's evidence.</p>
        <p class="fine">Answers, drawings and tutor annotations are not fetched here. They are read on the marking pages, one attempt at a time.</p>
      </div>`;
  }

  AlphaMath.auth.requireTutor(gate, async (account) => {
    document.querySelector("[data-sign-out]")?.addEventListener("click", async () => {
      await AlphaMath.auth.logout();
      location.reload();
    });
    status.textContent = "Loading assigned learners…";
    try{
      const queues = await loadQueues();
      /* The roster comes from the assignment table, NOT from the marking queue.
         This list used to be derived from exam attempts, so a learner who was
         assigned but had not yet sat an exam was invisible on a page headed
         "Assigned learners" — and the empty state told the tutor that no
         assignment existed. Two learners with intake evidence and no attempt were
         missing for exactly that reason. The queue still drives the review counts
         below; it just no longer decides who exists. */
      const roster = (await AlphaMath.auth.json("/v1/tutor/learners")).learners || [];
      const externalIds = [...new Set([
        ...roster.map(entry => entry.externalId),
        ...STATUSES.flatMap(name => queues[name].map(a => a.learnerExternalId))
      ].filter(Boolean))];
      const learners = await loadLearners(externalIds);
      let mastery = null;
      try{ mastery = await (await fetch("assets/data/mastery-config.json")).json(); }catch(_error){}

      const signalsByLearner = await loadSignals(externalIds);

      renderOverview(account, queues, learners);
      renderPathway(learners);
      renderSignals(signalsByLearner);
      renderEvidenceGate(learners, mastery);
      renderPrivacy(learners);

      document.querySelector("[data-signals]")?.addEventListener("click", async event => {
        const button = event.target.closest("[data-mark-read]");
        if(!button) return;
        button.disabled = true;
        try{
          await AlphaMath.auth.json(`/v1/learner-signals/${encodeURIComponent(button.getAttribute("data-mark-read"))}/read`, {method: "POST"});
          renderSignals(await loadSignals(externalIds));
        }catch(error){
          button.disabled = false;
          if(error.signedOut) location.reload();
        }
      });
      status.textContent = "";
      document.querySelector("[data-workspace]").hidden = false;
    }catch(error){
      status.textContent = error.message;
      if(error.signedOut) location.reload();
    }
  });
})();
