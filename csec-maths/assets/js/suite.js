(function(){
  "use strict";

  // The optional MathLive font and sound packs are not bundled. Disable those
  // fetches before dynamically-created math fields mount so the suite remains
  // offline-first and does not generate failed network requests.
  if(window.MathfieldElement){
    window.MathfieldElement.fontsDirectory = null;
    window.MathfieldElement.soundsDirectory = null;
    try{ window.MathfieldElement.computeEngine = null; }catch(_error){}
  }

  const AlphaMath = {
    version: "2.0.3-redesign-20260729",

    storage: {
      get(key, fallback = null){
        try{
          const raw = localStorage.getItem(key);
          return raw === null ? fallback : JSON.parse(raw);
        }catch(_error){
          return fallback;
        }
      },
      set(key, value){
        try{
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        }catch(_error){
          return false;
        }
      }
    },

    /*
     * WHICH LEARNER IS THIS PAGE FOR?
     *
     * Every learner-facing page used to answer that with
     *   document.body.dataset.studentId || "REVIEW-DEMO"
     * so the suite was a single-learner demo: the fallback was baked in, and each
     * page carried its own copy of the answer. Storage keys are namespaced by this
     * id (alphamath:<id>:simulated-exam-1:v2), so the id decides whose draft a page
     * reads and writes — it is not cosmetic.
     *
     * Resolution order, most explicit first:
     *   1. ?learner=ID   — an explicit choice; persisted so the rest of the suite follows
     *   2. the stored selection
     *   3. data-student-id on <body> — the page's own declaration, used for authored
     *      documents written for one learner
     *   4. null — nothing is assumed. A page with no learner should say so rather
     *      than silently write into someone else's namespace.
     *
     * THESE PAGES ARE OFFLINE-FIRST AND UNAUTHENTICATED, deliberately: tutorials
     * and exams work with no API and no login. So this is a SELECTION, not an
     * identity claim, and it authorises nothing. Anyone at the keyboard can change
     * it and read the local drafts under that id — true before this change and
     * still true, and the reason a shared device should not be used for drafting.
     * Everything in the database is authorised server-side, where the session
     * decides and this value is never consulted.
     */
    learner: {
      STORAGE_KEY: "alphamath:active-learner",
      VALID: /^[A-Za-z0-9][A-Za-z0-9_.-]{1,59}$/,

      current(){
        const url = new URLSearchParams(location.search).get("learner");
        if(url && AlphaMath.learner.VALID.test(url)){
          AlphaMath.learner.set(url);
          return url;
        }
        const stored = AlphaMath.storage.get(AlphaMath.learner.STORAGE_KEY, "");
        if(stored && AlphaMath.learner.VALID.test(stored)) return stored;
        const declared = document.body?.dataset?.studentId || "";
        return AlphaMath.learner.VALID.test(declared) ? declared : null;
      },

      set(id){
        if(!AlphaMath.learner.VALID.test(String(id || ""))) return false;
        return AlphaMath.storage.set(AlphaMath.learner.STORAGE_KEY, String(id));
      },

      clear(){
        try{ localStorage.removeItem(AlphaMath.learner.STORAGE_KEY); return true; }
        catch(_error){ return false; }
      },

      /* Renders "working as <id>" into any [data-active-learner] element, so no
         page can leave it ambiguous whose work is on screen. */
      show(){
        const id = AlphaMath.learner.current();
        document.querySelectorAll("[data-active-learner]").forEach(node => {
          node.textContent = id || "no learner selected";
          node.classList.toggle("learner-unset", !id);
        });
        return id;
      }
    },

    escapeHTML(value){
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
      })[char]);
    },

    downloadText(filename, content){
      const blob = new Blob([content], {type:"text/plain;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    formatTime(totalSeconds){
      const seconds = Math.max(0, Math.floor(totalSeconds || 0));
      const minutes = Math.floor(seconds / 60);
      return `${minutes}:${String(seconds % 60).padStart(2,"0")}`;
    },

    // A client-generated attempt id, minted once and then reused from storage.
    // The server upserts on this value, so a retry after a dropped connection
    // resolves to the same attempt rather than a duplicate. It must therefore
    // survive a reload, which is why it is stored rather than held in memory.
    ids: {
      stable(storageKey, prefix){
        const existing = AlphaMath.storage.get(storageKey, "");
        if(existing) return existing;
        const suffix = globalThis.crypto?.randomUUID?.()
          || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const value = `${prefix}:${suffix}`;
        AlphaMath.storage.set(storageKey, value);
        return value;
      }
    },

    announce(message){
      let live = document.getElementById("suite-live-region");
      if(!live){
        live = document.createElement("div");
        live.id = "suite-live-region";
        live.className = "sr-only";
        live.setAttribute("aria-live","polite");
        live.setAttribute("aria-atomic","true");
        document.body.append(live);
      }
      live.textContent = "";
      requestAnimationFrame(() => { live.textContent = message; });
    },

    initMathFields(root = document){
      if(!window.MathfieldElement) return;
      try{
        MathfieldElement.fontsDirectory = null;
        MathfieldElement.soundsDirectory = null;
      }catch(_error){}
      root.querySelectorAll("math-field").forEach(field => {
        field.setAttribute("virtual-keyboard-mode","manual");
        field.setAttribute("smart-mode","false");
        if(field.hasAttribute("read-only") || field.nextElementSibling?.classList.contains("math-entry-shortcuts")) return;

        const shortcuts = document.createElement("div");
        shortcuts.className = "math-entry-shortcuts";
        shortcuts.innerHTML = '<button type="button" class="math-symbol-button" aria-label="Insert percentage sign" title="Insert percentage sign">%</button><span class="math-shortcut-copy">Insert percent sign</span>';
        shortcuts.querySelector("button").addEventListener("click",() => {
          field.focus();
          if(typeof field.insert === "function") field.insert("\\%");
          else field.value = `${field.value || ""}\\%`;
          field.dispatchEvent(new Event("input",{bubbles:true}));
          AlphaMath.announce("Percentage sign inserted.");
        });
        field.insertAdjacentElement("afterend",shortcuts);
      });
    },

    /*
     * A stacked fraction that assistive technology can also read.
     *
     * The visual build is two grid rows with a rule between them, which looks
     * right and carries no semantics at all. Read by textContent — which is what
     * a screen reader gets — the two rows run together, so \f(3,5) was announced
     * as "thirty-five". Exam question 10 asks the learner to order 3/5, 0.58 and
     * 62%; spoken, it asked them to order 35, 0.58 and 62%. Not unclear — a
     * different and wrong question, and silent, because the page looks correct.
     *
     * role="math" plus an accessible name is the standard fallback where MathML
     * is not used; the rows are hidden from the tree so they cannot be read
     * twice, once as a fraction and once as digits.
     */
    fractionMarkup(value){
      const attr = text => String(text).replace(/&/g,"&amp;").replace(/"/g,"&quot;")
        .replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return String(value || "").replace(/\\f\(([^,()]+),([^()]+)\)/g, (_match, numerator, denominator) =>
        `<span role="math" aria-label="${attr(numerator.trim())} over ${attr(denominator.trim())}"` +
        ' style="display:inline-grid;grid-template-rows:auto auto;vertical-align:middle;text-align:center;line-height:1.05;margin:0 .12em">' +
        `<span aria-hidden="true" style="border-bottom:1.4px solid currentColor;padding:0 .16em">${numerator}</span>` +
        `<span aria-hidden="true" style="padding:0 .16em">${denominator}</span></span>`);
    },

    createDrawingPad(container, options = {}){
      const key = options.storageKey;
      const state = options.state || {};
      /* The three sizes are the server's contract, not a local preference: the
         evidence API validates responses[].sketchpadSize against exactly these
         names, and an annotation's pixel dimensions must match the pad it
         overlays. Adding a fourth here without adding it there is a rejected
         submission. */
      const sizes = {
        compact:{width:960,height:320,label:"Compact"},
        standard:{width:960,height:480,label:"Standard"},
        expanded:{width:960,height:700,label:"Expanded"}
      };
      // A pinned overlay MUST match the learner canvas it sits on. Resizing
      // resamples via drawImage, which would misregister every tutor stroke
      // against the working it refers to.
      if(options.fixedSize && sizes[options.fixedSize]) state.sketchpadSize = options.fixedSize;
      state.sketchpadSize = sizes[state.sketchpadSize] ? state.sketchpadSize : "standard";
      const initialSize = sizes[state.sketchpadSize];

      const canvas = document.createElement("canvas");
      canvas.className = "draw-canvas";
      canvas.width = initialSize.width;
      canvas.height = initialSize.height;
      canvas.setAttribute("aria-label",options.label || "Sketchpad for mathematical working");
      canvas.setAttribute("role","img");
      canvas.tabIndex = 0;

      const tools = document.createElement("div");
      tools.className = "draw-tools";
      tools.innerHTML = [
        '<div class="draw-tool-group" aria-label="Sketchpad tools">',
          '<button type="button" data-tool="pen" aria-pressed="true">Pen</button>',
          '<button type="button" data-tool="eraser" aria-pressed="false">Eraser</button>',
          '<button type="button" data-tool="undo">Undo</button>',
          '<button type="button" data-tool="clear" class="danger">Clear</button>',
        '</div>',
        options.fixedSize ? '' : [
          '<div class="draw-tool-group sketchpad-sizes" aria-label="Sketchpad size">',
            '<span class="fine">Size</span>',
            ...Object.entries(sizes).map(([id,size]) =>
              `<button type="button" data-sketchpad-size="${id}" aria-pressed="${String(id === state.sketchpadSize)}">${size.label}</button>`
            ),
          '</div>'
        ].join("")
      ].join("");
      container.append(tools,canvas);

      const context = canvas.getContext("2d");
      let drawing = false;
      let erasing = false;
      let previous = null;
      const history = [];

      function whiteBackground(){
        context.save();
        context.fillStyle = "#fff";
        context.fillRect(0,0,canvas.width,canvas.height);
        context.restore();
      }
      function snapshot(){
        history.push(canvas.toDataURL("image/png"));
        if(history.length > 15) history.shift();
      }
      function restore(dataURL){
        if(!dataURL){ whiteBackground(); return; }
        const image = new Image();
        image.onload = () => {
          context.clearRect(0,0,canvas.width,canvas.height);
          whiteBackground();
          context.drawImage(image,0,0,canvas.width,canvas.height);
        };
        image.src = dataURL;
      }
      function save(){
        state.drawing = canvas.toDataURL("image/png");
        if(key) AlphaMath.storage.set(key,state);
        if(typeof options.onSave === "function") options.onSave(state.drawing);
      }
      /* Resizing repaints the existing working onto the new canvas rather than
         discarding it — a learner changing size mid-question must not lose work.
         drawImage rescales, so strokes stay where they were relative to the pad. */
      function resizeCanvas(sizeId){
        const nextSize = sizes[sizeId];
        if(!nextSize || sizeId === state.sketchpadSize) return;
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext("2d").drawImage(canvas,0,0);
        canvas.width = nextSize.width;
        canvas.height = nextSize.height;
        whiteBackground();
        context.drawImage(copy,0,0,copy.width,copy.height,0,0,canvas.width,canvas.height);
        state.sketchpadSize = sizeId;
        tools.querySelectorAll("[data-sketchpad-size]").forEach(button =>
          button.setAttribute("aria-pressed",String(button.dataset.sketchpadSize === sizeId)));
        save();
        AlphaMath.announce(`Sketchpad size changed to ${nextSize.label.toLowerCase()}.`);
      }
      function point(event){
        const rect = canvas.getBoundingClientRect();
        return {
          x:(event.clientX-rect.left)*(canvas.width/rect.width),
          y:(event.clientY-rect.top)*(canvas.height/rect.height)
        };
      }
      function begin(event){
        if(options.locked) return;
        event.preventDefault();
        snapshot();
        drawing = true;
        previous = point(event);
        canvas.setPointerCapture?.(event.pointerId);
      }
      function move(event){
        if(!drawing || options.locked) return;
        event.preventDefault();
        const next = point(event);
        context.save();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = erasing ? 24 : 4;
        context.strokeStyle = erasing ? "#fff" : "#14213d";
        context.beginPath();
        context.moveTo(previous.x,previous.y);
        context.lineTo(next.x,next.y);
        context.stroke();
        context.restore();
        previous = next;
      }
      function end(event){
        if(!drawing) return;
        drawing = false;
        canvas.releasePointerCapture?.(event.pointerId);
        save();
      }
      canvas.addEventListener("pointerdown",begin);
      canvas.addEventListener("pointermove",move);
      canvas.addEventListener("pointerup",end);
      canvas.addEventListener("pointercancel",end);

      tools.addEventListener("click",event => {
        const button = event.target.closest("button");
        if(!button || options.locked) return;
        const sizeId = button.dataset.sketchpadSize;
        if(sizeId){ resizeCanvas(sizeId); return; }
        const tool = button.dataset.tool;
        if(tool === "pen" || tool === "eraser"){
          erasing = tool === "eraser";
          // Scoped to [data-tool]: an unscoped [aria-pressed] sweep would also
          // reset the size buttons, so picking the pen would clear which size
          // is selected.
          tools.querySelectorAll("[data-tool][aria-pressed]").forEach(item =>
            item.setAttribute("aria-pressed",String(item === button)));
        }
        if(tool === "undo"){
          const last = history.pop();
          if(last){ restore(last); setTimeout(save,60); }
        }
        if(tool === "clear"){
          snapshot();
          context.clearRect(0,0,canvas.width,canvas.height);
          whiteBackground();
          save();
        }
      });

      whiteBackground();
      if(state.drawing) restore(state.drawing);
      if(options.locked){
        tools.querySelectorAll("button").forEach(button => button.disabled = true);
        canvas.setAttribute("aria-disabled","true");
      }
      return {canvas,save,lock(){
        options.locked = true;
        tools.querySelectorAll("button").forEach(button => button.disabled = true);
        canvas.setAttribute("aria-disabled","true");
      }};
    }
  };

  /*
   * Evidence API client.
   *
   * This is a deliberate port of the CSEC Additional Mathematics suite's client
   * rather than a second implementation: both clients speak to the same server,
   * and two hand-written transports would drift on the first contract change.
   * Keep the two in step — see PHASE8_ADAPTER.md.
   *
   * The bearer token here authenticates the *deployment*, not the learner. It
   * is the pre-002 shared token, and it is what the Additional Mathematics exam
   * page still uses too. Moving learner submission onto per-user sessions is a
   * recorded open item (ADR 0002, "the shared token is still accepted"), not
   * something this adapter introduces. It is held in sessionStorage so it dies
   * with the tab and is never written to a static host.
   */
  /*
   * Evidence submission runs on the signed-in account, and on nothing else.
   *
   * What used to live here was a dialog that asked the user for a shared
   * deployment token and kept it in sessionStorage. Every user of every page was
   * handed the same secret, and the API accepted it for writes — so a learner
   * submitting their own intake held a credential that could write evidence
   * against any child in the database. That is now closed on both sides: this
   * module carries no token, and the API refuses one.
   *
   * All of this delegates to AlphaMath.auth, which owns the session. A page that
   * submits must therefore load auth.js; the guard below says so plainly rather
   * than failing with "cannot read properties of undefined".
   */
  function session(){
    if(!AlphaMath.auth) throw new Error("This page cannot save to the database: the sign-in module was not loaded.");
    return AlphaMath.auth;
  }

  AlphaMath.api = {
    configured(){
      return Boolean(AlphaMath.auth && AlphaMath.auth.signedIn());
    },
    async connect(){
      return session().ensureSession();
    },
    disconnect(){
      session().logout();
      AlphaMath.announce("Signed out of the evidence database in this browser tab.");
    },
    async request(path, options = {}){
      const account = await session().ensureSession();
      if(!account){
        /* Cancelling is a legitimate answer, not a failure. The offline draft is
           the source of truth until a submission succeeds, so callers report
           this quietly. */
        const error = new Error("Database submission cancelled. Your local draft is unchanged.");
        error.cancelled = true;
        throw error;
      }
      return session().json(path, options);
    },
    submit(path, payload){
      return this.request(path, {method: "POST", body: JSON.stringify(payload)});
    },
    dashboard(externalId){
      return this.request(`/v1/learners/${encodeURIComponent(externalId)}/dashboard`);
    }
  };

  window.AlphaMath = AlphaMath;
  document.addEventListener("DOMContentLoaded",() => {
    AlphaMath.initMathFields();
    /* Painted on every page that asks for it, so no learner-facing screen can be
       ambiguous about whose saved work it is showing. */
    AlphaMath.learner.show();
  });
})();
