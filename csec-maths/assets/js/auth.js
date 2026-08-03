(function(){
  "use strict";
  if(!window.AlphaMath) return;

  /*
   * Session handling for the tutor surfaces.
   *
   * The token lives in sessionStorage and nowhere else — never in this
   * repository, never in HTML, never in a query string, never logged. It dies
   * with the tab. That is deliberate: a tutor's session grants access to the
   * educational records of minors, and a token in a URL ends up in browser
   * history, server logs, and any Referer header the page emits.
   *
   * Role is read from the server via /v1/me and used only to decide what to
   * DISPLAY. Every actual authorization decision is the API's; hiding a link is
   * not access control.
   */

  const TOKEN_KEY = "alphamath:session-token";
  const runtime = window.ALPHAMATH_RUNTIME || {};

  function apiBase(){
    const base = runtime.apiBase || AlphaMath.storage.get("alphamath:evidence-api-base", "");
    return String(base || "").replace(/\/+$/, "");
  }

  const auth = {
    apiBase,
    token(){ return sessionStorage.getItem(TOKEN_KEY) || ""; },
    signedIn(){ return Boolean(auth.token() && apiBase()); },

    async login(identifier, password){
      const base = apiBase();
      if(!base) throw new Error("Set the evidence API address before signing in.");
      let response;
      try{
        response = await fetch(`${base}/v1/auth/login`, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({identifier, password})
        });
      }catch(_networkError){
        /* The address is wrong, or nothing is listening on it — the request
           never reached a server, so no password was ever examined. Said
           plainly, because the old message ("Sign-in failed") sent people to
           check a credential that was never the problem. The address is
           REMEMBERED per browser, so a bad one keeps failing silently until
           it is corrected here. */
        throw new Error(
          `Could not reach the evidence API at ${base} — check the address ` +
          `(a local API is usually http://, not https://). Your password was not checked.`);
      }
      const payload = await response.json().catch(() => ({}));
      if(!response.ok){
        // Surface the server's generic message; do not add detail the server
        // deliberately withheld.
        throw new Error(payload.error || "Sign-in failed.");
      }
      sessionStorage.setItem(TOKEN_KEY, payload.token);
      return payload.user;
    },

    async logout(){
      const base = apiBase();
      const token = auth.token();
      sessionStorage.removeItem(TOKEN_KEY);
      if(!base || !token) return;
      try{
        await fetch(`${base}/v1/auth/logout`, {
          method: "POST",
          headers: {authorization: `Bearer ${token}`}
        });
      }catch{
        // The local token is already gone; a failed revoke must not strand the
        // user on a page they can no longer use.
      }
    },

    async me(){
      const response = await auth.fetch("/v1/me");
      if(response.status === 401) return null;
      if(!response.ok) throw new Error("Could not read the signed-in account.");
      return response.json();
    },

    // Single place the bearer header is attached.
    fetch(path, options = {}){
      const base = apiBase();
      if(!base) throw new Error("The evidence API address is not set.");
      const token = auth.token();
      return fetch(`${base}${path}`, {
        ...options,
        headers: {
          ...(options.body ? {"content-type": "application/json"} : {}),
          ...(token ? {authorization: `Bearer ${token}`} : {}),
          ...(options.headers || {})
        }
      });
    },

    async json(path, options){
      let response;
      try{
        response = await auth.fetch(path, options);
      }catch(_networkError){
        /* Same distinction as login(): unreachable is not unauthorised. Without
           this, an API that stopped between sign-in and this call surfaces as a
           bare "Failed to fetch" on whichever screen the reader was using. */
        throw new Error(`Could not reach the evidence API at ${apiBase()}. It may have stopped, ` +
                        `or the address may be wrong.`);
      }
      if(response.status === 401){
        sessionStorage.removeItem(TOKEN_KEY);
        throw Object.assign(new Error("Your session has ended. Sign in again."), {signedOut: true});
      }
      const payload = await response.json().catch(() => ({}));
      if(!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
      return payload;
    },

    /* Requires a signed-in account in one of `roles`; returns it, or renders a
       sign-in form into `container` and returns null.

       The role check here decides what to DISPLAY. It is not access control —
       every real authorization decision belongs to the API, which re-checks on
       every request. A hidden link has never protected anything. */
    async requireRole(container, roles, onReady, copy = {}){
      const render = () => {
        container.innerHTML = `
          <form class="panel signin" data-signin>
            <h2>${AlphaMath.escapeHTML(copy.heading || "Tutor sign-in")}</h2>
            <p class="fine">${AlphaMath.escapeHTML(copy.blurb || "Marking uses your own account. The evidence API records the authenticated reviewer, so a review is always attributable to a named person.")}</p>
            <label for="apiBase">Evidence API address</label>
            <!-- The placeholder shows the LOCAL form, because that is the only
                 deployment that exists today and "https://…" sent people to an
                 HTTPS port the API does not listen on. Remembered per browser
                 once entered, so a wrong value here is sticky. -->
            <input id="apiBase" name="apiBase" inputmode="url" placeholder="the evidence API address"
                   value="${AlphaMath.escapeHTML(apiBase())}" required>
            <p class="fine">This demonstration ships no evidence API, so sign-in cannot connect. Every offline instrument on these pages works without one.</p>
            <label for="identifier">${AlphaMath.escapeHTML(copy.identifierLabel || "Email or tutor ID")}</label>
            <input id="identifier" name="identifier" autocomplete="username" required>
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
            <p class="fine" data-signin-status role="status" aria-live="polite"></p>
            <button class="primary" type="submit">Sign in</button>
          </form>`;
        const form = container.querySelector("[data-signin]");
        const status = container.querySelector("[data-signin-status]");
        form.addEventListener("submit", async event => {
          event.preventDefault();
          status.textContent = "Signing in…";
          try{
            AlphaMath.storage.set("alphamath:evidence-api-base",
              String(form.apiBase.value || "").replace(/\/+$/, ""));
            await auth.login(form.identifier.value, form.password.value);
            const account = await auth.me();
            if(!account || !roles.includes(account.role)){
              await auth.logout();
              status.textContent = copy.wrongRole || "This account cannot use this page.";
              return;
            }
            container.innerHTML = "";
            onReady(account);
          }catch(error){
            status.textContent = error.message;
          }
        });
      };

      if(!auth.signedIn()){ render(); return null; }
      try{
        const account = await auth.me();
        if(!account || !roles.includes(account.role)){ render(); return null; }
        onReady(account);
        return account;
      }catch{
        render();
        return null;
      }
    },

    requireTutor(container, onReady){
      return auth.requireRole(container, ["tutor", "admin"], onReady, {
        wrongRole: "This account is not a tutor account."
      });
    },

    /* Admin only — deliberately NOT ["admin","tutor"] like requireTutor. The
       console approves accounts and registers learners; a tutor holding it would
       be able to grant themselves assignments. The server enforces this too
       (every /v1/admin/ route checks the role); this gate only saves a round trip
       and shows an honest message. */
    requireAdmin(container, onReady){
      return auth.requireRole(container, ["admin"], onReady, {
        heading: "Administrator sign-in",
        blurb: "The console manages accounts, learner records and assignments. Every action is taken as your account.",
        wrongRole: "This account is not an administrator account."
      });
    },

    requireLearner(container, onReady){
      return auth.requireRole(container, ["learner"], onReady, {
        heading: "Sign in to see your marked work",
        blurb: "Your work is shown only to you, and only after a tutor has finished marking it.",
        identifierLabel: "Email or learner ID",
        wrongRole: "This account is not a learner account."
      });
    },

    /* Modal sign-in, for the offline-first pages.
     *
     * requireRole gates a whole page before it renders. These pages are the
     * other kind: a tutorial or an exam is usable with no account at all, saved
     * to a local draft, and only the final "save to the database" step needs an
     * identity. Gating those behind a full-page sign-in would take working
     * offline away from learners who have no connection to sign in with.
     *
     * So the modal appears at the moment of submission and nowhere earlier. It
     * replaces a dialog that asked for a shared deployment token — the same
     * shape, but a credential belonging to one person rather than a secret every
     * user was handed. Resolves the account, or null if the user cancelled; the
     * caller must treat null as "the local draft stands". */
    async ensureSession(){
      if(auth.signedIn()){
        const account = await auth.me().catch(() => null);
        if(account) return account;
        // A stale token from a closed session — fall through and ask.
        sessionStorage.removeItem(TOKEN_KEY);
      }
      return signInDialog();
    }
  };

  function signInDialog(){
    let dialog = document.getElementById("alphamathSignInDialog");
    if(!dialog){
      dialog = document.createElement("dialog");
      dialog.id = "alphamathSignInDialog";
      dialog.innerHTML = `
        <form method="dialog" class="connection-form">
          <div class="dialog-body">
            <p class="eyebrow">Secure evidence connection</p>
            <h2 style="margin-top:0">Sign in to save</h2>
            <p class="fine">Your work is already saved on this device. Signing in records it in the AlphaMath database under your own account — the database keeps the name of whoever saved it.</p>
            <label for="alphamathDialogApiBase">Evidence API address</label>
            <!-- type="url" would reject a bare host; inputmode alone is enough,
                 and the placeholder shows the local form for the same reason as
                 the sign-in card above. -->
            <input id="alphamathDialogApiBase" name="apiBase" inputmode="url" placeholder="the evidence API address" required>
            <label for="alphamathDialogIdentifier" style="margin-top:12px">Email or ID</label>
            <input id="alphamathDialogIdentifier" name="identifier" autocomplete="username" required>
            <label for="alphamathDialogPassword" style="margin-top:12px">Password</label>
            <input id="alphamathDialogPassword" name="password" type="password" autocomplete="current-password" required>
            <p class="connection-error fine" id="alphamathSignInError" role="alert" hidden></p>
          </div>
          <div class="dialog-actions">
            <button type="button" data-signin-cancel>Cancel</button>
            <button type="submit" class="primary">Sign in and save</button>
          </div>
        </form>`;
      document.body.append(dialog);
    }

    const form = dialog.querySelector("form");
    const error = dialog.querySelector("#alphamathSignInError");
    form.apiBase.value = apiBase();
    form.password.value = "";
    error.hidden = true;

    return new Promise(resolve => {
      function close(result){
        dialog.removeEventListener("close", onClose);
        form.removeEventListener("submit", onSubmit);
        dialog.querySelector("[data-signin-cancel]").removeEventListener("click", onCancel);
        // Never leave a typed password sitting in a detached DOM node.
        form.password.value = "";
        resolve(result);
      }
      function onClose(){ close(null); }
      function onCancel(){ dialog.close(); }
      async function onSubmit(event){
        event.preventDefault();
        error.hidden = true;
        try{
          AlphaMath.storage.set("alphamath:evidence-api-base",
            String(form.apiBase.value || "").replace(/\/+$/, ""));
          const account = await auth.login(form.identifier.value, form.password.value);
          dialog.removeEventListener("close", onClose);
          dialog.close();
          close(account);
        }catch(problem){
          error.textContent = problem.message;
          error.hidden = false;
        }
      }
      dialog.addEventListener("close", onClose);
      form.addEventListener("submit", onSubmit);
      dialog.querySelector("[data-signin-cancel]").addEventListener("click", onCancel);
      if(typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
  }

  AlphaMath.auth = auth;
})();
