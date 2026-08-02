/*
 * Admin console — accounts, learner records and assignments.
 *
 * SESSION AUTH, ADMIN ROLE, AND THE SERVER IS THE AUTHORITY. Every /v1/admin/
 * route re-checks the role, so this page's gate is a courtesy, not a control. It
 * exists so an unauthorised visitor gets a clear message instead of a wall of
 * 403s — never assume a check here is load-bearing.
 *
 * WHY THIS PAGE SHOWS NAMES WHEN THE TUTOR WORKSPACE REFUSES TO.
 * The workspace renders subject-scoped ids only, because it is open in a
 * classroom beside the learner it describes. Administration is the opposite job:
 * approving an account or registering a student is precisely the moment someone
 * must confirm WHO. So names appear here deliberately — and this page should not
 * be opened on a shared screen. The warning at the top says so.
 */
(function(){
  "use strict";
  if(!window.AlphaMath || !AlphaMath.auth) return;

  const gate = document.querySelector("[data-auth-gate]");
  if(!gate) return;
  const status = document.querySelector("[data-console-status]");
  const esc = value => AlphaMath.escapeHTML(String(value == null ? "" : value));
  const mount = selector => document.querySelector(selector);

  function announce(message, tone){
    status.textContent = message;
    status.className = tone === "error" ? "fine error-text" : "fine";
    AlphaMath.announce(message);
  }

  async function refresh(){
    const [users, learners] = await Promise.all([
      AlphaMath.auth.json("/v1/admin/users"),
      AlphaMath.auth.json("/v1/admin/learners")
    ]);
    renderUsers(users.users || []);
    renderLearners(learners.learners || []);
    fillAssignmentOptions(users.users || [], learners.learners || []);
    return {users: users.users || [], learners: learners.learners || []};
  }

  /* Pending accounts first — they are the queue, and an approval waiting unseen is
     a tutor who cannot work. */
  function renderUsers(users){
    /* Issue A10, both tiers closed 2026-08-01. The server now records
       activated_at — whether an account was EVER able to sign in — so the two
       populations this queue used to mix are separated on a server fact rather
       than inferred from a heuristic. Requests (never activated) get Approve and
       Decline; suspended veterans get Reinstate only. The heuristic that
       suppressed Decline behind the active-learner count is retired: it protected
       the botched offboarding and exposed the correct one, and the guard behind
       this screen now refuses to delete any ever-activated account regardless of
       what a page offers. */
    const requests = users.filter(user => !user.active && !user.activatedAt);
    const suspended = users.filter(user => !user.active && user.activatedAt);
    const activeUsers = users.filter(user => user.active);
    // The count is TRUE requests only — suspended accounts are not "waiting".
    mount("[data-pending-count]").textContent = String(requests.length);

    const requestsBlock = requests.length
      ? `<div class="table-wrap"><table>
          <caption class="sr-only">Accounts requesting access — never yet able to sign in</caption>
          <thead><tr><th scope="col">ID</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Email</th><th scope="col">Account created</th><th scope="col">Decision</th></tr></thead>
          <tbody>${requests.map(user => `<tr>
            <td><strong>${esc(user.externalId)}</strong></td>
            <td>${esc(user.displayName)}</td>
            <td>${esc(user.role)}</td>
            <td>${esc(user.email)}</td>
            <td>${esc(user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—")}</td>
            <td class="action-cell">
              <button type="button" data-approve="${esc(user.externalId)}">Approve</button>
              <button type="button" class="secondary" data-decline="${esc(user.externalId)}">Decline</button>
            </td></tr>`).join("")}</tbody></table></div>
          <p class="fine">Every row here has <strong>never been able to sign in</strong> — declining deletes the request and erases nothing anyone did. The server refuses to delete any account that was ever approved, whatever a page offers.</p>`
      : `<div class="callout info"><p>No accounts are waiting for approval.</p></div>`;

    const suspendedBlock = suspended.length
      ? `<h3 style="margin-top:18px">Suspended accounts</h3>
         <div class="table-wrap"><table>
          <caption class="sr-only">Suspended accounts — approved once, access withdrawn</caption>
          <thead><tr><th scope="col">ID</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Learners</th><th scope="col">First approved</th><th scope="col"></th></tr></thead>
          <tbody>${suspended.map(user => `<tr>
            <td><strong>${esc(user.externalId)}</strong></td>
            <td>${esc(user.displayName)}</td>
            <td>${esc(user.role)}</td>
            <td>${user.role === "tutor" ? user.assignedLearners : "—"}</td>
            <td>${esc(user.activatedAt ? new Date(user.activatedAt).toLocaleDateString() : "—")}</td>
            <td class="action-cell"><button type="button" class="secondary" data-password-link="${esc(user.externalId)}">Password link</button> <button type="button" data-approve="${esc(user.externalId)}" data-reinstate="1">Reinstate</button></td>
          </tr>`).join("")}</tbody></table></div>
          <p class="fine">These accounts were approved once and their access was withdrawn. They cannot be deleted — their history is real. <strong>Every session they held was revoked at the moment of suspension</strong>, so reinstating grants nothing back: the holder signs in afresh. For a credential concern, change the password before reinstating; it governs the next sign-in (SOP-OPS-004, callout 1). The <strong>Password link</strong> button issues the one-time link that does exactly that — the holder types the new password themselves.</p>`
      : "";

    mount("[data-pending]").innerHTML = requestsBlock + suspendedBlock;

    /* Sessions and last sign-in are rendered so a suspension states what it will
       revoke BEFORE the click (Issue A8 / finding D1: a revoke-sessions operation
       arrives with a way to see what it would revoke). */
    mount("[data-accounts]").innerHTML = `<div class="table-wrap"><table>
        <caption class="sr-only">Active accounts</caption>
        <thead><tr><th scope="col">ID</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Learners</th><th scope="col">Sessions</th><th scope="col">Last sign-in</th><th scope="col"></th></tr></thead>
        <tbody>${activeUsers.map(user => `<tr>
          <td><strong>${esc(user.externalId)}</strong></td>
          <td>${esc(user.displayName)}</td>
          <td>${esc(user.role)}</td>
          <td>${user.role === "tutor" ? user.assignedLearners : "—"}</td>
          <td>${user.activeSessions > 0 ? `${user.activeSessions} live` : "—"}</td>
          <td>${esc(user.lastSignedInAt ? new Date(user.lastSignedInAt).toLocaleDateString() : "never")}</td>
          <td class="action-cell"><button type="button" class="secondary" data-password-link="${esc(user.externalId)}">Password link</button> <button type="button" class="secondary" data-suspend="${esc(user.externalId)}" data-live-sessions="${user.activeSessions || 0}">Suspend</button></td>
        </tr>`).join("")}</tbody></table></div>`;
  }

  function renderLearners(learners){
    mount("[data-learner-count]").textContent = String(learners.length);
    mount("[data-learners]").innerHTML = learners.length
      ? `<div class="table-wrap"><table>
          <caption class="sr-only">Registered learners</caption>
          <thead><tr><th scope="col">Learner ID</th><th scope="col">Name</th><th scope="col">School</th><th scope="col">Registered</th><th scope="col">Account</th></tr></thead>
          <tbody>${learners.map(learner => `<tr>
            <td><strong>${esc(learner.externalId)}</strong></td>
            <td>${esc(learner.displayName) || "<span class='fine'>not stored</span>"}</td>
            <td>${esc(learner.school) || "<span class='fine'>not stored</span>"}</td>
            <td>${esc(learner.createdAt ? new Date(learner.createdAt).toLocaleDateString() : "—")}</td>
            <td>${learner.hasAccount
              ? `<span class="fine">has account</span>`
              : `<details class="provision">
                  <summary>Provision account…</summary>
                  <form data-provision-form data-learner="${esc(learner.externalId)}" class="stack">
                    <p class="fine">The learner signs in with their <strong>learner ID</strong>. Hand the
                    keyboard to the learner for the password — they choose it, you never see it,
                    and it is stored only as a hash.</p>
                    <label>Password (typed by the learner)
                      <input name="password" type="password" autocomplete="new-password" required minlength="12"></label>
                    <label>Repeat it
                      <input name="confirm" type="password" autocomplete="new-password" required minlength="12"></label>
                    <button type="submit">Create ${esc(learner.externalId)}'s account</button>
                  </form>
                  <p class="fine" style="margin-top:10px">Learner remote (the teleconference ceremony, SOP-OPS-004 §3)?
                  Create the account with a <strong>set-password link</strong> instead — it is born unusable,
                  and the learner opens the link on <em>their</em> device and types the password there.</p>
                  <button type="button" class="secondary" data-provision-link="${esc(learner.externalId)}">Provision with set-password link</button>
                </details>`}</td>
          </tr>`).join("")}</tbody></table></div>`
      : `<div class="callout info"><p>No learners are registered yet.</p></div>`;
  }

  function fillAssignmentOptions(users, learners){
    const tutors = users.filter(user => user.active && user.role === "tutor");
    mount("#assignTutor").innerHTML = tutors.length
      ? tutors.map(user => `<option value="${esc(user.externalId)}">${esc(user.externalId)} — ${esc(user.displayName)}</option>`).join("")
      : `<option value="">No approved tutors yet</option>`;
    mount("#assignLearner").innerHTML = learners.length
      ? learners.map(learner => `<option value="${esc(learner.externalId)}">${esc(learner.externalId)}</option>`).join("")
      : `<option value="">No learners registered yet</option>`;

    const parents = users.filter(user => user.active && user.role === "parent");
    mount("#linkParent").innerHTML = parents.length
      ? parents.map(user => `<option value="${esc(user.externalId)}">${esc(user.externalId)} — ${esc(user.displayName)}</option>`).join("")
      : `<option value="">No approved parents yet</option>`;
    mount("#linkLearner").innerHTML = mount("#assignLearner").innerHTML;
  }

  async function act(label, run){
    try{
      announce(`${label}…`);
      await run();
      await refresh();
      announce(`${label} — done.`);
    }catch(error){
      if(error.signedOut){ location.reload(); return; }
      announce(error.message || `${label} failed.`, "error");
    }
  }

  AlphaMath.auth.requireAdmin(gate, async (account) => {
    document.querySelector("[data-sign-out]")?.addEventListener("click", async () => {
      await AlphaMath.auth.logout();
      location.reload();
    });
    mount("[data-signed-in]").textContent = `${account.displayName || account.externalId} · ${account.role}`;

    /* Delegated, because every table is re-rendered after each action and bound
       handlers would be lost. */
    document.addEventListener("click", event => {
      const approve = event.target.closest("[data-approve]");
      const decline = event.target.closest("[data-decline]");
      const suspend = event.target.closest("[data-suspend]");
      if(approve){
        const id = approve.getAttribute("data-approve");
        /* Issue A8 is CLOSED (2026-08-01): suspension revokes every live session
           in the same statement, so re-approval can no longer resurrect a token
           and the eight-hour warning that used to live here is retired. What
           remains is the credential note — still UNGATED (G5): the queue cannot
           know a row's history, and an unnecessary sentence costs less than a
           missing one. The password clause keeps its precision: a password
           change governs the NEXT sign-in; it has never closed a session, and
           with revocation on suspension it no longer needs to. */
        const reinstating = approve.hasAttribute("data-reinstate");
        const warning =
          `${reinstating ? `Reinstate ${id}?` : `Approve ${id}?`}\n\n` +
          `This grants a working account. Sessions never survive suspension — any the account held were revoked when it was suspended — so the holder signs in afresh.\n\n` +
          `For a credential concern (a lost device, a shared password), change the password before approving; it governs the next sign-in.`;
        if(!confirm(warning)) return;
        act(`Approving ${id}`, () => AlphaMath.auth.json(`/v1/admin/users/${encodeURIComponent(id)}/approve`, {method: "POST"}));
      }
      if(decline){
        const id = decline.getAttribute("data-decline");
        if(!confirm(`Decline ${id}? This DELETES the account.\n\nDecline only a row you can match to a logged account request in the Issue Tracker (SOP-OPS-004, callout 2). A suspended account looks identical here — if in doubt, leave the row where it is.`)) return;
        act(`Declining ${id}`, () => AlphaMath.auth.json(`/v1/admin/users/${encodeURIComponent(id)}`, {method: "DELETE"}));
      }
      if(suspend){
        const id = suspend.getAttribute("data-suspend");
        const live = Number(suspend.getAttribute("data-live-sessions") || 0);
        const sessions = live > 0
          ? `Their ${live} live session${live === 1 ? "" : "s"} are revoked immediately`
          : `Any live session is revoked immediately`;
        if(!confirm(`Suspend ${id}?\n\n${sessions} and sign-in is blocked until reinstated. Revocation is permanent — reinstating grants the account back, never its old sessions.`)) return;
        act(`Suspending ${id}`, () => AlphaMath.auth.json(`/v1/admin/users/${encodeURIComponent(id)}/suspend`, {method: "POST"}));
      }
    });

    /* One-time set-password links (spec 2026-08-01, Issue A9). Two issuers, one
       panel: provision-with-link creates the account born-unusable and mints its
       link; Password link reissues for any existing account — the machinery
       behind "change the password before reinstating". The secret appears ONCE,
       in the panel; it is never stored and never re-displayed, so the panel is
       a dedicated mount that the table refreshes cannot wipe. */
    function showPasswordLink(id, body){
      const panel = mount("[data-password-link-panel]");
      const link = new URL("set-password.html", location.href);
      link.hash = "t=" + body.setPasswordToken;
      panel.hidden = false;
      panel.innerHTML = `
        <p><strong>One-time set-password link for ${esc(id)}</strong> — shown once, never stored,
        works once, expires ${esc(new Date(body.tokenExpiresAt).toLocaleTimeString())}. Reissuing replaces it.</p>
        <p><code>${esc(link.href)}</code></p>
        <p class="fine">The ceremony rule: the holder opens it on <em>their</em> device and types the
        password there — you never see or handle it. After they say "done":
        <button type="button" class="secondary" data-link-status="${esc(id)}">Check link status</button>
        — <strong>used</strong> is the good answer; unused after they report success is stop-and-reissue.</p>
        <p class="fine" data-link-status-out role="status"></p>`;
    }

    document.addEventListener("click", async event => {
      const provisionLink = event.target.closest("[data-provision-link]");
      const passwordLink = event.target.closest("[data-password-link]");
      const linkStatus = event.target.closest("[data-link-status]");
      if(linkStatus){
        const id = linkStatus.getAttribute("data-link-status");
        try{
          const {link} = await AlphaMath.auth.json(`/v1/admin/password-links?account=${encodeURIComponent(id)}`);
          mount("[data-link-status-out]").textContent = !link
            ? "No link on record for this account."
            : link.usedAt
              ? `USED at ${new Date(link.usedAt).toLocaleTimeString()} — the holder set their password.`
              : new Date(link.expiresAt).getTime() <= Date.now()
                ? "Unused and EXPIRED — reissue if it is still needed."
                : `Unused — live until ${new Date(link.expiresAt).toLocaleTimeString()}.`;
        }catch(error){ announce(error.message, "error"); }
        return;
      }
      if(!provisionLink && !passwordLink) return;
      const id = provisionLink
        ? provisionLink.getAttribute("data-provision-link")
        : passwordLink.getAttribute("data-password-link");
      try{
        announce(`Issuing a set-password link for ${id}…`);
        const body = provisionLink
          ? await AlphaMath.auth.json("/v1/admin/learner-accounts", {
              method: "POST", body: JSON.stringify({learnerExternalId: id, issueLink: true})})
          : await AlphaMath.auth.json("/v1/admin/password-links", {
              method: "POST", body: JSON.stringify({accountExternalId: id})});
        showPasswordLink(provisionLink ? body.externalId : body.accountExternalId, body);
        if(provisionLink) await refresh();
        announce(`Link for ${id} ready — copy it from the panel below the accounts table.`);
      }catch(error){
        if(error.signedOut){ location.reload(); return; }
        announce(error.message || "Issuing the link failed.", "error");
      }
    });

    /* Learner-account provisioning (Issue A11) — delegated like the buttons,
       because the learners table re-renders after every action. The password
       belongs to the child: the admin turns the keyboard, the field is masked,
       and both fields are cleared before anything else happens, success or not. */
    document.addEventListener("submit", event => {
      const form = event.target.closest("[data-provision-form]");
      if(!form) return;
      event.preventDefault();
      const learnerId = form.getAttribute("data-learner");
      const password = form.password.value;
      const confirm = form.confirm.value;
      form.password.value = "";
      form.confirm.value = "";
      if(password !== confirm){
        announce("The two passwords do not match. Ask the learner to type them again.", "error");
        return;
      }
      act(`Creating ${learnerId}'s account`, () =>
        AlphaMath.auth.json("/v1/admin/learner-accounts", {
          method: "POST",
          body: JSON.stringify({learnerExternalId: learnerId, password})
        }));
    });

    mount("[data-register-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      const form = event.target;
      const payload = {
        externalId: form.externalId.value.trim(),
        displayName: form.displayName.value.trim(),
        school: form.school.value.trim(),
        email: form.email.value.trim()
      };
      act(`Registering ${payload.externalId}`, async () => {
        await AlphaMath.auth.json("/v1/admin/learners", {method: "POST", body: JSON.stringify(payload)});
        form.reset();
      });
    });

    mount("[data-parent-link-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      const form = event.target;
      const parent = form.linkParent.value;
      const learner = form.linkLearner.value;
      if(!parent || !learner){ announce("Pick both a parent and a learner.", "error"); return; }
      act(`Linking ${learner} to ${parent}`, () => AlphaMath.auth.json("/v1/admin/parent-links", {
        method: "POST",
        body: JSON.stringify({parentExternalId: parent, learnerExternalId: learner, active: form.linkActive.checked})
      }));
    });

    mount("[data-assign-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      const form = event.target;
      const tutor = form.assignTutor.value;
      const learner = form.assignLearner.value;
      if(!tutor || !learner){ announce("Pick both a tutor and a learner.", "error"); return; }
      act(`Assigning ${learner} to ${tutor}`, () => AlphaMath.auth.json("/v1/admin/assignments", {
        method: "POST",
        body: JSON.stringify({tutorExternalId: tutor, learnerExternalId: learner, active: form.assignActive.checked})
      }));
    });

    try{
      await refresh();
      announce("");
      document.querySelector("[data-console]").hidden = false;
    }catch(error){
      announce(error.message, "error");
      if(error.signedOut) location.reload();
    }
  });
})();
