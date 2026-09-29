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

  // always open at the very top: no restored scroll position, no #section jump
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  const toTop = () => window.scrollTo(0, 0);
  toTop();
  addEventListener("load", toTop);
  addEventListener("pageshow", (e) => { if (e.persisted) toTop(); });

  const root = document.documentElement;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mqMobile = matchMedia("(max-width: 900px)");
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
  ["about", "products", "story", "contact"].forEach((id) => navIO.observe(document.getElementById(id)));

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
  new Set($$(".print-in").map((h) => h.parentElement)).forEach((n) => revealIO.observe(n));

  /* ------------------------------------------------------------------
     Content injection (single source: js/content.js)
     ------------------------------------------------------------------ */
  $("[data-company='intro']").textContent = C.company.intro;

  // vision / mission / values
  $$(".vmv .card").forEach((card) => {
    const d = C[card.dataset.k];
    $(".t-h3", card).textContent = d.title;
    $(".t-body", card).textContent = d.text;
  });

  // careers
  $(".careers__t").textContent = C.careers.text;
  const cc = $("#careersCta");
  cc.href = "mailto:" + C.careers.email;
  $("span", cc).textContent = C.careers.cta + " — " + C.careers.email;

  // news
  $(".news__list").innerHTML = C.news.map((n) =>
    `<article class="nitem card"><p class="label label--brand">خبر</p><h3 class="t-h3">${esc(n.title)}</h3><p class="t-body">${esc(n.text)}</p></article>`).join("");

  // official milestones strip (hero)
  $(".facts").innerHTML = C.timeline.map((t) =>
    `<li class="fact"><b class="fact__mark">${esc(t.mark)}</b><span class="fact__t">${esc(t.title)}</span><span class="fact__d">${esc(t.text)}</span></li>`).join("");

  // contact
  const ct = C.contact;
  const cMain = $("#cMain"); cMain.href = "tel:" + ct.main.tel; cMain.textContent = ct.main.display;
  const cMail = $("#cMail"); cMail.href = "mailto:" + ct.email; cMail.textContent = ct.email;
  $("#cAddr").textContent = ct.address;
  $("#cLines").innerHTML = ct.lines.map((l) => `<li><span>${esc(l.label)}</span><a href="tel:${l.tel}">${esc(l.display)}</a></li>`).join("");

  // footer
  $("#fSocial").innerHTML = C.social.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)} <span>${esc(s.handle)}</span></a>`).join("");
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
  const facts = $(".facts");
  let HL = {};
  function heroLayout() {
    const mob = mqMobile.matches;
    const netW = 2 * HB.w + 2 * HB.d + 26;
    HL = {
      mob,
      flatS: mob ? Math.min((vw * 0.94) / netW, 0.62) : Math.min((vw * 0.44) / netW, 0.9),
      boxS: mob ? Math.min((vw * 0.62) / (HB.w + HB.d * 0.8), 1) : clamp((vh * 0.5) / 300, 0.8, 1.45),
      tx: mob ? 0 : -vw * 0.19,
      ty: mob ? vh * 0.19 : vh * 0.02,
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
    facts.style.opacity = 1 - out;
    facts.style.visibility = out >= 1 ? "hidden" : "visible";

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
  }
  heroUpdate(0);
  requestAnimationFrame(() => $(".journey__hero h1").classList.add("is-printed"));
  if (RM) heroUpdate(1);
  else scrub($("#journey"), heroUpdate, { k: 0.075 });

  /* ------------------------------------------------------------------
     ABOUT — a static stack of five boards; each board is one part of the story.
     Hovering an item highlights its board (no scroll animation).
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
    <article class="layer" role="listitem" tabindex="0">
      <span class="layer__no">0${k + 1}</span>
      <div><h3 class="t-h3">${esc(L.title)}</h3><p class="t-body">${esc(L.text)}</p></div>
    </article>`).join("");
  const layerEls = $$(".layer");
  const highlight = (idx) => {
    plates.forEach((pl, k) => pl.classList.toggle("is-on", k === idx));
    layerEls.forEach((l, k) => l.classList.toggle("is-on", k === idx));
  };
  layerEls.forEach((l, k) => {
    l.addEventListener("mouseenter", () => highlight(k));
    l.addEventListener("focus", () => highlight(k));
  });
  $(".layers").addEventListener("mouseleave", () => highlight(-1));

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

  function chips(mount, list, key, label, onPick) {
    mount.innerHTML = list.map((it, k) =>
      `<button type="button" class="chip" style="--k:${k}" data-v="${it.id}" aria-pressed="false">${esc(label(it))}${badge(it)}</button>`).join("");
    mount.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      onPick(b.dataset.v);
    });
    return () => $$(".chip", mount).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === key()));
  }
  const syncType = chips($("#pickType"), C.products, () => pState.type, (p) => p.name, (v) => { pState.type = v; renderProduct(true); });
  const syncSize = chips($("#pickSize"), C.sizes, () => pState.size, (s) => s.label, (v) => { pState.size = v; renderProduct(); });
  const syncSector = chips($("#pickSector"), C.sectors, () => pState.sector, (s) => s.name, (v) => { pState.sector = v; renderProduct(); });
  const syncPrint = chips($("#pickPrint"), C.prints, () => pState.print, (s) => s.label, (v) => { pState.print = v; renderProduct(); });

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
  // quote request for the configured model → prefilled email
  function quoteHref() {
    const prod = C.products.find((p) => p.id === pState.type);
    const size = C.sizes.find((x) => x.id === pState.size);
    const sec = C.sectors.find((x) => x.id === pState.sector);
    const pr = C.prints.find((x) => x.id === pState.print);
    const body = ["طلب عرض سعر — عبر الموقع", "", "نوع الصندوق: " + prod.name, "الحجم: " + size.label,
      "القطاع: " + sec.name, "الطباعة: " + pr.label, "الكمية المطلوبة: ", "", "الاسم: ", "الشركة: ", "الجوال: "].join("\n");
    return `mailto:${C.contact.email}?subject=${encodeURIComponent("طلب عرض سعر — " + prod.name)}&body=${encodeURIComponent(body)}`;
  }
  $("#specCta").addEventListener("click", (e) => { e.currentTarget.href = quoteHref(); });

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
     Resize
     ------------------------------------------------------------------ */
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      vw = innerWidth; vh = innerHeight;
      heroLayout();
      renderProduct();
      scrubbers.forEach((s) => { s.last = -1; if (s.active) s.update(s.cur); });
    }, 120);
  });

  requestAnimationFrame(frame);
})();
