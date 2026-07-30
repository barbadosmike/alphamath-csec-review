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
    version: "review-1.0.0-20260730",

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

  window.AlphaMath = AlphaMath;
  document.addEventListener("DOMContentLoaded",() => AlphaMath.initMathFields());
})();
