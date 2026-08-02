/*
 * Set your password — the one-time-link consumer (spec 2026-08-01, Issue A9).
 *
 * Deliberately public: the bearer of a live token IS the authorization —
 * admin-minted, single-use, expiring. The token rides the URL FRAGMENT, which
 * never reaches server logs; after a successful set it is stripped from the
 * address bar, because a spent link in a history entry should look spent.
 * Success issues no session: the holder signs in fresh, which proves the loop.
 *
 * PORTED FILE — byte-identical across both builds; the CSEC qa-suite pins it.
 */
(function(){
  "use strict";
  const shell = document.querySelector("[data-set-password]");
  if(!shell) return;
  const form = shell.querySelector("form");
  const status = shell.querySelector("[data-status]");
  const done = shell.querySelector("[data-done]");
  /* runtime-config ONLY — deliberately NOT auth.js's storage fallback: a value
     any script on the origin can write, or a stale entry left on a shared
     device, must never choose where a password is POSTed. Deployment sets
     apiBase (DWP §3.2); "" means same-origin and fails harmlessly against a
     static host. Do not "fix" this asymmetry. */
  const apiBase = (window.ALPHAMATH_RUNTIME || {}).apiBase || "";

  const token = new URLSearchParams((location.hash || "").replace(/^#/, "")).get("t") || "";
  if(!token){
    form.hidden = true;
    status.textContent = "This page only works from a link your administrator gives you — this address carries no link token.";
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const password = form.password.value;
    const confirmed = form.confirm.value;
    if(password !== confirmed){
      status.textContent = "The two entries differ — type them again.";
      return;
    }
    const button = form.querySelector("[data-submit]");
    button.disabled = true;
    status.textContent = "Setting your password…";
    try{
      const response = await fetch(apiBase + "/v1/set-password", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({token, password})
      });
      const body = await response.json().catch(() => ({}));
      if(!response.ok){
        /* A 400 does NOT burn the link (the server validates the password
           before consuming it) — re-enable and let the holder try again.
           404/410 mean the link itself is dead, and the server's message says
           who to ask for a new one. */
        status.textContent = body.error || "That did not work — try again.";
        button.disabled = false;
        return;
      }
      form.hidden = true;
      done.hidden = false;
      shell.querySelector("[data-sign-in-as]").textContent = body.signInAs || "";
      history.replaceState(null, "", location.pathname + location.search);
      status.textContent = "";
    }catch{
      status.textContent = "Could not reach the server. Check the connection and try again.";
      button.disabled = false;
    }
  });

  /* Readiness marker: set only after the submit handler is wired, so a test
     (or anything else) that waits on it can never race the defer scripts into
     a native submission. Found the hard way: a submit fired before wiring
     falls back to a native GET — which is why the form is also method="post". */
  shell.setAttribute("data-ready", "1");
})();
