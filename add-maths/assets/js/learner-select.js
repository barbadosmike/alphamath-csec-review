/*
 * The learner selector on the suite home.
 *
 * Every learner-facing page namespaces its localStorage by the active learner, so
 * this control decides whose drafts the tutorial, the exams and the intake read
 * and write. Before it existed the answer was compiled in — one id, one demo.
 *
 * IT SELECTS; IT DOES NOT AUTHENTICATE. These pages are offline-first and have no
 * session, by design, so nothing here is a permission. Anyone at this keyboard can
 * pick any id and see the local drafts stored under it. That was equally true when
 * the id was hardcoded, and it is why drafting on a shared device is a bad idea —
 * but it is worth being explicit rather than letting a dropdown imply otherwise.
 * Evidence in the database is a separate matter entirely: the server decides there,
 * from the session, and never consults this value.
 *
 * The list comes from the evidence API when a tutor or administrator is signed in.
 * Signed out — the normal state for a learner at a laptop — the control still works
 * as free text, because requiring a login to open your own tutorial would defeat
 * the offline-first design.
 */
(function(){
  "use strict";
  if(!window.AlphaMath) return;

  const mount = document.querySelector("[data-learner-select]");
  if(!mount) return;

  const esc = value => AlphaMath.escapeHTML(String(value == null ? "" : value));

  function render(known){
    const active = AlphaMath.learner.current();
    mount.innerHTML = `
      <form class="learner-picker" data-picker>
        <label for="learnerId">Working as</label>
        <div class="learner-picker-row">
          <input id="learnerId" name="learnerId" list="knownLearners" autocomplete="off"
                 pattern="[A-Za-z0-9][A-Za-z0-9_.\\-]{1,59}" maxlength="60"
                 placeholder="Learner ID" value="${esc(active || "")}">
          <datalist id="knownLearners">${known.map(id => `<option value="${esc(id)}"></option>`).join("")}</datalist>
          <button type="submit">Use this learner</button>
          ${active ? `<button type="button" class="secondary" data-clear>Clear</button>` : ""}
        </div>
        <p class="fine">${active
          ? `The tutorial, exams and intake on this device are reading and writing <strong>${esc(active)}</strong>'s saved work.`
          : `No learner selected. Pages will not save work under a learner until one is chosen.`}</p>
        ${known.length ? "" : `<p class="fine">Sign in as a tutor to list registered learners, or type an ID.</p>`}
      </form>`;

    mount.querySelector("[data-picker]").addEventListener("submit", event => {
      event.preventDefault();
      const value = event.target.learnerId.value.trim();
      if(!AlphaMath.learner.set(value)){
        AlphaMath.announce("That learner ID is not valid.");
        return;
      }
      AlphaMath.announce(`Now working as ${value}.`);
      location.reload();
    });

    mount.querySelector("[data-clear]")?.addEventListener("click", () => {
      AlphaMath.learner.clear();
      location.reload();
    });
  }

  /* A signed-in tutor gets their roster; everyone else gets free text. The failure
     is silent and non-blocking on purpose — no API, no session, or no permission
     must still leave a working control. */
  async function knownLearners(){
    try{
      if(!AlphaMath.auth || !AlphaMath.auth.signedIn()) return [];
      const {learners = []} = await AlphaMath.auth.json("/v1/tutor/learners");
      return learners.map(entry => entry.externalId).filter(Boolean);
    }catch(_error){
      return [];
    }
  }

  render([]);
  knownLearners().then(list => { if(list.length) render(list); });
})();
