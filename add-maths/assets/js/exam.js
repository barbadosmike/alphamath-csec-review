(function(){
  "use strict";

  const source = window.ALPHAMATH_REVIEW_EXAM || [];
  const questions = source.flatMap(section => section.items || []);
  /* The active learner decides the storage namespace below, so it decides whose
     draft this page reads and writes. AlphaMath.learner.current() resolves
     ?learner= → stored selection → this page's data-student-id; the literal
     fallback that used to sit here made every page a single-learner demo.
     "unassigned" is deliberately not a real id: a page that cannot say who it is
     for must not write into someone else's namespace. */
  const studentId = (window.AlphaMath && AlphaMath.learner.current()) || "unassigned";
  const instrumentId = document.body.dataset.instrumentId || "simulated-exam-1";
  const examName = document.body.dataset.examName || "Simulated Exam 1 — Quadratics Foundation";
  const templateMode = document.body.dataset.template === "true";
  const storageKey = templateMode
    ? "alphamath:addmaths:exam-template:v2"
    : instrumentId === "simulated-exam-1"
      ? `alphamath:${studentId.toLowerCase()}:simulated-exam-1:v2`
      : `alphamath:${studentId.toLowerCase()}:${instrumentId}:v1`;
  const durationSeconds = Number(document.body.dataset.durationSeconds || 2700);
  const warningSeconds = Math.min(2400,durationSeconds-300);

  const initialState = {
    started:false,
    startedAt:null,
    firstStartedAt:null,
    elapsedBefore:0,
    active:0,
    responses:{},
    questionElapsed:{},
    activeQuestionStartedAt:null,
    submitted:false,
    submittedAt:null,
    timedOut:false
  };
  const state = Object.assign(initialState,AlphaMath.storage.get(storageKey,{}));
  state.responses ||= {};
  state.questionElapsed ||= {};

  const cover = document.getElementById("examCover");
  const workspace = document.getElementById("examWorkspace");
  const questionMount = document.getElementById("examQuestion");
  const nav = document.getElementById("questionNav");
  const timer = document.getElementById("timerBox");
  const timerValue = document.getElementById("timerValue");
  const progress = document.getElementById("examProgress");
  const flagButton = document.getElementById("flagQuestion");
  const previousButton = document.getElementById("examPrevious");
  const nextButton = document.getElementById("examNext");
  const submitButton = document.getElementById("submitExam");
  const dialog = document.getElementById("submitDialog");
  let timerHandle = null;

  function save(){
    AlphaMath.storage.set(storageKey,state);
    document.dispatchEvent(new CustomEvent("alphamath:attempt-changed",{
      detail:{kind:"exam",instrumentId}
    }));
  }

  function questionParts(question){
    if(Array.isArray(question?.parts) && question.parts.length) return question.parts;
    return [{id:"answer",label:"Answer",prompt:""}];
  }

  function response(index){
    const item = state.responses[index] ||= {
      answer:"",
      parts:{},
      flagged:false,
      drawing:"",
      sketchpadSize:"standard"
    };
    item.parts ||= {};
    item.sketchpadSize ||= "standard";
    const parts = questionParts(questions[index]);
    const hasPartAnswer = parts.some(part => String(item.parts[part.id] || "").trim());
    if(String(item.answer || "").trim() && !hasPartAnswer && !item.legacyAnswer){
      if(parts.length === 1) item.parts[parts[0].id] = item.answer;
      else item.legacyAnswer = item.answer;
    }
    return item;
  }

  function responseStatus(index){
    const item = response(index);
    const parts = questionParts(questions[index]);
    const completedParts = parts.filter(part => String(item.parts[part.id] || "").trim()).length;
    if(completedParts === parts.length) return "complete";
    if(completedParts > 0 || String(item.legacyAnswer || "").trim()) return "partial";
    return "empty";
  }

  function flattenedAnswer(index){
    const item = response(index);
    const partLines = questionParts(questions[index])
      .map(part => {
        const value = String(item.parts[part.id] || "").trim();
        return value ? `${part.label || part.id} ${value}` : "";
      })
      .filter(Boolean);
    if(String(item.legacyAnswer || "").trim()){
      partLines.push(`Earlier saved answer: ${item.legacyAnswer}`);
    }
    return partLines.join("\n") || String(item.answer || "");
  }

  function syncFlattenedAnswer(index){
    response(index).answer = flattenedAnswer(index);
  }

  // Keep the existing storage key and migrate in place so earlier attempts are
  // preserved. Multipart legacy answers remain explicitly unassigned.
  questions.forEach((_question,index) => response(index));
  AlphaMath.storage.set(storageKey,state);

  function elapsed(){
    if(!state.started || state.submitted) return state.elapsedBefore || 0;
    const active = state.startedAt ? Math.floor((Date.now()-state.startedAt)/1000) : 0;
    return (state.elapsedBefore || 0)+active;
  }

  function questionElapsed(index = state.active){
    const saved = Number(state.questionElapsed[index] || 0);
    if(index !== state.active || !state.activeQuestionStartedAt || state.submitted) return saved;
    return saved+Math.max(0,Math.floor((Date.now()-state.activeQuestionStartedAt)/1000));
  }

  function pauseQuestionClock(){
    if(!state.activeQuestionStartedAt) return;
    state.questionElapsed[state.active] = questionElapsed(state.active);
    state.activeQuestionStartedAt = null;
  }

  function resumeQuestionClock(){
    if(state.started && !state.submitted && !state.activeQuestionStartedAt) state.activeQuestionStartedAt = Date.now();
  }

  function enteredCount(){
    return questions.filter((_question,index) => responseStatus(index) === "complete").length;
  }

  function partialCount(){
    return questions.filter((_question,index) => responseStatus(index) === "partial").length;
  }

  function flaggedCount(){
    return questions.filter((_question,index) => response(index).flagged).length;
  }

  function updateTimer(){
    const used = elapsed();
    const remaining = Math.max(0,durationSeconds-used);
    timerValue.textContent = AlphaMath.formatTime(remaining);
    timer.classList.toggle("warning",used >= warningSeconds && used < durationSeconds);
    timer.classList.toggle("timeout",used >= durationSeconds);
    updateQuestionPace();
    if(used >= durationSeconds && !state.submitted){
      state.elapsedBefore = durationSeconds;
      state.startedAt = null;
      state.timedOut = true;
      finishExam("Time reached. Your saved responses are now locked for tutor review.");
    }
  }

  function updateQuestionPace(){
    const question = questions[state.active];
    const meter = document.getElementById("questionPace");
    if(!question || !meter) return;
    const optimal = Math.max(60,Number(question.recommendedSeconds || 300));
    const used = questionElapsed();
    const ratio = used/optimal;
    meter.style.setProperty("--pace-progress",`${Math.min(100,ratio*100)}%`);
    meter.style.setProperty("--pace-turn",`${Math.min(1,ratio)}turn`);
    meter.classList.toggle("pace-warning",ratio >= .8 && ratio <= 1);
    meter.classList.toggle("pace-over",ratio > 1);
    meter.querySelector("strong").textContent = AlphaMath.formatTime(used);
    meter.setAttribute("aria-label",`${AlphaMath.formatTime(used)} used of ${AlphaMath.formatTime(optimal)} recommended${ratio > 1 ? "; recommended time exceeded" : ""}`);
  }

  function renderNav(){
    nav.innerHTML = questions.map((question,index) => {
      const item = response(index);
      const status = responseStatus(index);
      const answerLabel = status === "complete" ? ", all parts answered"
        : status === "partial" ? ", partly answered" : "";
      return `<button type="button" data-go="${index}" class="${index===state.active?"is-current":""} ${status==="complete"?"is-answered":""} ${status==="partial"?"is-partial":""} ${item.flagged?"is-flagged":""}"
        aria-label="Question ${question.label || index+1}${answerLabel}${item.flagged?", flagged for review":""}"
        aria-current="${index===state.active?"step":"false"}">${question.label || index+1}</button>`;
    }).join("");
  }

  function renderQuestion(){
    const question = questions[state.active];
    if(!question){
      questionMount.innerHTML = '<div class="callout warning"><p>No question data is available.</p></div>';
      return;
    }
    const item = response(state.active);
    const parts = questionParts(question);
    const status = responseStatus(state.active);
    const partFields = parts.map(part => `
      <div class="answer-part">
        ${part.prompt ? `<p class="part-prompt"><strong>${AlphaMath.escapeHTML(part.label || part.id)}</strong> ${AlphaMath.fractionMarkup(part.prompt)}</p>` : ""}
        <label for="exam-answer-${state.active}-${AlphaMath.escapeHTML(part.id)}">${parts.length === 1 ? "My answer" : `Answer ${AlphaMath.escapeHTML(part.label || part.id)}`}</label>
        <math-field id="exam-answer-${state.active}-${AlphaMath.escapeHTML(part.id)}"
          data-exam-answer="${state.active}" data-answer-part="${AlphaMath.escapeHTML(part.id)}"
          aria-label="${parts.length === 1 ? `Answer for question ${question.label || state.active+1}` : `Answer ${part.label || part.id} for question ${question.label || state.active+1}`}"
          ${state.submitted ? "read-only" : ""}>${AlphaMath.escapeHTML(item.parts[part.id] || "")}</math-field>
      </div>`).join("");
    const legacyAnswer = item.legacyAnswer ? `
      <div class="callout warning legacy-answer" role="note">
        <strong>Earlier saved answer retained</strong>
        <p>This answer predates the part-by-part layout. It remains in exports and tutor evidence until you copy it into the appropriate parts.</p>
        <math-field read-only aria-label="Earlier saved answer">${AlphaMath.escapeHTML(item.legacyAnswer)}</math-field>
      </div>` : "";
    questionMount.innerHTML = `
      <article class="question-card exam-question">
        <div class="question-head">
          <span class="q-number">${AlphaMath.escapeHTML(question.label || state.active+1)}</span>
          <div>
            <div class="question-identity">
              <strong>${AlphaMath.escapeHTML(question.tag || "Exam question")}</strong>
              <button type="button" class="exam-chip" data-meta-chip title="${AlphaMath.escapeHTML(question.paper || "Exam")} style question">${AlphaMath.escapeHTML(question.paper || "Exam")}</button>
              <button type="button" class="exam-chip year" data-meta-chip title="${AlphaMath.escapeHTML(question.provenance || "Tutor-authored")} in ${AlphaMath.escapeHTML(question.year || "2026")}; not a past-paper citation">${AlphaMath.escapeHTML(question.year || "2026")} · tutor-authored</button>
            </div>
            <div class="q-meta">${question.cite ? AlphaMath.escapeHTML(question.cite) : "Tutor-authored bridge — not mastery evidence"}</div>
          </div>
          <div class="question-head-actions">
            <span class="status ${status === "complete" ? "approaching" : "not-yet"}">${
              status === "complete" ? "All parts answered"
                : status === "partial" ? "Answer in progress" : "No answer entered"
            }</span>
            <div class="pace-wrap">
              <div class="pace-meter" id="questionPace" role="timer"><span class="pace-hand" aria-hidden="true"></span><strong>00:00</strong></div>
              <span class="pace-label">Recommended ${AlphaMath.formatTime(Number(question.recommendedSeconds || 300))}</span>
            </div>
          </div>
        </div>
        <div class="question-body">
          <p class="question-prompt">${AlphaMath.fractionMarkup(question.prompt || "")}</p>
          <div class="answer-parts" aria-label="Answer parts for question ${question.label || state.active+1}">
            ${partFields}
          </div>
          ${legacyAnswer}
          <div class="sketchpad-row">
            <button type="button" class="secondary" data-exam-draw aria-expanded="${item.drawing?"true":"false"}" ${state.submitted?"disabled":""}>Sketchpad</button>
            <span class="fine">Use the sketchpad for diagrams and longer working; each result belongs in its matching answer part.</span>
          </div>
          <div class="draw-panel" data-exam-draw-panel ${item.drawing?"":"hidden"} aria-label="Sketchpad for question ${question.label || state.active+1}"></div>
          <p class="fine">Your tutor reviews method and correctness. The page does not auto-grade.</p>
        </div>
      </article>`;
    const panel = questionMount.querySelector("[data-exam-draw-panel]");
    AlphaMath.createDrawingPad(panel,{
      state:item,
      locked:state.submitted,
      label:`Sketchpad for exam question ${question.label || state.active+1}`,
      onSave(){ save(); }
    });
    AlphaMath.initMathFields(questionMount);
    updateQuestionPace();
    previousButton.disabled = state.active === 0 || state.submitted;
    nextButton.disabled = state.active === questions.length-1 || state.submitted;
    flagButton.disabled = state.submitted;
    flagButton.setAttribute("aria-pressed",String(item.flagged));
    flagButton.textContent = item.flagged ? "Remove review flag" : "Flag for review";
    updateProgress();
    renderNav();
  }

  function updateProgress(){
    const entered = enteredCount();
    const partial = partialCount();
    const flagged = flaggedCount();
    progress.textContent = `${entered} of ${questions.length} complete · ${partial} in progress · ${flagged} flagged`;
  }

  function go(index){
    if(index < 0 || index >= questions.length) return;
    pauseQuestionClock();
    state.active = index;
    resumeQuestionClock();
    save();
    renderQuestion();
    questionMount.querySelector(".question-card")?.focus?.({preventScroll:true});
  }

  function startExam(){
    if(!questions.length) return;
    if(!state.started){
      state.started = true;
      state.startedAt = Date.now();
      state.firstStartedAt = state.firstStartedAt || new Date().toISOString();
      state.elapsedBefore = 0;
      save();
    }else if(!state.submitted && !state.startedAt){
      state.startedAt = Date.now();
      save();
    }
    resumeQuestionClock();
    cover.hidden = true;
    workspace.hidden = false;
    renderQuestion();
    updateTimer();
    clearInterval(timerHandle);
    if(!state.submitted) timerHandle = setInterval(updateTimer,1000);
    AlphaMath.announce(state.submitted ? "Saved exam submission opened." : "Exam opened. Timer running.");
  }

  function pauseClock(){
    pauseQuestionClock();
    if(!state.startedAt) return;
    state.elapsedBefore = elapsed();
    state.startedAt = null;
  }

  function finishExam(message){
    pauseClock();
    state.submitted = true;
    state.submittedAt = new Date().toISOString();
    save();
    clearInterval(timerHandle);
    renderQuestion();
    submitButton.disabled = true;
    submitButton.textContent = "Submitted";
    const notice = document.getElementById("examNotice");
    notice.hidden = false;
    notice.innerHTML = `<strong>${AlphaMath.escapeHTML(message)}</strong>
      <br>${enteredCount()} of ${questions.length} complete; ${partialCount()} in progress; ${flaggedCount()} flagged.`;
    AlphaMath.announce(message);
  }

  function openSubmitDialog(){
    const entered = enteredCount();
    const partial = partialCount();
    const unanswered = questions.length-entered-partial;
    const flagged = flaggedCount();
    document.getElementById("dialogSummary").textContent =
      `${entered} questions complete, ${partial} in progress, ${unanswered} not started, and ${flagged} flagged for review.`;
    if(typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open","");
  }

  function exportRecord(){
    const lines = [
      "AlphaMath CSEC Additional Mathematics Simulated Exam Record",
      `Student ID: ${studentId}`,
      `Instrument: ${examName}`,
      `Status: ${state.submitted ? "submitted" : "in progress"}`,
      `Time used: ${AlphaMath.formatTime(elapsed())}`,
      `Questions complete: ${enteredCount()} of ${questions.length}`,
      `Questions in progress: ${partialCount()}`,
      `Flagged for review: ${flaggedCount()}`,
      "Mastery status: NOT DETERMINED — tutor review required",
      "",
      "--- RESPONSES ---"
    ];
    questions.forEach((question,index) => {
      const item = response(index);
      lines.push(`Question ${question.label || index+1} [${question.tag || "Exam"}]`);
      questionParts(question).forEach(part => {
        lines.push(`${part.label || part.id}: ${item.parts[part.id] || "(none)"}`);
      });
      if(item.legacyAnswer) lines.push(`Earlier saved answer: ${item.legacyAnswer}`);
      lines.push(`Combined answer: ${flattenedAnswer(index) || "(none)"}`);
      lines.push(`Flagged: ${item.flagged ? "yes" : "no"}`);
      lines.push(`Sketchpad saved: ${item.drawing ? "yes" : "no"}`);
      lines.push(`Sketchpad size: ${item.sketchpadSize || "standard"}`);
      if(question.cite) lines.push(`Source: ${question.cite}`);
      lines.push("");
    });
    lines.push("This record requires human marking. It does not auto-grade or establish mastery.");
    AlphaMath.downloadText(`${studentId}-${instrumentId}-record.txt`,lines.join("\n"));
  }

  document.getElementById("startExam").addEventListener("click",startExam);
  previousButton.addEventListener("click",() => go(state.active-1));
  nextButton.addEventListener("click",() => go(state.active+1));
  flagButton.addEventListener("click",() => {
    const item = response(state.active);
    item.flagged = !item.flagged;
    save();
    renderQuestion();
    AlphaMath.announce(item.flagged ? "Question flagged for review." : "Review flag removed.");
  });
  submitButton.addEventListener("click",openSubmitDialog);
  document.getElementById("cancelSubmit").addEventListener("click",() => dialog.close());
  document.getElementById("confirmSubmit").addEventListener("click",() => {
    dialog.close();
    finishExam("Answers submitted. Your work is locked for tutor review.");
  });
  document.getElementById("exportExam")?.addEventListener("click",exportRecord);

  window.AlphaMathExam = {
    questions,
    getAttempt(){
      return {
        clientAttemptId: AlphaMath.ids.stable(
          `${storageKey}:database-attempt-id`,
          "exam-attempt"
        ),
        instrumentId,
        sourceVersion: AlphaMath.version,
        startedAt: state.firstStartedAt,
        submittedAt: state.submittedAt,
        elapsedSeconds: elapsed(),
        timedOut: Boolean(state.timedOut),
        locked: Boolean(state.submitted),
        learner: {
          externalId: studentId,
          displayName: document.body.dataset.studentName || "",
          school: document.body.dataset.school || "",
          email: document.body.dataset.studentEmail || ""
        },
        responses: questions.map((question,index) => {
          const item = response(index);
          return {
            itemId: String(question.label || index+1),
            answerSchemaVersion: 2,
            answer: flattenedAnswer(index),
            parts: Object.fromEntries(questionParts(question).map(part => [
              String(part.id),
              String(item.parts[part.id] || "")
            ])),
            legacyAnswer: item.legacyAnswer || "",
            flagged: Boolean(item.flagged),
            drawing: item.drawing || "",
            sketchpadSize: item.sketchpadSize || "standard"
          };
        })
      };
    }
  };
  document.dispatchEvent(new CustomEvent("alphamath:exam-ready"));

  nav.addEventListener("click",event => {
    const button = event.target.closest("[data-go]");
    if(button) go(Number(button.dataset.go));
  });

  questionMount.addEventListener("input",event => {
    const field = event.target.closest("[data-exam-answer]");
    if(!field || state.submitted) return;
    const index = Number(field.dataset.examAnswer);
    const item = response(index);
    item.parts[field.dataset.answerPart || "answer"] = field.value || "";
    syncFlattenedAnswer(index);
    save();
    updateProgress();
    renderNav();
  });

  questionMount.addEventListener("click",event => {
    const meta = event.target.closest("[data-meta-chip]");
    if(meta){
      AlphaMath.announce(meta.title);
      return;
    }
    const button = event.target.closest("[data-exam-draw]");
    if(!button || state.submitted) return;
    const panel = questionMount.querySelector("[data-exam-draw-panel]");
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute("aria-expanded",String(opening));
    if(opening) panel.querySelector("canvas")?.focus();
  });

  document.addEventListener("visibilitychange",() => {
    if(document.hidden && state.started && !state.submitted){
      pauseClock();
      save();
    }else if(!document.hidden && state.started && !state.submitted && !state.timedOut){
      state.startedAt = Date.now();
      resumeQuestionClock();
      save();
    }
  });

  if(state.started){
    cover.querySelector("h2").textContent = state.submitted ? "Review your saved submission" : "Resume your saved exam";
    document.getElementById("startExam").textContent = state.submitted ? "Open submission" : "Resume exam";
  }
  if(state.submitted) submitButton.disabled = true;
})();
