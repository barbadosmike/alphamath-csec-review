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
    version: "review-1.1.1-20260730",

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

    fractionMarkup(value){
      return String(value || "").replace(/\\f\(([^,()]+),([^()]+)\)/g,
        '<span style="display:inline-grid;grid-template-rows:auto auto;vertical-align:middle;text-align:center;line-height:1.05;margin:0 .12em"><span style="border-bottom:1.4px solid currentColor;padding:0 .16em">$1</span><span style="padding:0 .16em">$2</span></span>');
    },

    createDrawingPad(container, options = {}){
      const key = options.storageKey;
      const state = options.state || {};
      const canvas = document.createElement("canvas");
      canvas.className = "draw-canvas";
      canvas.width = 960;
      canvas.height = 360;
      canvas.setAttribute("aria-label",options.label || "Drawing area for mathematical working");
      canvas.setAttribute("role","img");
      canvas.tabIndex = 0;

      const tools = document.createElement("div");
      tools.className = "draw-tools";
      tools.innerHTML = [
        '<button type="button" data-tool="pen" aria-pressed="true">Pen</button>',
        '<button type="button" data-tool="eraser" aria-pressed="false">Eraser</button>',
        '<button type="button" data-tool="undo">Undo</button>',
        '<button type="button" data-tool="clear" class="danger">Clear</button>'
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
        const tool = button.dataset.tool;
        if(tool === "pen" || tool === "eraser"){
          erasing = tool === "eraser";
          tools.querySelectorAll("[aria-pressed]").forEach(item =>
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

  const runtime = window.ALPHAMATH_RUNTIME || {};
  const connectionKey = "alphamath:evidence-api-base";
  const tokenKey = "alphamath:evidence-api-token";

  function normalizeBase(value){
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function connection(){
    return {
      apiBase: normalizeBase(runtime.apiBase || AlphaMath.storage.get(connectionKey, "")),
      token: sessionStorage.getItem(tokenKey) || ""
    };
  }

  function connectionDialog(){
    let dialog = document.getElementById("alphamathConnectionDialog");
    if(dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "alphamathConnectionDialog";
    dialog.innerHTML = `
      <form method="dialog" class="connection-form">
        <div class="dialog-body">
          <p class="eyebrow">Secure evidence connection</p>
          <h2 style="margin-top:0">Connect this browser</h2>
          <p class="fine">PostgreSQL remains behind the AlphaMath API. The access token is kept only in this browser tab and is never written to GitHub Pages.</p>
          <label for="alphamathApiBase">Evidence API address</label>
          <input id="alphamathApiBase" type="url" inputmode="url" placeholder="https://api.example.org" required>
          <label for="alphamathApiToken" style="margin-top:12px">Tutor access token</label>
          <input id="alphamathApiToken" type="password" autocomplete="off" required>
          <p class="connection-error fine" id="alphamathConnectionError" role="alert" hidden></p>
        </div>
        <div class="dialog-actions">
          <button type="button" data-connection-cancel>Cancel</button>
          <button type="submit" class="primary">Connect securely</button>
        </div>
      </form>`;
    document.body.append(dialog);
    return dialog;
  }

  async function configureConnection(){
    const dialog = connectionDialog();
    const baseField = dialog.querySelector("#alphamathApiBase");
    const tokenField = dialog.querySelector("#alphamathApiToken");
    const error = dialog.querySelector("#alphamathConnectionError");
    const current = connection();
    baseField.value = current.apiBase;
    tokenField.value = current.token;
    error.hidden = true;
    return new Promise(resolve => {
      function close(result){
        dialog.removeEventListener("close", onClose);
        dialog.querySelector("form").removeEventListener("submit", onSubmit);
        dialog.querySelector("[data-connection-cancel]").removeEventListener("click", onCancel);
        resolve(result);
      }
      function onClose(){ close(null); }
      function onCancel(){ dialog.close(); }
      async function onSubmit(event){
        event.preventDefault();
        const apiBase = normalizeBase(baseField.value);
        const token = tokenField.value;
        error.hidden = true;
        try{
          const response = await fetch(`${apiBase}/health`, {
            headers: {authorization: `Bearer ${token}`}
          });
          if(!response.ok) throw new Error(response.status === 401 ? "Access token was not accepted." : "The API could not be reached.");
          AlphaMath.storage.set(connectionKey, apiBase);
          sessionStorage.setItem(tokenKey, token);
          dialog.removeEventListener("close", onClose);
          dialog.close();
          close({apiBase, token});
        }catch(problem){
          error.textContent = problem.message;
          error.hidden = false;
        }
      }
      dialog.addEventListener("close", onClose);
      dialog.querySelector("form").addEventListener("submit", onSubmit);
      dialog.querySelector("[data-connection-cancel]").addEventListener("click", onCancel);
      if(typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
  }

  AlphaMath.api = {
    configured(){
      const current = connection();
      return Boolean(current.apiBase && current.token);
    },
    async connect(){
      return configureConnection();
    },
    disconnect(){
      sessionStorage.removeItem(tokenKey);
      AlphaMath.announce("Evidence API disconnected from this browser tab.");
    },
    async request(path, options = {}){
      let current = connection();
      if(!current.apiBase || !current.token){
        current = await configureConnection();
        if(!current){
          const error = new Error("Database submission cancelled. Your local draft is unchanged.");
          error.cancelled = true;
          throw error;
        }
      }
      const response = await fetch(`${current.apiBase}${path}`, {
        ...options,
        headers: {
          authorization: `Bearer ${current.token}`,
          "content-type": "application/json",
          ...(options.headers || {})
        }
      });
      let result = {};
      try{ result = await response.json(); }catch(_error){}
      if(!response.ok){
        const error = new Error(result.error || `Database request failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      return result;
    },
    submit(path, payload){
      return this.request(path, {method: "POST", body: JSON.stringify(payload)});
    },
    dashboard(externalId){
      return this.request(`/v1/learners/${encodeURIComponent(externalId)}/dashboard`);
    }
  };

  window.AlphaMath = AlphaMath;
  document.addEventListener("DOMContentLoaded",() => AlphaMath.initMathFields());
})();
