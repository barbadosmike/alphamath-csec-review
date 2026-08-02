(function(){
  "use strict";

  const source = window.MSTU001_EXAM || [];
  const questions = source.flatMap(section => section.items || []);
  /* The active learner decides the storage namespace below, so it decides whose
     draft this page reads and writes. AlphaMath.learner.current() resolves
     ?learner= → stored selection → this page's data-student-id; the literal
     fallback that used to sit here made every page a single-learner demo.
     "unassigned" is deliberately not a real id: a page that cannot say who it is
     for must not write into someone else's namespace. */
  const studentId = (window.AlphaMath && AlphaMath.learner.current()) || "unassigned";
  const templateMode = document.body.dataset.template === "true";
  const storageKey = templateMode
    ? "alphamath:csec:exam-template:v2"
    : `alphamath:${studentId.toLowerCase()}:simulated-exam-1:v2`;
  const durationSeconds = Number(document.body.dataset.durationSeconds || 2700);
  const warningSeconds = Math.min(2400,durationSeconds-300);

  const initialState = {
    started:false,
    // Milliseconds, and reset every time the clock resumes — it is the start of
    // the CURRENT run, not of the attempt. `firstStartedAt` below is the one the
    // evidence record wants.
    startedAt:null,
    // ISO, written once and never overwritten, so the attempt keeps a true
    // start time across reloads, tab switches and resumes.
    firstStartedAt:null,
    elapsedBefore:0,
    active:0,
    // Seconds banked per question, keyed by position, plus the wall-clock moment
    // the current question was opened. Two fields because the second is live and
    // must not be trusted after a reload.
    questionElapsed:{},
    activeQuestionStartedAt:null,
    responses:{},
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

  /*
   * Per-question pace.
   *
   * The whole-exam clock only tells a learner how long is left overall; it cannot
   * tell them they have spent eleven minutes on question 3. That is the judgement
   * this meter supports, and it is why the countdown alone was not enough.
   *
   * The recommended time is derived from this exam's own duration and question
   * count — 2700s over 20 questions is 135s each — rather than the flat 300s the
   * Additional Mathematics build assumes. A fixed 300 would mark every question on
   * a 45-minute paper as comfortably under pace, which is worse than showing
   * nothing. A per-question `recommendedSeconds` in the content data still wins.
   */
  const defaultRecommendedSeconds = questions.length
    ? Math.max(30,Math.floor(durationSeconds/questions.length))
    : 300;

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
    if(state.started && !state.submitted && !state.activeQuestionStartedAt){
      state.activeQuestionStartedAt = Date.now();
    }
  }

  function updateQuestionPace(){
    const question = questions[state.active];
    const meter = document.getElementById("questionPace");
    if(!question || !meter) return;
    const optimal = Math.max(30,Number(question.recommendedSeconds || defaultRecommendedSeconds));
    const used = questionElapsed();
    const ratio = used/optimal;
    meter.style.setProperty("--pace-progress",`${Math.min(100,ratio*100)}%`);
    meter.style.setProperty("--pace-turn",`${Math.min(1,ratio)}turn`);
    meter.classList.toggle("pace-warning",ratio >= .8 && ratio <= 1);
    meter.classList.toggle("pace-over",ratio > 1);
    meter.querySelector("strong").textContent = AlphaMath.formatTime(used);
    meter.setAttribute("aria-label",
      `${AlphaMath.formatTime(used)} used of ${AlphaMath.formatTime(optimal)} recommended${ratio > 1 ? "; recommended time exceeded" : ""}`);
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
    updateQuestionPace();
    timerValue.textContent = AlphaMath.formatTime(remaining);
    timer.classList.toggle("warning",used >= warningSeconds && used < durationSeconds);
    timer.classList.toggle("timeout",used >= durationSeconds);
    if(used >= durationSeconds && !state.submitted){
      state.elapsedBefore = durationSeconds;
      state.startedAt = null;
      state.timedOut = true;
      finishExam("Time reached. Your saved responses are now locked for tutor review.");
    }
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
            </div>
            <div class="q-meta">${question.cite ? AlphaMath.escapeHTML(question.cite) : "Tutor-authored bridge — not mastery evidence"}</div>
          </div>
          <div class="question-head-actions">
            <span class="status ${item.answer ? "approaching" : "not-yet"}">${item.answer ? "Answer entered" : "No answer entered"}</span>
            <div class="pace-wrap">
              <div class="pace-meter" id="questionPace" role="timer"><span class="pace-hand" aria-hidden="true"></span><strong>00:00</strong></div>
              <span class="pace-label">Recommended ${AlphaMath.formatTime(Number(question.recommendedSeconds || defaultRecommendedSeconds))}</span>
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
          </div>
          <!-- Own row BELOW the answer, matching the Additional Mathematics build.
               Inline beside the answer field it competed with the input for the
               eye and sat where that build puts nothing. -->
          <div class="sketchpad-row">
            <button type="button" class="secondary" data-exam-draw aria-expanded="${item.drawing?"true":"false"}" ${state.submitted?"disabled":""}>Sketchpad</button>
            <span class="fine">Use the sketchpad for diagrams and longer working; your final answer belongs in the box above.</span>
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
    // Bank the time spent on the question being left before switching, or it is
    // silently credited to the next one.
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
      state.firstStartedAt = new Date().toISOString();
      state.elapsedBefore = 0;
      save();
    }else if(!state.submitted && !state.startedAt){
      state.startedAt = Date.now();
      save();
    }
    cover.hidden = true;
    workspace.hidden = false;
    resumeQuestionClock();
    renderQuestion();
    updateTimer();
    clearInterval(timerHandle);
    if(!state.submitted) timerHandle = setInterval(updateTimer,1000);
    AlphaMath.announce(state.submitted ? "Saved exam submission opened." : "Exam opened. Timer running.");
  }

  function pauseClock(){
    // The per-question clock stops whenever the exam clock does, so time spent
    // with the tab hidden is not billed to whichever question was open.
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
    // The attempt is locked from here, which is the API's precondition.
    const sendButton = document.getElementById("sendExam");
    if(sendButton) sendButton.disabled = false;
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
      "AlphaMath CSEC Mathematics Simulated Exam Record",
      `Student ID: ${studentId}`,
      "Instrument: Simulated Exam 1 — Fractions, Decimals and Percentages",
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
    AlphaMath.downloadText(`${studentId}-simulated-exam-1-record.txt`,lines.join("\n"));
  }

  /*
   * ── Evidence submission ───────────────────────────────────────────────────
   *
   * The shape translation itself lives in assets/js/evidence-adapter.js, kept
   * pure and separately tested against the real server contract. This function
   * only gathers the live values to feed it.
   */
  const instrumentId = document.body.dataset.instrumentId || "simulated-exam-1";

  function buildAttempt(){
    return AlphaMathAdapter.toEvidenceAttempt({
      clientAttemptId: AlphaMath.ids.stable(
        `${storageKey}:database-attempt-id`,
        "exam-attempt"
      ),
      instrumentId,
      sourceVersion: AlphaMath.version,
      startedAt: state.firstStartedAt,
      submittedAt: state.submittedAt,
      elapsedSeconds: elapsed(),
      timedOut: state.timedOut,
      locked: state.submitted,
      learner: {
        externalId: studentId,
        displayName: document.body.dataset.studentName || "",
        school: document.body.dataset.school || "",
        email: document.body.dataset.studentEmail || ""
      },
      questions,
      responses: state.responses
    });
  }

  async function sendToDatabase(){
    const button = document.getElementById("sendExam");
    const notice = document.getElementById("examNotice");
    if(!state.submitted){
      AlphaMath.announce("Submit the exam before sending it for marking.");
      return;
    }
    if(button){
      button.disabled = true;
      button.textContent = "Sending…";
    }
    try{
      const result = await AlphaMath.api.submit("/v1/exam-attempts", buildAttempt());
      if(notice){
        notice.hidden = false;
        notice.innerHTML = `<strong>Sent for marking.</strong>
          <br>Your tutor can now open this attempt. Your work stays on this device as well.`;
      }
      if(button) button.textContent = "Sent for marking";
      AlphaMath.announce("Exam sent for marking.");
      return result;
    }catch(error){
      // A cancelled connection dialog is a choice, not a fault: the local draft
      // is untouched either way, so the learner can simply try again.
      if(button){
        button.disabled = false;
        button.textContent = "Send for marking";
      }
      if(notice && !error.cancelled){
        notice.hidden = false;
        notice.innerHTML = `<strong>Not sent.</strong>
          <br>${AlphaMath.escapeHTML(error.message)} Your work is still saved on this device.`;
      }
      AlphaMath.announce(error.cancelled ? "Sending cancelled." : `Not sent. ${error.message}`);
    }
  }

  // Exposed so the tutor review panel and any future returned-work page read the
  // attempt through one accessor, exactly as the Additional Mathematics client does.
  window.AlphaMathExam = {questions, getAttempt: buildAttempt};

  document.getElementById("startExam").addEventListener("click",startExam);
  document.getElementById("sendExam")?.addEventListener("click",sendToDatabase);
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
  if(state.submitted){
    submitButton.disabled = true;
    // A previously submitted attempt is still sendable — the learner may have
    // closed the tab before the send, or the send may have failed.
    const sendButton = document.getElementById("sendExam");
    if(sendButton) sendButton.disabled = false;
  }
})();
