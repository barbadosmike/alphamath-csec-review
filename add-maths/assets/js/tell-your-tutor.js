/*
 * Tell your tutor — the learner's signal channel.
 * Spec: 2026-08-01_Tell_Your_Tutor_Build_Spec_T16.md (engagement root).
 *
 * The one sentence that governs everything here: the FIRST intake is the
 * permanent baseline, and this page is the append-only stream that SUPERSEDES
 * it into a current picture — it amends nothing, and it writes no mastery
 * state. The board below is a VIEW (baseline ∪ signals-to-date); the learner's
 * action composes a SIGNAL; the tutor's tracker remains the only authority.
 *
 * Connected surface, deliberately: unlike the offline-first instruments, a
 * message to a person requires the person signed in, so this page gates on a
 * learner session up front. Tap/click is the primary mechanism throughout —
 * drag exists nowhere, by accessibility decision (WCAG 2.5.7), not omission.
 *
 * PORTED FILE — byte-identical across both builds; the CSEC qa-suite pins it.
 * The taxonomy global differs per build and both are consulted.
 */
(function(){
  "use strict";
  if(!window.AlphaMath || !AlphaMath.auth) return;
  const gate = document.querySelector("[data-auth-gate]");
  const shell = document.querySelector("[data-tyt]");
  if(!gate || !shell) return;

  const esc = value => AlphaMath.escapeHTML(String(value == null ? "" : value));
  const TAX = window.ADD_MATHS_TAXONOMY || window.CSEC_TAXONOMY || {modules: []};
  const PRACTICE_CAP = 5; // spec O3 — tunable, enforced again by the server

  // code -> {title, moduleName}; insertion order preserves syllabus order.
  const codeInfo = new Map();
  (TAX.modules || []).forEach(module =>
    (module.topics || []).forEach(topic =>
      (topic.items || []).forEach(item =>
        codeInfo.set(item.code, {title: item.t || "", moduleName: module.name || module.id}))));

  const state = {
    baseline: new Map(),      // code -> 'confident' | 'practice' | 'not-started' (FIRST intake)
    baselineDate: null,
    startedSent: new Map(),   // code -> first signal date it appeared in
    pendingStarted: new Set(),// toggled this visit, not yet sent
    pendingId: null           // one client id per composed message; survives a failed send
  };

  async function load(account){
    /* The learner's own record. Provisioning (SOP-OPS-004 §3) makes the account
       id the learner id, so account.externalId addresses the dashboard. An
       older CLI-linked account with a divergent id would 403 here — surfaced,
       not masked, because guessing would be worse. */
    const dashboard = await AlphaMath.auth.json(
      `/v1/learners/${encodeURIComponent(account.externalId)}/dashboard`);
    /* baselineIntake is the server-named FIRST intake — the permanent baseline
       (spec §2). Deliberately not latestIntake: a sparse second copy must never
       move the anchor this board is drawn from. */
    const base = dashboard.baselineIntake;
    state.baseline = new Map((base?.topics || []).map(t => [t.code, t.status || "not-started"]));
    state.baselineDate = base?.submittedAt || null;

    const mine = await AlphaMath.auth.json("/v1/learner-signals");
    state.startedSent = new Map();
    (mine.signals || []).slice().reverse().forEach(signal =>
      (signal.started || []).forEach(code => {
        if(!state.startedSent.has(code)) state.startedSent.set(code, signal.submittedAt);
      }));
  }

  function grouped(codes){
    const byModule = new Map();
    codes.forEach(code => {
      const name = codeInfo.get(code)?.moduleName || "Other";
      if(!byModule.has(name)) byModule.set(name, []);
      byModule.get(name).push(code);
    });
    return byModule;
  }

  function chip(code, kind){
    const info = codeInfo.get(code) || {title: ""};
    const title = info.title ? ` — ${esc(info.title)}` : "";
    if(kind === "sent"){
      const when = new Date(state.startedSent.get(code)).toLocaleDateString();
      return `<li class="tyt-chip tyt-sent"><strong>${esc(code)}</strong>${title}
        <span class="fine">told your tutor ${esc(when)}</span></li>`;
    }
    if(kind === "pending"){
      return `<li class="tyt-chip tyt-pending"><button type="button" data-untoggle="${esc(code)}">
        <strong>${esc(code)}</strong>${title} <span class="fine">will tell your tutor — tap to undo</span></button></li>`;
    }
    return `<li class="tyt-chip"><button type="button" data-toggle="${esc(code)}">
      <strong>${esc(code)}</strong>${title} <span class="fine">I've started this</span></button></li>`;
  }

  function renderBoard(){
    const notStarted = [...state.baseline.entries()]
      .filter(([code, status]) => status === "not-started"
        && !state.startedSent.has(code) && !state.pendingStarted.has(code))
      .map(([code]) => code);
    const started = [
      ...[...state.startedSent.keys()].map(code => [code, "sent"]),
      ...[...state.pendingStarted].map(code => [code, "pending"])
    ];

    const startedHtml = started.length
      ? `<ul class="tyt-list">${started.map(([code, kind]) => chip(code, kind)).join("")}</ul>`
      : `<p class="fine">Nothing yet — tap a topic on the right when you begin it.</p>`;

    const notStartedHtml = notStarted.length
      ? [...grouped(notStarted).entries()].map(([name, codes]) => `
          <details class="tyt-module" open>
            <summary>${esc(name)} <span class="fine">${codes.length}</span></summary>
            <ul class="tyt-list">${codes.map(code => chip(code, "open")).join("")}</ul>
          </details>`).join("")
      : `<p class="fine">${state.baseline.size
          ? "Every topic from your intake is started or in progress — brilliant."
          : "No intake on record yet, so there is no Not-started list to draw from. The practice section and the note below still work."}</p>`;

    shell.querySelector("[data-board]").innerHTML = `
      <div class="tyt-columns">
        <div><h3>Started</h3>${startedHtml}</div>
        <div><h3>Not started <span class="fine">from your intake${state.baselineDate
          ? ` of ${esc(new Date(state.baselineDate).toLocaleDateString())}` : ""}</span></h3>${notStartedHtml}</div>
      </div>`;
  }

  function renderPractice(){
    const eligible = [...new Set([
      ...[...state.baseline.entries()]
        .filter(([, status]) => status === "confident" || status === "practice")
        .map(([code]) => code),
      ...state.startedSent.keys(),
      ...state.pendingStarted
    ])];
    shell.querySelector("[data-practice]").innerHTML = eligible.length
      ? [...grouped(eligible).entries()].map(([name, codes]) => `
          <details class="tyt-module">
            <summary>${esc(name)} <span class="fine">${codes.length}</span></summary>
            <ul class="tyt-list">${codes.map(code => {
              const info = codeInfo.get(code) || {title: ""};
              return `<li class="tyt-chip"><label>
                <input type="checkbox" name="practice" value="${esc(code)}">
                <strong>${esc(code)}</strong>${info.title ? ` — ${esc(info.title)}` : ""}</label></li>`;
            }).join("")}</ul>
          </details>`).join("")
      : `<p class="fine">Practice requests open up for topics you know or have started — none yet.</p>`;
  }

  function delta(){
    const practice = [...shell.querySelectorAll('input[name="practice"]:checked')].map(i => i.value);
    const note = shell.querySelector("[data-note]").value.trim();
    return {started: [...state.pendingStarted], practice, note};
  }

  function refreshSend(){
    const d = delta();
    const button = shell.querySelector("[data-send]");
    const empty = !d.started.length && !d.practice.length && !d.note;
    button.disabled = empty || d.practice.length > PRACTICE_CAP;
    shell.querySelector("[data-cap-warning]").hidden = d.practice.length <= PRACTICE_CAP;
    shell.querySelector("[data-summary]").textContent = empty
      ? "Nothing to send yet."
      : "You're telling your tutor: "
        + [d.started.length ? `started ${d.started.join(", ")}` : "",
           d.practice.length ? `more practice on ${d.practice.join(", ")}` : "",
           d.note ? "a note" : ""].filter(Boolean).join(" · ") + ".";
  }

  async function send(account){
    const d = delta();
    /* One client id per composed message: minted when the send starts, reused if
       the send fails (so a retry cannot double-store), cleared on success (so
       the NEXT message is a new message — the intake's cleared-id lesson, on
       the side where clearing is correct). */
    state.pendingId = state.pendingId ||
      `signal:${globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(16).slice(2)}`;
    const status = shell.querySelector("[data-send-status]");
    const button = shell.querySelector("[data-send]");
    button.disabled = true;
    status.textContent = "Sending to your tutor…";
    try{
      await AlphaMath.auth.json("/v1/learner-signals", {
        method: "POST",
        body: JSON.stringify({
          clientSignalId: state.pendingId,
          submittedAt: new Date().toISOString(),
          ...d
        })
      });
      state.pendingId = null;
      state.pendingStarted.clear();
      shell.querySelector("[data-note]").value = "";
      await load(account);
      renderBoard(); renderPractice(); refreshSend();
      status.textContent = "Sent. Your tutor sees it in their workspace — the plan updates through them.";
      AlphaMath.announce("Message sent to your tutor.");
    }catch(error){
      status.textContent = error.message;
      button.disabled = false;
      if(error.signedOut) location.reload();
    }
  }

  /* requireRole directly rather than requireLearner: the sign-in card should
     say what this page is, not borrow the marked-work copy. */
  AlphaMath.auth.requireRole(gate, ["learner"], async account => {
    try{
      await load(account);
    }catch(error){
      shell.querySelector("[data-send-status]").textContent = error.message;
      shell.hidden = false;
      return;
    }
    renderBoard(); renderPractice(); refreshSend();
    shell.hidden = false;

    shell.addEventListener("click", event => {
      const on = event.target.closest("[data-toggle]");
      const off = event.target.closest("[data-untoggle]");
      if(on){ state.pendingStarted.add(on.getAttribute("data-toggle")); }
      else if(off){ state.pendingStarted.delete(off.getAttribute("data-untoggle")); }
      else return;
      renderBoard(); renderPractice(); refreshSend();
    });
    shell.addEventListener("change", event => {
      if(event.target.matches('input[name="practice"]')) refreshSend();
    });
    shell.querySelector("[data-note]").addEventListener("input", refreshSend);
    shell.querySelector("[data-send]").addEventListener("click", () => {
      const d = delta();
      const lines = ["Send to your tutor?", ""];
      if(d.started.length) lines.push(`Started: ${d.started.join(", ")}`);
      if(d.practice.length) lines.push(`More practice on: ${d.practice.join(", ")}`);
      if(d.note) lines.push("Plus your note.");
      if(confirm(lines.join("\n"))) send(account);
    });
  }, {
    heading: "Sign in to tell your tutor",
    blurb: "Messages here are sent as you, to the tutor who plans your work. Signing in is what makes that true.",
    identifierLabel: "Email or learner ID",
    wrongRole: "This account is not a learner account."
  });
})();
