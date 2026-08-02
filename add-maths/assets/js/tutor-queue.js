(function(){
  "use strict";
  if(!window.AlphaMath || !AlphaMath.auth) return;

  const gate = document.querySelector("[data-auth-gate]");
  const panel = document.querySelector("[data-queue]");
  const rows = document.querySelector("[data-queue-rows]");
  const statusLine = document.querySelector("[data-queue-status-line]");
  const statusSelect = document.querySelector("[data-queue-status]");
  const signedInAs = document.querySelector("[data-signed-in-as]");
  if(!gate || !panel) return;

  const when = (value) => {
    if(!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString();
  };

  function stateLabel(row){
    if(row.reviewStatus === "reviewed") return "Reviewed";
    if(row.reviewStatus !== "claimed") return "Awaiting review";
    if(row.claimedByMe) return row.claimExpired ? "Your claim expired" : "Claimed by you";
    return row.claimExpired ? "Claim expired" : "Claimed by another tutor";
  }

  // A claim is available when nothing holds it, it is yours, or the hold lapsed.
  const claimable = (row) =>
    row.reviewStatus === "submitted" || row.claimedByMe || row.claimExpired;

  function render(list){
    if(!list.length){
      rows.innerHTML = `<tr><td colspan="6"><em>Nothing here. Attempts appear once a learner submits and locks an exam, and only for learners assigned to you.</em></td></tr>`;
      return;
    }
    rows.innerHTML = list.map(row => `
      <tr>
        <td><strong>${AlphaMath.escapeHTML(row.learnerDisplayName || row.learnerExternalId || "—")}</strong>
            <div class="fine">${AlphaMath.escapeHTML(row.learnerExternalId || "")}</div></td>
        <td>${AlphaMath.escapeHTML(row.instrumentId || "—")}</td>
        <td>${AlphaMath.escapeHTML(when(row.submittedAt))}</td>
        <td>${Number(row.itemCount) || 0}</td>
        <td>${AlphaMath.escapeHTML(stateLabel(row))}</td>
        <td>${
          row.reviewStatus === "reviewed"
            ? `<a class="button secondary" href="tutor-review.html?attempt=${encodeURIComponent(row.id)}">Open</a>`
            : claimable(row)
              ? `<a class="button primary" href="tutor-review.html?attempt=${encodeURIComponent(row.id)}">${row.claimedByMe ? "Continue" : "Claim and open"}</a>`
              : `<span class="fine">Held by another tutor</span>`
        }</td>
      </tr>`).join("");
  }

  async function load(){
    statusLine.textContent = "Loading…";
    try{
      const status = statusSelect.value;
      const payload = await AlphaMath.auth.json(`/v1/tutor/exam-attempts?status=${encodeURIComponent(status)}`);
      render(payload.attempts || []);
      statusLine.textContent = `${payload.count} attempt${payload.count === 1 ? "" : "s"}.`;
    }catch(error){
      rows.innerHTML = "";
      statusLine.textContent = error.message;
      if(error.signedOut) location.reload();
    }
  }

  AlphaMath.auth.requireTutor(gate, account => {
    panel.hidden = false;
    signedInAs.textContent = `${account.displayName} · ${account.role}`;
    signedInAs.className = "status approaching";
    document.querySelector("[data-queue-refresh]")?.addEventListener("click", load);
    statusSelect.addEventListener("change", load);
    document.querySelector("[data-sign-out]")?.addEventListener("click", async () => {
      await AlphaMath.auth.logout();
      location.reload();
    });
    load();
  });
})();
