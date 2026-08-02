(function(){
  "use strict";

  const contentGlobal = document.body.dataset.contentGlobal || "ALPHAMATH_REVIEW_TUTORIAL";
  const source = window[contentGlobal] || [];
  const allQuestions = source.flatMap(section => section.items || []);
  /* The active learner decides the storage namespace below, so it decides whose
     draft this page reads and writes. AlphaMath.learner.current() resolves
     ?learner= → stored selection → this page's data-student-id; the literal
     fallback that used to sit here made every page a single-learner demo.
     "unassigned" is deliberately not a real id: a page that cannot say who it is
     for must not write into someone else's namespace. */
  const studentId = (window.AlphaMath && AlphaMath.learner.current()) || "unassigned";
  const templateMode = document.body.dataset.template === "true";
  const storageKey = templateMode
    ? "alphamath:addmaths:study-template:v2"
    : `alphamath:${studentId.toLowerCase()}:quadratics-foundation:v2`;

  const sessions = [
    {
      title:"Read the vertex",
      short:"Vertex",
      type:"Readiness bridge",
      indices:[0,1,2],
      objective:"Connect completed-square form to the turning point, minimum or maximum, and range.",
      intro:`
        <div class="callout info">
          <h3>Start from what is already secure</h3>
          <p>The first three questions isolate the final reading step after completing the square. No timer; explain what each number means.</p>
        </div>
        <div class="visual-loop" aria-label="Completed square to graph features">
          <div class="loop-node"><div><b>a(x − h)² + k</b><span>completed-square form</span></div></div>
          <div class="loop-arrow" aria-hidden="true">→</div>
          <div class="loop-node"><div><b>(h, k)</b><span>turning point</span></div></div>
          <div class="loop-arrow" aria-hidden="true">→</div>
          <div class="loop-node"><div><b>range</b><span>decide from the sign of a</span></div></div>
        </div>`
    },
    {
      title:"Complete the square accurately",
      short:"Complete",
      type:"Guided practice",
      indices:[3,4,5,6],
      objective:"Factor the leading coefficient when necessary, then read graph features without re-solving.",
      intro:`
        <div class="grid two">
          <div class="lesson-card"><p class="eyebrow">If a is positive</p><h3>Opens upward</h3><p>The turning point gives a <strong>minimum</strong>; the range is y ≥ k.</p></div>
          <div class="lesson-card"><p class="eyebrow">If a is negative</p><h3>Opens downward</h3><p>The turning point gives a <strong>maximum</strong>; the range is y ≤ k.</p></div>
        </div>`
    },
    {
      title:"Connect the discriminant",
      short:"Discriminant",
      type:"Guided connection",
      indices:[7,8,9,10],
      objective:"Use the discriminant and completed-square form as two views of the same quadratic.",
      intro:`
        <div class="callout">
          <p><strong>Δ = b² − 4ac</strong>: positive means two x-intercepts, zero means one repeated intercept, and negative means no real x-intercept.</p>
        </div>`
    },
    {
      title:"Sketch from structure",
      short:"Graph",
      type:"Independent practice",
      indices:[11,12,13,14],
      objective:"Link turning point, axis, roots, and range in one coherent sketch.",
      intro:`
        <div class="callout warning">
          <p>Label the turning point and axis first. Then solve y = 0 for any x-intercepts. A sketch without these features is incomplete.</p>
        </div>`
    },
    {
      title:"Procedural fluency",
      short:"Fluency",
      type:"Optional timed practice",
      indices:[15,16,17],
      objective:"Build accurate completing-the-square and vertex-reading fluency before adding time pressure.",
      fluency:true,
      intro:`
        <div class="callout success">
          <h3>Timing is an advisory pace signal</h3>
          <p>Accuracy and method come first. Start the optional timer only after the method feels stable; solve time never creates or removes mastery.</p>
          <button type="button" class="secondary" id="fluencyTimer">Start optional timer</button>
          <p class="fine" id="fluencyReadout" aria-live="polite">Timer not started.</p>
        </div>`
    },
    {
      title:"Transfer checkpoint",
      short:"Transfer",
      type:"Tutor-reviewed bridge",
      indices:[18,19],
      objective:"Transfer the connected method to root classification and a multi-feature quadratic.",
      intro:`
        <div class="callout warning">
          <p>These remain tutor-authored bridges. Authentic, cited Add Maths items are required before a tutor can confirm mastery.</p>
        </div>`
    }
  ].filter(session => session.indices.some(index => allQuestions[index]));

  const state = AlphaMath.storage.get(storageKey,{
    activeSession:0,
    questions:{},
    sessionTimer:{running:false,elapsed:0,startedAt:null},
    createdAt:new Date().toISOString()
  });
  state.questions ||= {};
  state.sessionTimer ||= {running:false,elapsed:0,startedAt:null};
  state.createdAt ||= new Date().toISOString();

  const sessionMount = document.getElementById("sessionMount");
  const stepMount = document.getElementById("sessionSteps");
  const progressFill = document.getElementById("learningProgress");
  const progressText = document.getElementById("learningProgressText");
  const nextButton = document.getElementById("nextSession");
  const previousButton = document.getElementById("previousSession");
  let timerInterval = null;

  function save(){
    AlphaMath.storage.set(storageKey,state);
  }

  function qState(index){
    return state.questions[index] ||= {
      answer:"",
      checked:false,
      hintLevel:0,
      confidence:"",
      attempts:0,
      drawing:""
    };
  }

  function renderSolutionBlock(block){
    if(!block) return "";
    if(block.t === "text" || block.t === "cap"){
      return `<div class="solution-step">${AlphaMath.fractionMarkup(block.html || "")}</div>`;
    }
    if(block.t === "chain"){
      return `<div class="solution-step"><strong>${AlphaMath.fractionMarkup(block.frac || "")}</strong>
        <span aria-hidden="true"> → </span>${AlphaMath.escapeHTML(block.dec || "")}
        <span aria-hidden="true"> → </span><strong>${AlphaMath.escapeHTML(block.pct || "")}</strong></div>`;
    }
    if(block.t === "ld"){
      const divisor = Number(block.divisor);
      const dividend = Number(block.dividend);
      const places = Number.isFinite(Number(block.dp)) ? Number(block.dp) : 3;
      const quotient = divisor ? (dividend/divisor).toFixed(places).replace(/\.?0+$/,"") : "";
      return `<div class="solution-step"><strong>${AlphaMath.escapeHTML(block.cap || "Long division")}</strong>
        <div><code>${AlphaMath.escapeHTML(block.dividend)} ÷ ${AlphaMath.escapeHTML(block.divisor)} = ${AlphaMath.escapeHTML(quotient)}</code></div></div>`;
    }
    if(block.t === "answer"){
      return `<div class="answer-box"><span class="fine">Answer</span><br><span class="answer-math">${AlphaMath.fractionMarkup(block.html || "")}</span>
        ${block.mcq ? `<span> ${AlphaMath.escapeHTML(block.mcq)}</span>` : ""}</div>`;
    }
    return "";
  }

  function genericHint(question){
    if(question.tag === "Fluency"){
      return "Write the completed-square form first; then name h, k, and the sign of a.";
    }
    if(question.tag === "Transfer"){
      return "List the graph features required, then connect each one to the completed-square form or discriminant.";
    }
    return "Compare with a(x − h)² + k. Identify a, h, and k before calculating anything else.";
  }

  function questionMarkup(question,index){
    const q = qState(index);
    const solution = question.solution || [];
    const firstTeachingStep = solution.find(block => block.t === "text");
    return `
      <article class="question-card" data-question="${index}">
        <div class="question-head">
          <span class="q-number">${AlphaMath.escapeHTML(question.label || index+1)}</span>
          <div>
            <strong>${AlphaMath.escapeHTML(question.tag || "Practice")}</strong>
            <div class="q-meta">${question.cite ? AlphaMath.escapeHTML(question.cite) : "Tutor-authored bridge — not mastery evidence"}</div>
          </div>
          <span class="status ${q.checked ? "approaching" : "not-yet"}">${q.checked ? "Attempt recorded" : "Not attempted"}</span>
        </div>
        <div class="question-body">
          <p class="question-prompt">${AlphaMath.fractionMarkup(question.prompt || "")}</p>
          <div class="answer-row">
            <div>
              <label for="answer-${index}">My answer</label>
              <math-field id="answer-${index}" data-answer="${index}" aria-label="Answer for question ${AlphaMath.escapeHTML(question.label || index+1)}">${AlphaMath.escapeHTML(q.answer)}</math-field>
            </div>
            <button type="button" class="secondary" data-draw-toggle="${index}" aria-expanded="${q.drawing ? "true" : "false"}">Sketchpad</button>
          </div>
          <div class="draw-panel" data-draw-panel="${index}" ${q.drawing ? "" : "hidden"}></div>
          <div class="question-actions">
            <button type="button" data-hint="${index}" class="secondary">Give me a hint</button>
            <button type="button" data-check="${index}" class="primary">Check my work</button>
          </div>
          <div class="hint-stack" data-hints="${index}">
            ${q.hintLevel >= 1 ? `<div class="hint"><strong>Hint 1:</strong> ${genericHint(question)}</div>` : ""}
            ${q.hintLevel >= 2 && firstTeachingStep ? `<div class="hint"><strong>Hint 2:</strong> ${AlphaMath.fractionMarkup(firstTeachingStep.html)}</div>` : ""}
          </div>
          <div class="reflection" data-reflection="${index}" ${q.checked ? "" : "hidden"}>
            <strong>How did that attempt feel?</strong>
            <div class="confidence-row" role="group" aria-label="Confidence after this attempt">
              ${["sure","unsure","guessed"].map(value =>
                `<button type="button" class="confidence-button" data-confidence="${index}:${value}" aria-pressed="${q.confidence===value}">${value==="sure"?"I’m sure":value==="unsure"?"I’m unsure":"I guessed"}</button>`
              ).join("")}
            </div>
            <div class="button-row">
              <button type="button" class="success" data-solution-toggle="${index}" aria-expanded="false">Compare with worked solution</button>
              <button type="button" data-retry="${index}">Try again</button>
            </div>
          </div>
          <div class="worked-solution" data-solution="${index}" hidden>
            <h4>Worked solution</h4>
            ${solution.length ? solution.map(renderSolutionBlock).join("") : "<p>Review this response with your tutor.</p>"}
            <p class="fine">Self-check only. Your tutor decides whether the method supplies mastery evidence.</p>
          </div>
        </div>
      </article>`;
  }

  function renderSteps(){
    stepMount.innerHTML = sessions.map((session,index) => {
      const complete = session.indices.every(questionIndex => qState(questionIndex).checked);
      const current = index === state.activeSession;
      return `<button type="button" class="progress-step ${current?"is-active":""} ${complete?"is-complete":""}" data-session="${index}" ${current?'aria-current="step"':""} aria-label="Session ${index+1}: ${AlphaMath.escapeHTML(session.title)}. ${complete ? "Attempted" : AlphaMath.escapeHTML(session.type)}">
        <span class="session-number">Session ${index+1}</span>
        <span class="session-title">${AlphaMath.escapeHTML(session.title)}</span>
        <span class="session-type">${complete ? "Attempted" : AlphaMath.escapeHTML(session.type)}</span>
      </button>`;
    }).join("");
    requestAnimationFrame(() => {
      const current = stepMount.querySelector('[aria-current="step"]');
      if(!current) return;
      const railBox = stepMount.getBoundingClientRect();
      const currentBox = current.getBoundingClientRect();
      const centeredLeft = stepMount.scrollLeft + currentBox.left - railBox.left - (railBox.width-currentBox.width)/2;
      stepMount.scrollTo({left:Math.max(0,centeredLeft),behavior:"smooth"});
    });
  }

  function renderSession(){
    const active = sessions[state.activeSession] || sessions[0];
    if(!active) return;
    sessionMount.innerHTML = `
      <section class="session-panel" aria-labelledby="session-title">
        <div class="session-head">
          <div>
            <p class="session-kicker">Session ${state.activeSession+1} of ${sessions.length} · ${AlphaMath.escapeHTML(active.type)}</p>
            <h2 id="session-title">${AlphaMath.escapeHTML(active.title)}</h2>
            <p>${AlphaMath.escapeHTML(active.objective)}</p>
          </div>
          <span class="pill" style="color:var(--purple);border-color:#cab9dd;background:var(--purple-soft)">${active.indices.length} question${active.indices.length===1?"":"s"}</span>
        </div>
        ${active.intro}
        <div class="question-list" style="margin-top:20px">
          ${active.indices.filter(index => allQuestions[index]).map(index => questionMarkup(allQuestions[index],index)).join("")}
        </div>
      </section>`;

    sessionMount.querySelectorAll("[data-question]").forEach(card => {
      const index = Number(card.dataset.question);
      const panel = card.querySelector("[data-draw-panel]");
      AlphaMath.createDrawingPad(panel,{
        state:qState(index),
        label:`Sketchpad for question ${allQuestions[index].label || index+1}`,
        onSave(){ save(); }
      });
    });
    AlphaMath.initMathFields(sessionMount);
    setupFluencyTimer(active);
    updateProgress();
    renderSteps();
    previousButton.disabled = state.activeSession === 0;
    nextButton.textContent = state.activeSession === sessions.length-1 ? "Export practice record" : "Next session";
    document.getElementById("session-title")?.focus?.({preventScroll:true});
  }

  function setupFluencyTimer(active){
    clearInterval(timerInterval);
    if(!active.fluency) return;
    const button = document.getElementById("fluencyTimer");
    const readout = document.getElementById("fluencyReadout");
    function elapsed(){
      const extra = state.sessionTimer.running && state.sessionTimer.startedAt
        ? Math.floor((Date.now()-state.sessionTimer.startedAt)/1000) : 0;
      return state.sessionTimer.elapsed + extra;
    }
    function paint(){
      readout.textContent = state.sessionTimer.running
        ? `Optional timer: ${AlphaMath.formatTime(elapsed())}`
        : state.sessionTimer.elapsed
          ? `Timer paused at ${AlphaMath.formatTime(state.sessionTimer.elapsed)}`
          : "Timer not started.";
      button.textContent = state.sessionTimer.running ? "Pause optional timer" : state.sessionTimer.elapsed ? "Resume optional timer" : "Start optional timer";
    }
    button.addEventListener("click",() => {
      if(state.sessionTimer.running){
        state.sessionTimer.elapsed = elapsed();
        state.sessionTimer.running = false;
        state.sessionTimer.startedAt = null;
        clearInterval(timerInterval);
      }else{
        state.sessionTimer.running = true;
        state.sessionTimer.startedAt = Date.now();
        timerInterval = setInterval(paint,1000);
      }
      save();
      paint();
    });
    if(state.sessionTimer.running) timerInterval = setInterval(paint,1000);
    paint();
  }

  function updateProgress(){
    const attempted = Object.values(state.questions).filter(question => question.checked).length;
    const total = allQuestions.length;
    progressFill.style.width = `${total ? attempted/total*100 : 0}%`;
    progressText.textContent = `${attempted} of ${total} attempts recorded · completion is not mastery`;
    progressFill.parentElement?.setAttribute("aria-valuenow",String(attempted));
  }

  function showSolution(index){
    const solution = sessionMount.querySelector(`[data-solution="${index}"]`);
    const button = sessionMount.querySelector(`[data-solution-toggle="${index}"]`);
    if(!solution || !button) return;
    const opening = solution.hidden;
    solution.hidden = !opening;
    button.setAttribute("aria-expanded",String(opening));
    button.textContent = opening ? "Hide worked solution" : "Compare with worked solution";
  }

  function exportRecord(){
    const lines = [
      "AlphaMath CSEC Additional Mathematics Practice Record",
      `Student ID: ${studentId}`,
      "Pathway: Quadratics — completed square, turning points, range, and roots",
      "Mastery status: NOT DETERMINED — tutor review required",
      "",
      "--- ATTEMPTS ---"
    ];
    allQuestions.forEach((question,index) => {
      const q = qState(index);
      if(!q.checked && !q.answer && !q.hintLevel) return;
      lines.push(`Question ${question.label || index+1} [${question.tag || "Practice"}]`);
      lines.push(`Answer entered: ${q.answer || "(none)"}`);
      lines.push(`Attempt recorded: ${q.checked ? "yes" : "no"}`);
      lines.push(`Confidence: ${q.confidence || "(not recorded)"}`);
      lines.push(`Hints used: ${q.hintLevel || 0}`);
      lines.push(`Retries: ${q.attempts || 0}`);
      lines.push(`Drawing saved: ${q.drawing ? "yes" : "no"}`);
      if(question.cite) lines.push(`Source: ${question.cite}`);
      lines.push("");
    });
    lines.push("This record does not auto-grade or establish mastery.");
    AlphaMath.downloadText(`${studentId}-addmaths-quadratics-practice-log.txt`,lines.join("\n"));
  }

  sessionMount.addEventListener("input",event => {
    const field = event.target.closest("[data-answer]");
    if(!field) return;
    qState(Number(field.dataset.answer)).answer = field.value || "";
    save();
  });

  sessionMount.addEventListener("click",event => {
    const hint = event.target.closest("[data-hint]");
    if(hint){
      const index = Number(hint.dataset.hint);
      const q = qState(index);
      q.hintLevel = Math.min(2,q.hintLevel+1);
      save();
      renderSession();
      AlphaMath.announce(`Hint ${q.hintLevel} opened for question ${allQuestions[index].label || index+1}.`);
      return;
    }
    const check = event.target.closest("[data-check]");
    if(check){
      const index = Number(check.dataset.check);
      const q = qState(index);
      const field = sessionMount.querySelector(`[data-answer="${index}"]`);
      q.answer = field?.value || q.answer;
      if(!q.answer.trim()){
        AlphaMath.announce("Enter an answer before checking your work.");
        field?.focus();
        return;
      }
      q.checked = true;
      q.attempts = (q.attempts || 0)+1;
      save();
      renderSession();
      AlphaMath.announce("Attempt recorded. Choose a confidence response, then compare your method.");
      return;
    }
    const confidence = event.target.closest("[data-confidence]");
    if(confidence){
      const [index,value] = confidence.dataset.confidence.split(":");
      qState(Number(index)).confidence = value;
      save();
      sessionMount.querySelectorAll(`[data-confidence^="${index}:"]`).forEach(button =>
        button.setAttribute("aria-pressed",String(button===confidence)));
      AlphaMath.announce(`Confidence recorded: ${confidence.textContent.trim()}.`);
      return;
    }
    const solution = event.target.closest("[data-solution-toggle]");
    if(solution){ showSolution(Number(solution.dataset.solutionToggle)); return; }
    const retry = event.target.closest("[data-retry]");
    if(retry){
      const index = Number(retry.dataset.retry);
      sessionMount.querySelector(`[data-solution="${index}"]`)?.setAttribute("hidden","");
      sessionMount.querySelector(`[data-answer="${index}"]`)?.focus();
      AlphaMath.announce("Try the question again. Your earlier attempt remains in the practice record.");
      return;
    }
    const draw = event.target.closest("[data-draw-toggle]");
    if(draw){
      const index = Number(draw.dataset.drawToggle);
      const panel = sessionMount.querySelector(`[data-draw-panel="${index}"]`);
      const opening = panel.hidden;
      panel.hidden = !opening;
      draw.setAttribute("aria-expanded",String(opening));
      if(opening) panel.querySelector("canvas")?.focus();
    }
  });

  stepMount.addEventListener("click",event => {
    const button = event.target.closest("[data-session]");
    if(!button) return;
    state.activeSession = Number(button.dataset.session);
    save();
    renderSession();
    window.scrollTo({top:document.querySelector(".progress-rail")?.offsetTop || 0,behavior:"smooth"});
  });

  previousButton.addEventListener("click",() => {
    if(state.activeSession <= 0) return;
    state.activeSession -= 1;
    save();
    renderSession();
    window.scrollTo({top:0,behavior:"smooth"});
  });

  nextButton.addEventListener("click",() => {
    if(state.activeSession >= sessions.length-1){ exportRecord(); return; }
    state.activeSession += 1;
    save();
    renderSession();
    window.scrollTo({top:0,behavior:"smooth"});
  });

  document.getElementById("exportPractice")?.addEventListener("click",exportRecord);
  window.AlphaMathTutorial = {
    questions: allQuestions,
    getAttempt(){
      return {
        clientAttemptId: AlphaMath.ids.stable(
          `${storageKey}:database-attempt-id`,
          "tutorial-attempt"
        ),
        instrumentId: document.body.dataset.instrumentId || "addmaths-quadratics-foundation",
        sourceVersion: AlphaMath.version,
        startedAt: state.createdAt,
        submittedAt: new Date().toISOString(),
        learner: {
          externalId: studentId,
          displayName: document.body.dataset.studentName || "",
          school: document.body.dataset.school || "",
          email: document.body.dataset.studentEmail || ""
        },
        responses: allQuestions.map((question,index) => {
          const item = qState(index);
          return {
            itemId: String(question.label || index+1),
            answer: item.answer || "",
            confidence: item.confidence || "",
            checked: Boolean(item.checked),
            hintLevel: item.hintLevel || 0,
            attempts: item.attempts || 0,
            drawing: item.drawing || ""
          };
        }).filter(item => item.checked || item.answer || item.hintLevel || item.drawing)
      };
    }
  };
  document.dispatchEvent(new CustomEvent("alphamath:tutorial-ready"));
  renderSession();
})();
