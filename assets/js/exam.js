(function(){
  "use strict";

  const source = window.ALPHAMATH_REVIEW_EXAM || [];
  const questions = source.flatMap(section => section.items || []);
  const studentId = document.body.dataset.studentId || "REVIEW-DEMO";
  const templateMode = document.body.dataset.template === "true";
  const storageKey = templateMode
    ? "alphamath:csec:exam-template:v2"
    : `alphamath:${studentId.toLowerCase()}:simulated-exam-1:v2`;
  const durationSeconds = Number(document.body.dataset.durationSeconds || 2700);
  const warningSeconds = Math.min(2400,durationSeconds-300);

  const initialState = {
    started:false,
    startedAt:null,
    elapsedBefore:0,
    active:0,
    responses:{},
    submitted:false,
    submittedAt:null,
    timedOut:false
  };
  const state = Object.assign(initialState,AlphaMath.storage.get(storageKey,{}));
  state.responses ||= {};

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
            <strong>${AlphaMath.escapeHTML(question.tag || "Exam question")}</strong>
            <div class="q-meta">${question.cite ? AlphaMath.escapeHTML(question.cite) : "Tutor-authored bridge — not mastery evidence"}</div>
          </div>
          <span class="status ${item.answer ? "approaching" : "not-yet"}">${item.answer ? "Answer entered" : "No answer entered"}</span>
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
    state.active = index;
    save();
    renderQuestion();
    questionMount.querySelector(".question-card")?.focus?.({preventScroll:true});
  }

  function startExam(){
    if(!questions.length) return;
    if(!state.started){
      state.started = true;
      state.startedAt = Date.now();
      state.elapsedBefore = 0;
      save();
    }else if(!state.submitted && !state.startedAt){
      state.startedAt = Date.now();
      save();
    }
    cover.hidden = true;
    workspace.hidden = false;
    renderQuestion();
    updateTimer();
    clearInterval(timerHandle);
    if(!state.submitted) timerHandle = setInterval(updateTimer,1000);
    AlphaMath.announce(state.submitted ? "Saved exam submission opened." : "Exam opened. Timer running.");
  }

  function pauseClock(){
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
      save();
    }
  });

  if(state.started){
    cover.querySelector("h2").textContent = state.submitted ? "Review your saved submission" : "Resume your saved exam";
    document.getElementById("startExam").textContent = state.submitted ? "Open submission" : "Resume exam";
  }
  if(state.submitted) submitButton.disabled = true;
})();
