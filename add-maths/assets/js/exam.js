(function(){
  "use strict";

  const source = window.ALPHAMATH_REVIEW_EXAM || [];
  const questions = source.flatMap(section => section.items || []);
  const studentId = document.body.dataset.studentId || "REVIEW-DEMO";
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
  }

  function response(index){
    return state.responses[index] ||= {answer:"",flagged:false,drawing:""};
  }

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
    return questions.filter((_question,index) => String(response(index).answer || "").trim()).length;
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
      return `<button type="button" data-go="${index}" class="${index===state.active?"is-current":""} ${item.answer?"is-answered":""} ${item.flagged?"is-flagged":""}"
        aria-label="Question ${question.label || index+1}${item.answer?", answer entered":""}${item.flagged?", flagged for review":""}"
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
            <span class="status ${item.answer ? "approaching" : "not-yet"}">${item.answer ? "Answer entered" : "No answer entered"}</span>
            <div class="pace-wrap">
              <div class="pace-meter" id="questionPace" role="timer"><span class="pace-hand" aria-hidden="true"></span><strong>00:00</strong></div>
              <span class="pace-label">Recommended ${AlphaMath.formatTime(Number(question.recommendedSeconds || 300))}</span>
            </div>
          </div>
        </div>
        <div class="question-body">
          <p class="question-prompt">${AlphaMath.fractionMarkup(question.prompt || "")}</p>
          <div class="answer-row">
            <div>
              <label for="exam-answer-${state.active}">My answer</label>
              <math-field id="exam-answer-${state.active}" data-exam-answer="${state.active}" aria-label="Answer for question ${question.label || state.active+1}"
                ${state.submitted ? "read-only" : ""}>${AlphaMath.escapeHTML(item.answer)}</math-field>
            </div>
            <button type="button" class="secondary" data-exam-draw aria-expanded="${item.drawing?"true":"false"}" ${state.submitted?"disabled":""}>Draw working</button>
          </div>
          <div class="draw-panel" data-exam-draw-panel ${item.drawing?"":"hidden"}></div>
          <p class="fine">Your tutor reviews method and correctness. The page does not auto-grade.</p>
        </div>
      </article>`;
    const panel = questionMount.querySelector("[data-exam-draw-panel]");
    AlphaMath.createDrawingPad(panel,{
      state:item,
      locked:state.submitted,
      label:`Drawing area for exam question ${question.label || state.active+1}`,
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
    const flagged = flaggedCount();
    progress.textContent = `${entered} of ${questions.length} answers entered · ${flagged} flagged`;
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
      <br>${enteredCount()} of ${questions.length} answers entered; ${flaggedCount()} flagged.`;
    AlphaMath.announce(message);
  }

  function openSubmitDialog(){
    const entered = enteredCount();
    const unanswered = questions.length-entered;
    const flagged = flaggedCount();
    document.getElementById("dialogSummary").textContent =
      `${entered} answers entered, ${unanswered} unanswered, and ${flagged} flagged for review.`;
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
      `Answers entered: ${enteredCount()} of ${questions.length}`,
      `Flagged for review: ${flaggedCount()}`,
      "Mastery status: NOT DETERMINED — tutor review required",
      "",
      "--- RESPONSES ---"
    ];
    questions.forEach((question,index) => {
      const item = response(index);
      lines.push(`Question ${question.label || index+1} [${question.tag || "Exam"}]`);
      lines.push(`Answer entered: ${item.answer || "(none)"}`);
      lines.push(`Flagged: ${item.flagged ? "yes" : "no"}`);
      lines.push(`Drawing saved: ${item.drawing ? "yes" : "no"}`);
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
            answer: item.answer || "",
            flagged: Boolean(item.flagged),
            drawing: item.drawing || ""
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
    response(Number(field.dataset.examAnswer)).answer = field.value || "";
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
