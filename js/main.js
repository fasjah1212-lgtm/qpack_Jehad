/* ==========================================================================
   QPACK — scroll storytelling engine
   One rAF loop, progress is smoothed (heavy inertia, no bounce) and only
   scenes that are on screen are updated.
   ========================================================================== */
(function () {
  "use strict";

  const C = window.QPACK;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // heavy in-out
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const root = document.documentElement;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mqMobile = matchMedia("(max-width: 900px)");
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let vw = innerWidth, vh = innerHeight;

  if (RM) document.body.classList.add("rm");
  if (!C.SHOW_DRAFT_BADGES) document.body.classList.add("no-badges");
  if (!(window.CSS && CSS.supports("transform-style", "preserve-3d"))) root.classList.add("no3d");

  const badge = (item) => (item.draft ? ' <span class="badge" title="مسودة — بانتظار التأكيد من المحتوى الرسمي">DRAFT</span>' : "");

  /* ------------------------------------------------------------------
     Scroll scrubbers
     ------------------------------------------------------------------ */
  const scrubbers = [];
  function scrub(el, update, opts = {}) {
    const s = { el, update, cur: 0, target: 0, active: false, k: opts.k || 0.085, range: opts.range || "pin", enabled: opts.enabled || (() => true) };
    scrubbers.push(s);
    new IntersectionObserver((es) => es.forEach((e) => (s.active = e.isIntersecting)), { rootMargin: "20% 0px" }).observe(el);
    return s;
  }
  function measure(s) {
    const r = s.el.getBoundingClientRect();
    if (s.range === "pin") return clamp(-r.top / Math.max(1, r.height - vh));
    // "pass": 0 when element top hits viewport bottom → 1 when its top hits viewport top
    return clamp((vh - r.top) / vh);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;
    const k = (base) => 1 - Math.pow(1 - base, dt / 16.7);
    for (const s of scrubbers) {
      if (!s.active || !s.enabled()) continue;
      s.target = measure(s);
      const d = s.target - s.cur;
      s.cur = RM || Math.abs(d) < 0.0004 ? s.target : s.cur + d * k(s.k);
      if (s.cur !== s.last) { s.update(s.cur); s.last = s.cur; }
    }
    headerProgress();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     Header
     ------------------------------------------------------------------ */
  const hdr = $(".hdr");
  const burger = $(".hdr__burger");
  burger.addEventListener("click", () => {
    const open = hdr.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
  });
  $$(".hdr__nav a").forEach((a) => a.addEventListener("click", () => { hdr.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }));
  let lastSp = -1;
  function headerProgress() {
    const sp = clamp(scrollY / Math.max(1, document.body.scrollHeight - vh));
    if (Math.abs(sp - lastSp) > 0.0005) { hdr.style.setProperty("--sp", sp.toFixed(4)); lastSp = sp; }
  }
  const navMap = new Map($$(".hdr__nav a").map((a) => [a.getAttribute("href").slice(1), a]));
  const navIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    navMap.forEach((a) => a.classList.remove("is-on"));
    const a = navMap.get(e.target.id);
    if (a) a.classList.add("is-on");
  }), { rootMargin: "-45% 0px -50% 0px" });
  ["about", "products", "sectors", "quality", "story", "contact"].forEach((id) => navIO.observe(document.getElementById(id)));

  /* ------------------------------------------------------------------
     Reveal: section flaps + printed headings
     ------------------------------------------------------------------ */
  // observe the container: a clipped .print-in never reports as intersecting
  const revealIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-in");
    $$(".print-in", e.target).forEach((h) => h.classList.add("is-printed"));
    revealIO.unobserve(e.target);
  }), { threshold: 0.35 });
  new Set($$(".print-in").map((h) => h.parentElement).concat($$(".sec-tab"))).forEach((n) => revealIO.observe(n));

  /* ------------------------------------------------------------------
     Content injection (single source: js/content.js)
     ------------------------------------------------------------------ */
  $("[data-company='intro']").textContent = C.company.intro;

  // vision / mission / values
  $$(".vmv__card").forEach((card) => {
    const d = C[card.dataset.k];
    $("h3", card).textContent = d.title;
    $("p", card).textContent = d.text;
  });

  // careers
  $(".careers__t").textContent = C.careers.text;
  const cc = $("#careersCta");
  cc.href = "mailto:" + C.careers.email;
  $("span", cc).textContent = C.careers.cta + " — " + C.careers.email;

  // news
  $(".news__list").innerHTML = C.news.map((n) =>
    `<article class="nitem surface"><span class="mono">${esc(n.source)}</span><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></article>`).join("");

  // contact
  const ct = C.contact;
  const cMain = $("#cMain"); cMain.href = "tel:" + ct.main.tel; cMain.textContent = ct.main.display;
  const cMail = $("#cMail"); cMail.href = "mailto:" + ct.email; cMail.textContent = ct.email;
  $("#cAddr").textContent = ct.address;
  $("#cLines").innerHTML = ct.lines.map((l) => `<li><span>${esc(l.label)}</span><a href="tel:${l.tel}">${esc(l.display)}</a></li>`).join("");

  // footer
  $("#fSocial").innerHTML = C.social.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)} <span class="mono">${esc(s.handle)}</span></a>`).join("");
  $("#fContact").innerHTML =
    `<span>${esc(ct.address)}</span><a href="tel:${ct.main.tel}">${esc(ct.main.display)}</a><a href="mailto:${ct.email}">${esc(ct.email)}</a>`;
  $("#year").textContent = new Date().getFullYear();

  // map (lazy)
  const mapEl = $("[data-map]");
  new IntersectionObserver((es, io) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    const f = document.createElement("iframe");
    f.title = "موقع المصنع على الخريطة";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.src = "https://maps.google.com/maps?q=" + encodeURIComponent(ct.mapQuery) + "&z=13&output=embed";
    mapEl.appendChild(f);
  }, { rootMargin: "600px" }).observe(mapEl);

  /* ------------------------------------------------------------------
     01–05  HERO JOURNEY — flat sheet → finished box
     ------------------------------------------------------------------ */
  const HB = { w: 260, h: 200, d: 170 };
  const hero = QBox.create($("#heroScene"), Object.assign({ plies: true, print: "one" }, HB));
  const heroText = $(".journey__hero");
  const stages = $$(".stage");
  const railItems = $$(".rail span");
  const mCut = $(".machine--cut"), mPrint = $(".machine--print");
  const coords = $$(".journey__coords span");
  let HL = {};
  function heroLayout() {
    const mob = mqMobile.matches;
    const netW = 2 * HB.w + 2 * HB.d + 26;
    HL = {
      mob,
      flatS: mob ? Math.min((vw * 0.94) / netW, 0.62) : Math.min((vw * 0.44) / netW, 0.9),
      boxS: mob ? Math.min((vw * 0.62) / (HB.w + HB.d * 0.8), 1) : clamp((vh * 0.5) / 300, 0.8, 1.45),
      tx: mob ? 0 : -vw * 0.19,
      ty: mob ? vh * 0.1 : vh * 0.02,
      netW,
    };
  }
  heroLayout();
  let heroStage = -1;
  function heroUpdate(p) {
    const out = seg(p, 0.02, 0.1);
    heroText.style.opacity = 1 - out;
    heroText.style.transform = HL.mob ? `translateY(${-30 * out}px)` : `translateY(calc(-46% - ${40 * out}px))`;
    heroText.style.visibility = out >= 1 ? "hidden" : "visible";

    const fold = seg(p, 0.58, 0.84);
    const ef = ease(fold);
    const lay = seg(p, 0.1, 0.32);
    const final = ease(seg(p, 0.84, 1));

    let rx = lerp(62, 46, ease(seg(p, 0, 0.56)));
    rx = lerp(rx, -20, ease(seg(p, 0.56, 0.8)));
    let ry = lerp(0, -6, seg(p, 0, 0.56));
    ry = lerp(ry, -34, ease(seg(p, 0.58, 0.82)));
    ry = lerp(ry, 26, final);

    hero.fold(fold);
    hero.set({
      rx, ry, rz: lerp(-3, 0, ef),
      s: lerp(HL.flatS, HL.boxS, ef),
      tx: HL.tx, ty: lerp(HL.ty, HL.mob ? -vh * 0.02 : 0, ef),
      sep: Math.sin(Math.PI * lay),
      plyo: 1 - seg(p, 0.38, 0.46),
      waste: ease(seg(p, 0.38, 0.47)),
      lines: Math.min(seg(p, 0.3, 0.4), 1 - 0.8 * seg(p, 0.64, 0.8)),
      print: ease(seg(p, 0.46, 0.58)),
      shadow: ease(seg(p, 0.76, 0.88)),
    });

    // machine heads sweep across the sheet (screen-space approximation)
    const cx = vw / 2 + HL.tx, half = (HL.netW / 2) * HL.flatS;
    const cutT = seg(p, 0.3, 0.42), prT = seg(p, 0.46, 0.58);
    mCut.style.opacity = Math.sin(Math.PI * cutT);
    mCut.style.transform = `translateX(${cx + half - cutT * 2 * half}px)`;
    mPrint.style.opacity = Math.sin(Math.PI * prT);
    mPrint.style.transform = `translateX(${cx + half - prT * 2 * half}px)`;

    const st = p < 0.1 ? 0 : p < 0.3 ? 1 : p < 0.46 ? 2 : p < 0.58 ? 3 : p < 0.84 ? 4 : 5;
    if (st !== heroStage) {
      heroStage = st;
      stages.forEach((s, i) => s.classList.toggle("is-on", i + 1 === st));
      railItems.forEach((r, i) => r.classList.toggle("is-on", i + 1 <= st));
      $("#journey").classList.toggle("is-building", st > 0);
    }
    if (coords.length) {
      coords[0].textContent = "X " + (fold * 90).toFixed(1).padStart(5, "0") + "°";
      coords[1].textContent = "Y " + (p * 100).toFixed(1).padStart(5, "0") + "%";
    }
  }
  heroUpdate(0);
  requestAnimationFrame(() => $(".journey__hero h1").classList.add("is-printed"));
  if (RM) heroUpdate(1);
  else scrub($("#journey"), heroUpdate, { k: 0.075 });

  /* ------------------------------------------------------------------
     06  ABOUT — board splits into five plies, each tells a part
     ------------------------------------------------------------------ */
  const stackRig = document.createElement("div");
  stackRig.className = "stack__rig";
  const n = C.layers.length;
  // plates[k] ↔ layer k; the first story sits on top of the stack
  const plates = C.layers.map((L, k) => {
    const pl = document.createElement("div");
    pl.className = "plate";
    pl.style.setProperty("--i", n - 1 - k);
    pl.innerHTML = `<div class="plate__top"><b>${esc(L.mark)}</b><span>${esc(L.title)}</span></div><div class="plate__edge"></div><div class="plate__side"></div>`;
    return pl;
  });
  plates.slice().reverse().forEach((p) => stackRig.appendChild(p)); // bottom → top in DOM
  $(".stack").appendChild(stackRig);
  $(".layers").innerHTML = C.layers.map((L, k) => `
    <article class="layer" role="listitem">
      <div class="layer__h"><span class="mono">0${k + 1} / ${esc(L.en)}</span><h3>${esc(L.title)}</h3></div>
      <p>${esc(L.text)}</p>
      <div class="layer__idx">${C.layers.map((_, j) => `<i class="${j === k ? "is-on" : ""}"></i>`).join("")}</div>
    </article>`).join("");
  const layerEls = $$(".layer");
  let aboutIdx = -1;
  function aboutUpdate(p) {
    const sep = ease(seg(p, 0.02, 0.2));
    stackRig.style.setProperty("--sep", sep.toFixed(4));
    const idx = Math.min(n - 1, Math.floor(seg(p, 0.12, 0.98) * n));
    if (idx !== aboutIdx) {
      aboutIdx = idx;
      plates.forEach((pl, k) => { pl.classList.toggle("is-on", k === idx); pl.style.setProperty("--lift", k === idx ? 1 : 0); });
      layerEls.forEach((l, k) => l.classList.toggle("is-on", k === idx));
    }
  }
  const aboutStatic = () => { stackRig.style.setProperty("--sep", 1); plates.forEach((pl) => pl.classList.remove("is-on")); layerEls.forEach((l) => l.classList.add("is-on")); aboutIdx = -1; };
  if (RM) aboutStatic();
  else {
    aboutUpdate(0);
    scrub($(".about__pin"), aboutUpdate, { enabled: () => !mqMobile.matches });
  }

  // page-as-flap
  const flap = $(".flapfold");
  if (!RM) scrub(flap, (p) => flap.style.setProperty("--p", ease(seg(p, 0.1, 0.85)).toFixed(4)), { range: "pass", k: 0.1 });

  /* ------------------------------------------------------------------
     07  PRODUCTS — the box opens, then becomes each product
     ------------------------------------------------------------------ */
  const explorer = $(".explorer");
  const stageEl = $(".explorer__stage");
  const pState = { type: C.products[0].id, size: "m", sector: C.sectors[C.sectors.length - 1].id, print: "full" };
  const pbox = QBox.create($("#productScene"), Object.assign({ print: "full", sector: pState.sector }, C.products[0].dims));
  pbox.root.classList.add("qbox--tween");
  const pose = { rx: -20, ry: -34 };
  let lidOpen = 0;

  function chips(mount, list, key, label, onPick, cursor) {
    mount.innerHTML = list.map((it, k) =>
      `<button type="button" class="chip" style="--k:${k}" data-v="${it.id}" aria-pressed="false"${cursor ? ` data-cursor="${cursor}"` : ""}>${esc(label(it))}${badge(it)}</button>`).join("");
    mount.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      onPick(b.dataset.v);
    });
    return () => $$(".chip", mount).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === key()));
  }
  const syncType = chips($("#pickType"), C.products, () => pState.type, (p) => p.name, (v) => { pState.type = v; renderProduct(true); }, "Explore");
  const syncSize = chips($("#pickSize"), C.sizes, () => pState.size, (s) => s.label, (v) => { pState.size = v; renderProduct(); }, "Explore");
  const syncSector = chips($("#pickSector"), C.sectors, () => pState.sector, (s) => s.name, (v) => { pState.sector = v; renderProduct(); }, "Explore");
  const syncPrint = chips($("#pickPrint"), C.prints, () => pState.print, (s) => s.label, (v) => { pState.print = v; renderProduct(); }, "Explore");

  function fitScale(dims, w, h, fill) {
    return Math.min((w * fill) / (dims.w * 0.85 + dims.d * 0.75), (h * fill) / (dims.h + dims.d * 0.55));
  }
  function productPose() {
    const r = stageEl.getBoundingClientRect();
    const prod = C.products.find((p) => p.id === pState.type);
    const k = C.sizes.find((s) => s.id === pState.size).k;
    const d = { w: prod.dims.w * k, h: prod.dims.h * k, d: prod.dims.d * k };
    // size change must stay visible → fit to the *medium* size, then apply k
    const base = fitScale(prod.dims, r.width, r.height, 0.62);
    pbox.set({ s: base * lerp(1, k, 0.55), rx: pose.rx, ry: pose.ry, ty: r.height * 0.04 });
    return d;
  }
  const spec = $(".spec");
  function renderProduct(swap) {
    const prod = C.products.find((p) => p.id === pState.type);
    const d = productPose();
    pbox.setDims(d).setFeatures(prod.features).setPrint(pState.print).setSector(pState.print === "none" ? "none" : pState.sector);
    pbox.fold(1, lidOpen);
    const mm = (v) => Math.round(v * 1.6);
    $(".dims__w").textContent = `L ${mm(d.w)} MM`;
    $(".dims__h").textContent = `H ${mm(d.h)} MM`;
    $(".dims__d").textContent = `W ${mm(d.d)} MM`;
    const fill = () => {
      $(".spec__en").textContent = prod.en;
      $(".spec__name").innerHTML = esc(prod.name) + badge(prod);
      $(".spec__use").textContent = prod.use;
      const printL = C.prints.find((x) => x.id === pState.print);
      const sec = C.sectors.find((x) => x.id === pState.sector);
      $(".spec__list").innerHTML = prod.specs.concat([`الطباعة: ${printL.label} — ${printL.note}`, `القطاع: ${sec.name}`]).map((s) => `<li>${esc(s)}</li>`).join("");
    };
    if (swap && !RM) { spec.classList.add("is-swap"); setTimeout(() => { fill(); spec.classList.remove("is-swap"); }, 260); }
    else fill();
    [syncType, syncSize, syncSector, syncPrint].forEach((f) => f());
  }
  renderProduct();
  $("#specCta").addEventListener("click", () => wizard.preset(pState.type, pState.print));

  // the reveal: lid opens, categories rise out of the box, lid closes
  new IntersectionObserver((es, io) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    lidOpen = 1; pbox.fold(1, 1);
    explorer.classList.add("is-open");
    setTimeout(() => { lidOpen = 0; pbox.fold(1, 0); }, RM ? 0 : 2600);
  }, { threshold: 0.3 }).observe(stageEl);
  if (RM) explorer.classList.add("is-open");

  // drag to rotate
  let drag = null;
  stageEl.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, rx: pose.rx, ry: pose.ry, id: e.pointerId };
    pbox.root.classList.add("qbox--drag");
  });
  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (e.pointerType !== "mouse" && Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 8) return; // let touch scroll
    pose.ry = drag.ry + dx * 0.4;
    pose.rx = clamp(drag.rx - dy * 0.25, -60, 15);
    pbox.set({ rx: pose.rx, ry: pose.ry });
  });
  const endDrag = () => { if (drag) { drag = null; pbox.root.classList.remove("qbox--drag"); } };
  addEventListener("pointerup", endDrag);
  addEventListener("pointercancel", endDrag);

  /* ------------------------------------------------------------------
     08  SECTORS — same finished box, the world around it changes
     ------------------------------------------------------------------ */
  const scenesEl = $(".sectors__scenes");
  const iconInner = (s) => (QBox.ICONS[s] || "").replace(/^<svg[^>]*>|<\/svg>$/g, "");
  const PATTERN_COLOR = { food: "#8C6A45", beverage: "#123E6B", industry: "#24272B" };
  scenesEl.innerHTML = C.sectors.map((s, i) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'><g transform='translate(51 51)' fill='none' stroke='${PATTERN_COLOR[s.scene]}' stroke-opacity='.35' stroke-width='1.4' stroke-linejoin='round' stroke-linecap='round'>${iconInner(s.scene)}</g></svg>`;
    return `<div class="sscene sscene--${s.scene}${i === 0 ? " is-on" : ""}">
      <div class="sscene__pattern" style="background-image:url(&quot;data:image/svg+xml,${encodeURIComponent(svg)}&quot;)"></div>
      <div class="sscene__word">${esc(s.en.toUpperCase())}</div></div>`;
  }).join("");
  $(".sectors__list").innerHTML = C.sectors.map((s, i) => `<li><span class="mono">0${i + 1}</span>${esc(s.name)}${badge(s)}</li>`).join("");
  const sScenes = $$(".sscene"), sItems = $$(".sectors__list li");
  const sbox = QBox.create($("#sectorScene"), { w: 240, h: 190, d: 160, print: "full", sector: C.sectors[0].scene });
  let sIdx = -1;
  function sectorUpdate(p) {
    const idx = Math.min(C.sectors.length - 1, Math.floor(seg(p, 0.05, 0.95) * C.sectors.length));
    if (idx !== sIdx) {
      sIdx = idx;
      sScenes.forEach((s, i) => { s.classList.toggle("is-on", i === idx); s.classList.toggle("is-past", i < idx); });
      sItems.forEach((s, i) => s.classList.toggle("is-on", i === idx));
      sbox.setSector(C.sectors[idx].scene);
    }
    const mob = mqMobile.matches;
    sbox.set({
      s: mob ? Math.min(vw / 520, 0.95) : clamp(vh / 620, 0.8, 1.5),
      rx: -18 + Math.sin(p * Math.PI) * -6,
      ry: lerp(-60, 30, p),
      tx: mob ? 0 : -vw * 0.1,
      ty: mob ? -vh * 0.04 : vh * 0.02,
    });
  }
  sectorUpdate(0);
  if (RM) sectorUpdate(0.5); else scrub($(".sectors"), sectorUpdate, { k: 0.07 });

  // cutter blade
  const cutter = $(".cutter");
  if (!RM) scrub(cutter, (p) => cutter.style.setProperty("--p", ease(seg(p, 0.05, 0.95)).toFixed(4)), { k: 0.1 });

  /* ------------------------------------------------------------------
     09  QUALITY — close-up, zoom into the flute, inspection pins
     ------------------------------------------------------------------ */
  const NS = "http://www.w3.org/2000/svg";
  const board = $(".inspect__board");
  (function drawBoard() {
    let d = "M0 " + 270;
    for (let x = 0; x <= 1000; x += 4) d += ` L${x} ${(270 - 57 * Math.cos((2 * Math.PI * x) / 80)).toFixed(1)}`;
    board.innerHTML = `
      <rect x="0" y="202" width="1000" height="11" fill="#C9A477"/>
      <rect x="0" y="327" width="1000" height="11" fill="#C9A477"/>
      <path d="${d}" fill="none" stroke="#B89063" stroke-width="5"/>
      <path d="M0 207.5H1000M0 332.5H1000" stroke="#8a6639" stroke-width=".6" stroke-dasharray="2 5"/>
      <g class="inspect__measure" style="--len:0">
        <path d="M912 202V338M904 202H920M904 338H920" pathLength="1"/>
        <text x="924" y="274" font-size="6">t</text>
        <path d="M460 356H540M460 350V362M540 350V362" pathLength="1"/>
        <text x="468" y="372" font-size="6">λ FLUTE PITCH</text>
        <path d="M88 213V327M80 213H96M80 327H96" pathLength="1"/>
        <text x="60" y="274" font-size="6">h</text>
        <circle cx="500" cy="270" r="30" pathLength="1" fill="none"/>
      </g>
      <text x="16" y="194" font-size="7" fill="#9FB4C8" font-family="IBM Plex Mono">LINER</text>
      <text x="16" y="352" font-size="7" fill="#9FB4C8" font-family="IBM Plex Mono">LINER</text>
      <text x="16" y="274" font-size="7" fill="#9FB4C8" font-family="IBM Plex Mono">FLUTE</text>`;
  })();
  const measureG = $(".inspect__measure", board);
  $$("path, circle", measureG).forEach((p) => { p.style.strokeDasharray = "1"; p.style.strokeDashoffset = "1"; p.style.strokeWidth = ".6"; });
  $$("text", measureG).forEach((t) => (t.style.fontSize = "7px"));
  const PIN_POS = [
    { x: 18, y: 18, s: "r" }, { x: 76, y: 16, s: "l" }, { x: 14, y: 50, s: "r" },
    { x: 82, y: 48, s: "l" }, { x: 20, y: 76, s: "r" }, { x: 74, y: 78, s: "l" },
  ];
  $(".inspect__pins").innerHTML = C.quality.points.map((q, i) => {
    const P = PIN_POS[i % PIN_POS.length];
    return `<div class="pin pin--${P.s}" style="left:${P.x}%;top:${P.y}%;--len:56px"><i class="pin__dot"></i><i class="pin__lead"></i>
      <div class="pin__card"><span class="mono">${esc(q.label)}</span><b>${esc(q.title)}</b><p>${esc(q.text)}</p></div></div>`;
  }).join("");
  const qlist = document.createElement("ul");
  qlist.className = "qlist";
  qlist.innerHTML = C.quality.points.map((q) => `<li><span class="mono">${esc(q.label)}</span>${esc(q.title)}</li>`).join("");
  $(".quality__foot").before(qlist);
  const pins = $$(".pin");
  const inspectSvg = $(".inspect__svg");
  const fitInspect = () => inspectSvg.setAttribute("preserveAspectRatio", mqMobile.matches ? "xMidYMid slice" : "xMidYMid meet");
  fitInspect();
  mqMobile.addEventListener("change", fitInspect);
  function qualityUpdate(p) {
    const z = ease(seg(p, 0, 0.35));
    board.setAttribute("transform", `translate(500 270) scale(${lerp(1, 2.3, z)}) translate(-500 -270)`);
    const m = seg(p, 0.3, 0.5);
    $$("path, circle", measureG).forEach((el) => (el.style.strokeDashoffset = 1 - m));
    measureG.style.opacity = m > 0 ? 1 : 0;
    pins.forEach((pin, i) => pin.classList.toggle("is-on", p > 0.4 + i * 0.085));
  }
  if (RM) qualityUpdate(1); else { qualityUpdate(0); scrub($(".quality"), qualityUpdate, { k: 0.08 }); }

  /* ------------------------------------------------------------------
     10  STORY — paper roll unrolls with the official milestones
     ------------------------------------------------------------------ */
  $(".roll__track").innerHTML = C.timeline.map((t) =>
    `<article class="tl"><span class="tl__mark">${esc(t.mark)}</span><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p><span class="mono">SOURCE: ${esc(t.source)}</span></article>`).join("");
  const roll = $(".roll");
  if (!RM) scrub(roll, (p) => roll.style.setProperty("--p", ease(seg(p, 0.04, 0.8)).toFixed(4)), { enabled: () => !mqMobile.matches, k: 0.08 });
  else roll.style.setProperty("--p", 1);

  /* ------------------------------------------------------------------
     11  QUOTE WIZARD — the journey continues into an order
     ------------------------------------------------------------------ */
  const QTY = ["أقل من 1,000", "1,000 – 5,000", "5,000 – 20,000", "20,000 – 50,000", "50,000 – 100,000", "أكثر من 100,000"];
  const form = $(".wizard__form");
  const steps = $$(".wstep", form);
  const stepLabels = $$(".wizard__steps li");
  const btnPrev = $("[data-w='prev']", form), btnNext = $("[data-w='next']", form), btnSend = $(".btn--send", form);
  const msg = $(".wizard__msg");
  const W = { step: 0, type: null, print: null };
  const mbox = QBox.create($("#mockScene"), { w: 200, h: 160, d: 140, print: "none" });
  mbox.root.classList.add("qbox--tween");
  mbox.set({ rx: -20, ry: -36, s: 0.8 });

  const syncWType = chips($("#wType"), C.products, () => W.type, (p) => p.name, (v) => { W.type = v; updateMock(); });
  const syncWPrint = chips($("#wPrint"), C.prints, () => W.print, (p) => p.label + " — " + p.note, (v) => { W.print = v; updateMock(); });
  const qtyIn = form.elements.qty, qtyOut = $(".qty__out");
  qtyIn.addEventListener("input", () => updateMock());
  ["L", "W", "H"].forEach((k) => form.elements[k].addEventListener("input", () => updateMock()));

  function dimsMM() {
    const v = (k) => parseFloat(form.elements[k].value);
    return { L: v("L"), W: v("W"), H: v("H") };
  }
  function updateMock() {
    syncWType(); syncWPrint();
    qtyOut.textContent = QTY[qtyIn.value] + " وحدة";
    const prod = C.products.find((p) => p.id === W.type);
    const mm = dimsMM();
    const ok = mm.L > 0 && mm.W > 0 && mm.H > 0;
    let d = prod ? { ...prod.dims } : { w: 200, h: 160, d: 140 };
    if (ok) { const k = 220 / Math.max(mm.L, mm.W, mm.H); d = { w: mm.L * k, h: mm.H * k, d: mm.W * k }; }
    mbox.setDims(d).setFeatures(prod ? prod.features : []).setPrint(W.print || "none").setSector("none");
    const r = $("#mockScene").getBoundingClientRect();
    mbox.set({ s: fitScale(d, r.width || 300, r.height || 300, 0.42) });

    const rows = [
      ["TYPE", prod ? prod.name : "—"],
      ["SIZE", ok ? `${mm.L} × ${mm.W} × ${mm.H} مم` : "—"],
      ["QTY", QTY[qtyIn.value]],
      ["PRINT", W.print ? C.prints.find((p) => p.id === W.print).label : "—"],
    ];
    $(".mock__sum").innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join("");
  }
  function validate(i) {
    if (i === 0 && !W.type) return "اختر نوع الصندوق للمتابعة.";
    if (i === 1) {
      let bad = "";
      ["L", "W", "H"].forEach((k) => {
        const el = form.elements[k];
        const v = parseFloat(el.value);
        const ok = v >= +el.min && v <= +el.max;
        el.classList.toggle("is-bad", !ok);
        if (!ok) bad = "أدخل المقاسات بالمليمتر ضمن النطاق المسموح.";
      });
      return bad;
    }
    if (i === 3 && !W.print) return "اختر نوع الطباعة.";
    if (i === 4) {
      const nm = form.elements.name, ph = form.elements.phone;
      nm.classList.toggle("is-bad", !nm.value.trim());
      ph.classList.toggle("is-bad", !/^[+\d\s()-]{8,}$/.test(ph.value.trim()));
      if (!nm.value.trim() || !/^[+\d\s()-]{8,}$/.test(ph.value.trim())) return "الاسم ورقم الجوال مطلوبان.";
    }
    return "";
  }
  function go(i) {
    W.step = clamp(i, 0, steps.length - 1);
    steps.forEach((s, k) => s.classList.toggle("is-on", k === W.step));
    stepLabels.forEach((s, k) => { s.classList.toggle("is-on", k === W.step); s.classList.toggle("is-done", k < W.step); });
    btnPrev.style.visibility = W.step === 0 ? "hidden" : "visible";
    btnNext.hidden = W.step === steps.length - 1;
    btnSend.hidden = W.step !== steps.length - 1;
    msg.textContent = "";
    // the mock re-folds a little at each step — the sheet becomes the box
    mbox.fold(W.step === 0 ? 0.35 : lerp(0.55, 1, W.step / 4), 0);
  }
  btnNext.addEventListener("click", () => {
    const err = validate(W.step);
    if (err) { msg.textContent = err; return; }
    go(W.step + 1);
    const f = $("input, button.chip", steps[W.step]);
    if (f && FINE) f.focus({ preventScroll: true });
  });
  btnPrev.addEventListener("click", () => go(W.step - 1));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = validate(4);
    if (err) { msg.textContent = err; return; }
    const prod = C.products.find((p) => p.id === W.type);
    const mm = dimsMM();
    const el = form.elements;
    const body = [
      "طلب عرض سعر — عبر الموقع",
      "",
      "نوع الصندوق: " + prod.name,
      "المقاسات (مم): " + `${mm.L} × ${mm.W} × ${mm.H}`,
      "الكمية: " + QTY[el.qty.value],
      "الطباعة: " + C.prints.find((p) => p.id === W.print).label,
      "",
      "الاسم: " + el.name.value,
      "الشركة: " + el.company.value,
      "الجوال: " + el.phone.value,
      "البريد: " + el.email.value,
      "ملاحظات: " + el.notes.value,
    ].join("\n");
    mbox.fold(1, 0);
    location.href = `mailto:${C.contact.email}?subject=${encodeURIComponent("طلب عرض سعر — " + el.name.value)}&body=${encodeURIComponent(body)}`;
    msg.textContent = "تم تجهيز طلبك في تطبيق البريد — اضغط إرسال لإتمامه، أو تواصل معنا على " + C.contact.main.display + ".";
  });
  const wizard = {
    preset(type, print) {
      W.type = type; W.print = print;
      updateMock();
      go(W.type ? 1 : 0);
    },
  };
  updateMock();
  go(0);

  /* ------------------------------------------------------------------
     12  FINALE — the finished box closes and steps aside
     ------------------------------------------------------------------ */
  const fbox = QBox.create($("#finaleScene"), { w: 260, h: 200, d: 170, print: "full", sector: "none" });
  const fCopy = $(".finale__copy");
  function finaleUpdate(p) {
    const mob = mqMobile.matches;
    const close = ease(seg(p, 0, 0.35));
    const side = ease(seg(p, 0.3, 0.7));
    fbox.fold(lerp(0.72, 1, close), lerp(1, 0, close));
    fbox.set({
      s: mob ? Math.min(vw / 560, 0.9) : clamp(vh / 560, 0.9, 1.6),
      rx: -20, ry: lerp(-60, -30, close) + side * 8,
      tx: mob ? 0 : lerp(0, -vw * 0.24, side),
      ty: mob ? lerp(0, -vh * 0.14, side) : 0,
    });
    fCopy.style.setProperty("--copy", seg(p, 0.45, 0.75).toFixed(3));
    fCopy.style.transform = mob ? `translateY(${(1 - seg(p, 0.45, 0.75)) * 30}px)` : `translateY(calc(-50% + ${(1 - seg(p, 0.45, 0.75)) * 30}px))`;
  }
  if (RM) finaleUpdate(1); else { finaleUpdate(0); scrub($(".finale__pin"), finaleUpdate, { k: 0.07 }); }

  /* ------------------------------------------------------------------
     Cursor — desktop only
     ------------------------------------------------------------------ */
  if (FINE && !RM) {
    document.body.classList.add("has-cursor");
    const cur = $(".cursor"), dot = $(".cursor__dot"), ring = $(".cursor__ring"), lbl = $(".cursor__label");
    let mx = -100, my = -100, rx = -100, ry = -100, labelNow = "";
    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      const t = e.target.closest ? e.target : null;
      const hit = t && t.closest("[data-cursor]");
      const l = hit ? hit.dataset.cursor : "";
      if (l !== labelNow) { labelNow = l; lbl.textContent = l; cur.classList.toggle("is-label", !!l); }
      cur.classList.toggle("on-dark", !!(t && t.closest(".products, .quality")));
    }, { passive: true });
    document.addEventListener("mouseleave", () => { mx = my = -100; });
    (function loop() {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      lbl.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    })();
    // label sits relative to the ring position
    lbl.style.transition = "opacity .3s";
  }

  /* ------------------------------------------------------------------
     Resize
     ------------------------------------------------------------------ */
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      vw = innerWidth; vh = innerHeight;
      heroLayout();
      renderProduct();
      updateMock();
      scrubbers.forEach((s) => { s.last = -1; if (s.active) s.update(s.cur); });
      if (mqMobile.matches) aboutStatic();
    }, 120);
  });
  if (mqMobile.matches) aboutStatic();

  requestAnimationFrame(frame);
})();
