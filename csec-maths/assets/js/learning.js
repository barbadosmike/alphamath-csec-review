(function(){
  "use strict";

  const contentGlobal = document.body.dataset.contentGlobal || "MSTU001_TUTORIAL";
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
    ? "alphamath:csec:study-template:v2"
    : `alphamath:${studentId.toLowerCase()}:proportional-reasoning:v2`;

  const sessions = [
    {
      title:"Readiness check",
      short:"Readiness",
      type:"Diagnostic bridge",
      indices:[0,1,2],
      objective:"Show what you already know before teaching begins.",
      intro:`
        <div class="callout info">
          <h3>Accuracy first. No timer.</h3>
          <p>These questions reactivate useful knowledge. They do not count as mastery evidence.</p>
        </div>
        <div class="grid two" style="margin-top:16px">
          <div class="lesson-card">
            <p class="eyebrow">Visual model</p>
            <h3>Three quarters is one amount</h3>
            <div class="fraction-bar" aria-label="A bar divided into four equal parts with three shaded">
              <span class="filled"></span><span class="filled"></span><span class="filled"></span><span></span>
            </div>
            <p><strong>3/4</strong>, <strong>0.75</strong>, and <strong>75%</strong> are three names for the same amount.</p>
          </div>
          <div class="lesson-card">
            <p class="eyebrow">Syllabus connection</p>
            <h3>Module 1, SO 1.4</h3>
            <p>Convert among fractions, percents, and decimals.</p>
            <p class="fine">CSEC Mathematics syllabus effective for examinations from 2027, printed page 18.</p>
          </div>
        </div>`
    },
    {
      title:"Benchmark fractions",
      short:"Benchmarks",
      type:"Guided practice",
      indices:[3,4,5,6],
      objective:"Connect familiar fifths and eighths to decimals and percentages.",
      intro:`
        <div class="visual-loop" aria-label="Fraction to decimal to percent conversion loop">
          <div class="loop-node"><div><b>Fraction</b><span>divide top by bottom</span></div></div>
          <div class="loop-arrow" aria-hidden="true">→</div>
          <div class="loop-node"><div><b>Decimal</b><span>keep place value visible</span></div></div>
          <div class="loop-arrow" aria-hidden="true">→</div>
          <div class="loop-node"><div><b>Percent</b><span>multiply by 100</span></div></div>
        </div>`
    },
    {
      title:"Eighths and comparison",
      short:"Eighths",
      type:"Independent practice",
      indices:[7,8,9,10],
      objective:"Continue long division and compare equivalent forms.",
      intro:`
        <div class="callout">
          <p><strong>One rule:</strong> the value does not change. Only its name changes.</p>
          <p>If the division does not end after one digit, add a zero and continue.</p>
        </div>`
    },
    {
      title:"Place value patterns",
      short:"Place value",
      type:"Independent practice",
      indices:[11,12,13,14],
      objective:"Use tenths, twentieths, and twenty-fifths efficiently.",
      intro:`
        <div class="grid two">
          <div class="callout info"><p><strong>Shortcut with meaning:</strong> 7/20 = 35/100, so it is 35%.</p></div>
          <div class="callout warning"><p><strong>Check:</strong> a proper fraction must produce a decimal between 0 and 1.</p></div>
        </div>`
    },
    {
      title:"Longer division",
      short:"Long division",
      type:"Supported challenge",
      indices:[15,16,17,18],
      objective:"Keep place value organized when the decimal has several digits.",
      intro:`
        <div class="callout">
          <p>Write one division step per line. Estimate first, then compare the estimate with your result.</p>
        </div>`
    },
    {
      title:"Fluency checkpoint",
      short:"Fluency",
      type:"Optional timed practice",
      indices:[19],
      objective:"Repeat the key conversion accurately; use timing only after the method feels secure.",
      fluency:true,
      intro:`
        <div class="callout success">
          <h3>Timing is optional</h3>
          <p>The programme uses time as a pace signal, never as a mastery gate. Start the clock only if you are ready.</p>
          <button type="button" class="secondary" id="fluencyTimer">Start optional timer</button>
          <p class="fine" id="fluencyReadout" aria-live="polite">Timer not started.</p>
        </div>`
    },
    {
      title:"Applied percentages",
      short:"Applications",
      type:"Exam transfer — Paper 1",
      indices:[20,21,22,23,24],
      objective:"Use the foundation skill in percentage-of-amount, tax, reverse-percentage, and interest contexts.",
      intro:`
        <div class="grid two">
          <div class="lesson-card">
            <p class="eyebrow">Forward percentage</p>
            <h3>Find part of a known whole</h3>
            <p>60% of 80 means <strong>0.60 × 80</strong>.</p>
          </div>
          <div class="lesson-card">
            <p class="eyebrow">Reverse percentage</p>
            <h3>Recover the original whole</h3>
            <p>If 80% of the original is 160, use <strong>160 ÷ 0.80</strong>.</p>
          </div>
        </div>
        <div class="callout warning" style="margin-top:16px">
          <p>Authentic items can contribute evidence only after tutor marking. Completing this page does not declare mastery.</p>
        </div>`
    },
    {
      title:"Paper 2 extension",
      short:"Paper 2",
      type:"Tutor-directed extension",
      indices:[25,26,27,28,29],
      objective:"Transfer the method into multi-step Paper 2 work while preserving method marks.",
      intro:`
        <div class="callout warning">
          <h3>Do this section with tutor direction</h3>
          <p>These source items extend into fraction operations and algebra. They are retained, but they come after the proportional-reasoning foundation.</p>
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
  // Backfilled for practice started before the tutorial had a review checkpoint,
  // so an older saved session still reports a start time rather than nothing.
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
      return `<div class="answer-box"><span class="fine">Answer</span><br>${AlphaMath.fractionMarkup(block.html || "")}
        ${block.mcq ? `<span> ${AlphaMath.escapeHTML(block.mcq)}</span>` : ""}</div>`;
    }
    return "";
  }

  function genericHint(question){
    if(question.tag === "Bridge"){
      return "Name the direction first: fraction → decimal, decimal → percent, or percent → decimal.";
    }
    if(question.tag === "Paper 1"){
      return "Underline what is given and what must be found. Then write the percentage as a decimal or fraction.";
    }
    return "Write the given information, name the operation, and complete one step per line.";
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
      "AlphaMath CSEC Mathematics Practice Record",
      `Student ID: ${studentId}`,
      "Pathway: Proportional reasoning foundation",
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
    AlphaMath.downloadText(`${studentId}-proportional-reasoning-practice-log.txt`,lines.join("\n"));
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

  /*
   * The human review checkpoint.
   *
   * review.js mounts its panel from this global when the page declares
   * data-review-kind="tutorial". Without it the tutorial had no checkpoint at
   * all, so practice could be completed with nothing for a tutor to sign — the
   * one thing CONTEXT.md says a mastery decision requires.
   *
   * Only questions the learner actually engaged with are sent. An untouched
   * question is not evidence of anything, and padding the record with empties
   * would make a tutor read twenty rows to find the three that happened.
   */
  window.AlphaMathTutorial = {
    questions: allQuestions,
    getAttempt(){
      return {
        clientAttemptId: AlphaMath.ids.stable(
          `${storageKey}:database-attempt-id`,
          "tutorial-attempt"
        ),
        instrumentId: document.body.dataset.instrumentId || "csec-proportional-reasoning-foundation",
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

  renderSession();
})();
