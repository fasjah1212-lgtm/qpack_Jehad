/* ==========================================================================
   QBox — a real, foldable CSS-3D corrugated box (RSC die-line).
   No WebGL, no model files: ~40 DOM nodes, GPU-composited transforms.

   Net (flat sheet), in rig space, left → right:
     [A front W] [B side D] [C back W] [D side D] [glue]
   each panel carries a top + bottom flap.  B hangs off A's right edge,
   C off B, D off C, glue off D — so folding is just nested rotations.

   All geometry lives in CSS custom properties, so a dimension change can
   be tweened by CSS (explorer) or driven every frame by scroll (hero).
   ========================================================================== */
(function () {
  "use strict";

  const ICONS = {
    food: '<svg viewBox="0 0 48 48"><path d="M8 30h32M10 30c0 8 6 12 14 12s14-4 14-12"/><path d="M18 22c0-4 3-4 3-8M26 22c0-4 3-4 3-8"/></svg>',
    beverage: '<svg viewBox="0 0 48 48"><path d="M18 6h6v8l4 6v22H14V20l4-6z"/><path d="M30 14h6v6l3 4v18h-9"/></svg>',
    industry: '<svg viewBox="0 0 48 48"><path d="M6 42V22l10 6v-6l10 6v-6l10 6V8h6v34z"/><path d="M12 36h4M22 36h4M32 36h4"/></svg>',
    none: "",
  };
  const HANDLING =
    '<svg viewBox="0 0 120 40" class="pr-sym"><g fill="none" stroke="currentColor" stroke-width="2.4">' +
    '<path d="M10 34V10M4 16l6-6 6 6M22 34V10M16 16l6-6 6 6"/>' +
    '<path d="M46 20a12 12 0 0 1 24 0zM58 20v12a3 3 0 0 1-6 0"/>' +
    '<path d="M92 8h16l-2 12a6 6 0 0 1-12 0zM100 26v8M94 34h12"/></g></svg>';

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  function faces(printHTML) {
    const f = document.createDocumentFragment();
    f.appendChild(el("div", "face out", printHTML || ""));
    f.appendChild(el("div", "face in"));
    return f;
  }

  function panel(cls, printHTML) {
    const p = el("div", "pnl " + cls);
    p.appendChild(faces(printHTML));
    p.appendChild(el("div", "flap top " + (cls.includes("wide") ? "maj" : "min")));
    p.lastChild.appendChild(faces());
    p.appendChild(el("div", "flap bot " + (cls.includes("wide") ? "maj" : "min")));
    p.lastChild.appendChild(faces());
    return p;
  }

  const logo = '<img class="pr-logo" src="assets/logo.svg" alt="" draggable="false">';

  function create(mount, opts) {
    opts = Object.assign({ w: 240, h: 190, d: 160, plies: false, print: "full", sector: "none", features: [] }, opts || {});

    const root = el("div", "qbox");
    const rig = el("div", "qbox__rig");
    root.appendChild(rig);

    // floor shadow + optional raw-board plies
    rig.appendChild(el("div", "qbox__shadow"));
    if (opts.plies) {
      rig.appendChild(el("div", "ply ply--liner", '<span class="mono">LINER</span>'));
      rig.appendChild(el("div", "ply ply--flute", '<span class="mono">FLUTE</span>'));
      rig.appendChild(el("div", "ply ply--waste"));
    }

    const A = panel("p-a wide",
      '<div class="pr">' + logo +
      '<span class="pr-sector"></span>' +
      '<span class="pr-code mono"></span>' +
      '<span class="pr-band"></span><span class="win"></span></div>');
    const B = panel("p-b narrow", '<div class="pr">' + HANDLING + '<span class="hole"></span></div>');
    const C = panel("p-c wide", '<div class="pr">' + logo + '<span class="pr-band"></span></div>');
    const D = panel("p-d narrow",
      '<div class="pr"><span class="pr-spec mono"></span><span class="pr-rec mono">♻ RECYCLABLE</span><span class="hole"></span></div>');
    const G = el("div", "pnl p-g");
    G.appendChild(faces());

    rig.appendChild(A);
    A.appendChild(B);
    B.appendChild(C);
    C.appendChild(D);
    D.appendChild(G);
    mount.appendChild(root);

    const state = {};
    const box = {
      root,
      dims: { w: opts.w, h: opts.h, d: opts.d },
      /** geometry + pose. Any subset. Angles in deg, fold values 0..1 */
      set(o) {
        for (const k in o) {
          if (state[k] === o[k]) continue;
          state[k] = o[k];
          const unit = /^(rx|ry|rz|aSide|aTmin|aTmaj|aBmin|aBmaj)$/.test(k) ? "deg" : /^(tx|ty)$/.test(k) ? "px" : "";
          root.style.setProperty("--" + k, o[k] + unit);
        }
        return box;
      },
      setDims(d) {
        box.dims = Object.assign({}, box.dims, d);
        box.set({ w: box.dims.w, h: box.dims.h, d: box.dims.d });
        const mm = (v) => Math.round(v * 1.6);
        const txt = `${mm(box.dims.w)} × ${mm(box.dims.d)} × ${mm(box.dims.h)} MM`;
        root.querySelectorAll(".pr-code").forEach((n) => (n.textContent = "QPACK · " + txt));
        root.querySelectorAll(".pr-spec").forEach((n) => (n.innerHTML = "CORRUGATED BOARD<br>" + txt + "<br>THIS SIDE UP ↑"));
        return box;
      },
      setPrint(p) {
        root.dataset.print = p;
        return box;
      },
      setSector(s) {
        root.dataset.sector = s;
        root.querySelectorAll(".pr-sector").forEach((n) => (n.innerHTML = ICONS[s] || ""));
        return box;
      },
      setFeatures(list) {
        ["handles", "window", "open", "lowfront"].forEach((f) => root.classList.toggle("f-" + f, list.includes(f)));
        return box;
      },
      /** fold everything by a single 0..1 amount (convenience) */
      fold(t, lid) {
        const c = (x) => Math.max(0, Math.min(1, x));
        const side = c(t / 0.6);
        const minor = c((t - 0.55) / 0.2);
        const major = c((t - 0.72) / 0.28);
        const open = lid || 0;
        return box.set({
          f: side,
          aSide: side * 90,
          aTmin: minor * 91 - open * 150,
          aTmaj: major * 90 - open * 205,
          aBmin: -minor * 91,
          aBmaj: -major * 90,
        });
      },
    };

    box.set({ g: 26, s: 1, rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, print: 1, lines: 0, sep: 0, plyo: 0, waste: 0, shadow: 1 });
    box.setDims(opts);
    box.setPrint(opts.print);
    box.setSector(opts.sector);
    box.setFeatures(opts.features);
    box.fold(1);
    return box;
  }

  window.QBox = { create, ICONS };
})();
