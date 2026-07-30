(function(){
  "use strict";
  const learnerField = document.getElementById("dashboardLearnerId");
  const loadButton = document.getElementById("loadDashboard");
  const status = document.getElementById("dashboardStatus");
  const content = document.getElementById("dashboardContent");

  const LABELS = {
    continue_practice: "Continue practice",
    evidence_of_progress: "Evidence of progress",
    mastery_confirmed: "Mastery confirmed"
  };

  function displayDate(value){
    if(!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function decisionBadge(value){
    const className = value === "mastery_confirmed" ? "mastered"
      : value === "evidence_of_progress" ? "approaching" : "not-yet";
    return `<span class="status ${className}">${AlphaMath.escapeHTML(LABELS[value] || value)}</span>`;
  }

  function render(data){
    const learner = data.learner || {};
    document.getElementById("learnerName").textContent = learner.displayName || learner.externalId;
    document.getElementById("learnerMeta").textContent = [
      learner.externalId,
      learner.school,
      learner.email
    ].filter(Boolean).join(" · ");
    document.getElementById("intakeCount").textContent = data.counts.intakeSubmissions;
    document.getElementById("tutorialCount").textContent = data.counts.tutorialReviews;
    document.getElementById("examAttemptCount").textContent = data.counts.examAttempts;
    document.getElementById("examReviewCount").textContent = data.counts.examReviews;

    const objectives = document.getElementById("objectiveRows");
    objectives.innerHTML = (data.objectives || []).map(item => `<tr>
      <td><strong>${AlphaMath.escapeHTML(item.syllabusCode)}</strong></td>
      <td>${decisionBadge(item.latestDecision)}</td>
      <td>${Number(item.evidenceCount) || 0}</td>
      <td>${AlphaMath.escapeHTML(displayDate(item.reviewedAt))}</td>
      <td>${AlphaMath.escapeHTML(item.reviewerName || item.reviewerExternalId || "—")}</td>
    </tr>`).join("") || '<tr><td colspan="5"><em>No tutor-reviewed objective evidence has been submitted.</em></td></tr>';

    const topics = (data.latestIntake?.topics || []).filter(item => item.status === "practice");
    document.getElementById("intakePriorities").innerHTML = topics.map(item => `
      <article class="evidence-item">
        <div><strong>${AlphaMath.escapeHTML(item.code)}</strong><span class="status not-yet">Needs practice</span></div>
        <p>${AlphaMath.escapeHTML(item.note || "No confidence-drop note recorded.")}</p>
      </article>`).join("") || '<p class="fine">No latest intake or no topics identified for practice.</p>';

    document.getElementById("evidenceRows").innerHTML = (data.recentEvidence || []).map(item => `
      <article class="evidence-item">
        <div><strong>${item.type === "exam_review" ? "Simulated exam review" : "Tutorial review"}</strong>${decisionBadge(item.outcome)}</div>
        <p>${AlphaMath.escapeHTML((item.syllabusCodes || []).join(", "))}</p>
        <small>${AlphaMath.escapeHTML(displayDate(item.reviewedAt))} · ${AlphaMath.escapeHTML(item.reviewerName || item.reviewerExternalId || "Tutor")}</small>
      </article>`).join("") || '<p class="fine">No reviewed tutorial or exam evidence has been submitted.</p>';
    content.hidden = false;
  }

  async function load(){
    const learnerId = learnerField.value.trim();
    if(!learnerId){
      status.textContent = "Enter a learner ID.";
      learnerField.focus();
      return;
    }
    loadButton.disabled = true;
    status.textContent = "Loading linked evidence…";
    try{
      const data = await AlphaMath.api.dashboard(learnerId);
      render(data);
      status.textContent = `Showing current PostgreSQL evidence for ${learnerId}.`;
      AlphaMath.announce("Learning evidence dashboard loaded.");
    }catch(error){
      content.hidden = true;
      status.textContent = error.status === 404
        ? `No PostgreSQL record exists for ${learnerId} yet.`
        : error.message;
    }finally{
      loadButton.disabled = false;
    }
  }

  loadButton.addEventListener("click", load);
  learnerField.addEventListener("keydown", event => {
    if(event.key === "Enter") load();
  });
})();
