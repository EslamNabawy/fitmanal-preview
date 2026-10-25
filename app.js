// FitManal preview — shared behaviour. No payment is processed anywhere in this file.
(function () {
  document.documentElement.classList.remove('no-js');

  // breeze maths (pure, so QA can check it with node): one soft swell every ~14s, followed smoothly
  // breeze-math start
  const TAU_ = Math.PI * 2;
  const BREEZE = {
    target: (t) => { const s = (1 - Math.cos(TAU_ * t / 14)) / 2; const e = s * s * (3 - 2 * s); return 0.45 + 0.5 * e * e; },
    follow: (current, target, dt) => current + (target - current) * Math.min(1, dt * 0.6),
    sway: (t, wind) => 0.061 * Math.sin(TAU_ * t / 7) * (0.6 + 0.8 * (wind - 0.45)), // whole branch, at most ~3.5 deg
    flutter: (t, i, wind) => Math.sin(TAU_ * t / 5 - i * 0.6) * (0.04 + 0.05 * wind) // ripple base to tip, at most ~5 deg
  };
  // breeze-math end

  const store = {
    get(area, key) { try { return window[area].getItem(key); } catch (e) { return null; } },
    set(area, key, value) { try { window[area].setItem(key, value); } catch (e) { /* storage blocked: preview still works */ } }
  };

  // Mobile menu
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    mobileNav.addEventListener('click', (e) => {
      if (e.target.closest('a')) { mobileNav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Content is always visible; .in only triggers small accents (the price strike line) when seen.
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.3 });
    revealEls.forEach((el) => io.observe(el));
    setTimeout(() => revealEls.forEach((el) => el.classList.add('in')), 6000); // never leave an accent undrawn
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  // Rings draw in from empty to their value
  document.querySelectorAll('.ring-fill[data-v]').forEach((el) => {
    if (reduceMotion) { el.style.setProperty('--v', el.dataset.v); return; }
    el.style.setProperty('--v', 0);
    requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty('--v', el.dataset.v)));
  });

  initMotif();

  // Video placeholders: the real video is added from the current site
  document.querySelectorAll('[data-play]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.closest('.video');
      v.classList.add('show-note');
      const note = v.querySelector('.video-note');
      if (note) { note.setAttribute('tabindex', '-1'); note.focus(); }
    });
  });

  initCheckout();
  initThankYou();
  initDashboard();
  initMobileCta();

  // Sticky CTA on phones/tablets: shows once the hero offer card has scrolled away and hides over the
  // other buy sections. Scroll-driven because IntersectionObserver is unreliable in some viewers.
  function initMobileCta() {
    const bar = document.getElementById('mobile-cta');
    const offer = document.querySelector('.offer');
    if (!bar || !offer) return;
    const btn = bar.querySelector('button');
    const covers = [...document.querySelectorAll('.stack, .closing')];
    let shown = false;
    function update() {
      const vh = window.innerHeight;
      const show = window.innerWidth < 960 && offer.getBoundingClientRect().bottom < 0 &&
        !covers.some((el) => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
      if (show === shown) return;
      shown = show;
      bar.classList.toggle('show', show);
      bar.setAttribute('aria-hidden', String(!show));
      btn.tabIndex = show ? 0 : -1;
      document.body.classList.toggle('cta-on', show);
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function initCheckout() {
    const modal = document.getElementById('checkout');
    if (!modal) return;
    const dialog = modal.querySelector('.modal-dialog');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const stepItems = modal.querySelectorAll('.stepper li');
    let lastFocus = null;

    function open(e) {
      if (e) e.preventDefault();
      lastFocus = document.activeElement;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      showStep(1);
      setTimeout(() => document.getElementById('f-name').focus(), 60);
    }
    function close() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      if (lastFocus) lastFocus.focus();
    }
    function showStep(n) {
      step1.hidden = n !== 1;
      step2.hidden = n !== 2;
      const panel = n === 1 ? step1 : step2;
      panel.classList.remove('step-panel');
      void panel.offsetWidth; // restart the entry animation
      panel.classList.add('step-panel');
      stepItems.forEach((li, i) => {
        li.toggleAttribute('aria-current', i === n - 1);
        if (i === n - 1) li.setAttribute('aria-current', 'step');
        li.classList.toggle('done', i < n - 1);
      });
    }

    document.querySelectorAll('[data-checkout]').forEach((b) => b.addEventListener('click', open));
    modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') trapFocus(e);
    });
    function trapFocus(e) {
      const items = [...dialog.querySelectorAll('a[href], button:not([disabled]), input, select')].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    // Validation
    const rules = {
      'f-name': (v) => v.trim().length >= 2 || 'اكتبي اسمك من فضلك',
      'f-email': (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'اكتبي بريد إلكتروني صحيح، مثلاً name@mail.com',
      'f-phone': (v) => v.replace(/\D/g, '').length >= 8 || 'اكتبي رقم واتساب صحيح مع كود الدولة',
      'f-card': (v) => v.replace(/\D/g, '').length >= 12 || 'رقم البطاقة غير مكتمل',
      'f-exp': (v) => /^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/.test(v.trim()) || 'اكتبي التاريخ بالشكل MM/YY',
      'f-cvc': (v) => /^\d{3,4}$/.test(v.trim()) || 'الرمز من 3 أو 4 أرقام'
    };
    function check(id) {
      const input = document.getElementById(id);
      const result = rules[id](input.value);
      const err = document.getElementById(id + '-err');
      const ok = result === true;
      input.setAttribute('aria-invalid', String(!ok));
      err.textContent = ok ? '' : result;
      return ok;
    }
    Object.keys(rules).forEach((id) => {
      const input = document.getElementById(id);
      input.addEventListener('blur', () => { if (input.value) check(id); });
      input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') check(id); });
    });
    function validate(ids) {
      const bad = ids.filter((id) => !check(id));
      if (bad.length) document.getElementById(bad[0]).focus();
      return !bad.length;
    }

    step1.addEventListener('submit', (e) => {
      e.preventDefault();
      if (validate(['f-name', 'f-email', 'f-phone'])) { showStep(2); document.getElementById('step-2-title').focus(); }
    });
    modal.querySelector('[data-back]').addEventListener('click', () => { showStep(1); document.getElementById('f-name').focus(); });

    const cardFields = document.getElementById('card-fields');
    modal.querySelectorAll('input[name="pay"]').forEach((r) => r.addEventListener('change', () => {
      cardFields.hidden = r.value !== 'card' || !r.checked;
    }));

    step2.addEventListener('submit', (e) => {
      e.preventDefault();
      const usingCard = modal.querySelector('input[name="pay"]:checked').value === 'card';
      const okFields = usingCard ? validate(['f-card', 'f-exp', 'f-cvc']) : true;
      const agree = document.getElementById('f-agree');
      const agreeErr = document.getElementById('f-agree-err');
      agreeErr.textContent = agree.checked ? '' : 'لازم توافقي على الشروط عشان نكمّل';
      if (!okFields || !agree.checked) { if (okFields) agree.focus(); return; }
      store.set('sessionStorage', 'fm-name', document.getElementById('f-name').value.trim());
      store.set('sessionStorage', 'fm-email', document.getElementById('f-email').value.trim());
      window.location.href = 'thank-you.html';
    });

    // Currency display. shortcut: only USD-pegged Gulf currencies get a figure; EGP/EUR/GBP float,
    // so they show "calculated at payment" until a real gateway quote is wired in.
    const pegged = { USD: [1, '$'], SAR: [3.75, 'ر.س'], AED: [3.6725, 'د.إ'], QAR: [3.64, 'ر.ق'], BHD: [0.376, 'د.ب'], OMR: [0.3845, 'ر.ع'] };
    const select = document.getElementById('f-currency');
    const local = document.getElementById('local-price');
    select.addEventListener('change', () => {
      const cur = select.value;
      if (cur === 'USD') { local.textContent = ''; return; }
      if (pegged[cur]) {
        const [rate, sym] = pegged[cur];
        local.textContent = 'حوالي ' + (37 * rate).toFixed(cur === 'BHD' || cur === 'OMR' ? 1 : 0) + ' ' + sym + ' بسعر الصرف الثابت';
      } else {
        local.textContent = 'المبلغ بالعملة المحلية بيظهر في صفحة الدفع حسب سعر اليوم';
      }
    });
  }


  // "10 minutes, breathing" art. data-motif="live" animates; "still" draws one finished frame.
  // Layers: breathing glow, rippling breath circles, a 10-segment timer that lights one segment
  // per second, a turning dial, flowing breath-wave ribbons, an olive branch and wind-blown leaves.
  // Under reduced motion a live canvas keeps only the breathing (glow + circles scale), nothing travels.
  function initMotif() {
    document.querySelectorAll('canvas[data-motif]').forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const wantsLive = canvas.dataset.motif === 'live';
      const live = wantsLive && !reduceMotion;
      const breathOnly = wantsLive && reduceMotion;
      const anchorX = parseFloat(canvas.dataset.cx || '0.24');
      // data-tone="light" draws in cream and gold for dark bands
      const light = canvas.dataset.tone === 'light';
      const olive = light ? '247,243,234' : '77,79,44', sage = light ? '201,203,176' : '129,134,94';
      const gold = light ? '242,208,140' : '197,154,69', rose = light ? '229,154,178' : '158,58,88';
      const TAU = Math.PI * 2;
      const ease = (x) => 1 - Math.pow(1 - x, 3);
      const rgba = (c, a) => 'rgba(' + c + ',' + Math.max(0, a).toFixed(3) + ')';
      let w = 0, h = 0, raf = null, onScreen = true, last = 0, prevT = null, small = false;
      let windSmooth = BREEZE.target(0);
      const t0 = performance.now();
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 }; // eased mouse parallax

      // fixed pseudo-random leaves so every load starts the same; positions are in 0..1 until sized
      const seed = (i, k) => { const r = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return r - Math.floor(r); };
      const leaves = Array.from({ length: 12 }, (_, i) => ({
        x: seed(i, 1), y: seed(i, 2), size: 0.7 + seed(i, 3) * 0.7, rot: seed(i, 4) * TAU,
        spin: seed(i, 5) > 0.5 ? 1 : -1, lift: seed(i, 6), phase: seed(i, 7) * TAU, px: false
      }));

      function leafShape(x, y, angle, len, squash, fillA, strokeA) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(1, squash);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.5, -len * 0.4, len, 0);
        ctx.quadraticCurveTo(len * 0.5, len * 0.4, 0, 0);
        ctx.fillStyle = rgba(olive, fillA);
        ctx.strokeStyle = rgba(olive, strokeA);
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath(); // midrib
        ctx.moveTo(len * 0.1, 0);
        ctx.lineTo(len * 0.85, 0);
        ctx.stroke();
        ctx.restore();
      }

      const activeLeaves = () => (small ? leaves.slice(0, 7) : leaves);

      function moveLeaves(t, dt, wind, S) {
        activeLeaves().forEach((lf) => {
          if (!lf.px) { lf.x *= w; lf.y *= h; lf.px = true; }
          // carried right-to-left (the page reads RTL) on a calm breeze, rising and bobbing gently
          lf.x -= (28 + 60 * lf.size) * wind * dt;
          lf.y += (-(8 + 10 * lf.lift) + Math.sin(t * 0.9 + lf.phase) * 14) * dt;
          lf.rot += lf.spin * (0.25 + 0.6 * wind) * dt;
          if (lf.x < -S * 0.08) { lf.x = w + S * 0.08; lf.y = h * (0.1 + 0.8 * seed(lf.phase * 10 + t, 9)); }
          if (lf.y < -S * 0.08) lf.y = h + S * 0.06;
          if (lf.y > h + S * 0.1) lf.y = -S * 0.06;
        });
      }

      function draw(t) {
        // tm drives everything that travels; under reduced motion it stays frozen
        const tm = breathOnly ? 30 : t;
        const dt = prevT === null ? 0 : Math.min(0.1, Math.max(0, tm - prevT));
        prevT = tm;
        ctx.clearRect(0, 0, w, h);
        const e = ease(Math.min(tm / 2, 1));
        const breath = (1 - Math.cos(TAU * t / 8)) / 2; // 4s in, 4s out
        if (live) windSmooth = BREEZE.follow(windSmooth, BREEZE.target(tm), dt);
        const wind = live ? windSmooth : 0.5;
        const S = Math.min(w, h, 760);
        const px = pointer.x, py = pointer.y;
        const cx = w * anchorX + px * 10, cy = Math.min(h * 0.46, S * 0.62) + py * 10;
        const R = Math.min(S * 0.4, w * 0.42);
        ctx.lineCap = 'round';

        // breathing glow
        const glowR = R * (1 + 0.18 * breath);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        g.addColorStop(0, rgba(gold, (0.1 + 0.06 * breath) * e));
        g.addColorStop(0.6, rgba(gold, 0.05 * e));
        g.addColorStop(1, rgba(gold, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, TAU);
        ctx.fill();

        // rippling breath circles: 0.85 -> 1, each ring lagging the one inside it
        for (let i = 0; i < 4; i++) {
          const b = (1 - Math.cos(TAU * (t - i * 0.45) / 8)) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, R * (0.3 + 0.14 * i) * (0.85 + 0.15 * b), 0, TAU);
          ctx.strokeStyle = rgba(sage, (0.24 - i * 0.045) * e);
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }

        // dial: 60 ticks, one lap every 40s
        const spin = (tm / 40) * TAU;
        ctx.strokeStyle = rgba(olive, 0.13 * e);
        ctx.lineWidth = 1;
        for (let k = 0; k < 60; k++) {
          const a = spin + (k / 60) * TAU;
          const r1 = R * 1.12, r2 = R * (k % 5 ? 1.15 : 1.2);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.stroke();
        }

        // 10-segment timer: one segment lights per second, rests 2s, repeats
        const seg = TAU / 10, gap = 0.08;
        const cycle = live ? tm % 12 : 10;
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + k * seg + gap / 2;
          const span = (seg - gap) * e;
          ctx.beginPath();
          ctx.arc(cx, cy, R, a, a + span);
          ctx.strokeStyle = rgba(olive, 0.17 * e);
          ctx.lineWidth = 1.6;
          ctx.stroke();
          const lit = Math.max(0, Math.min(1, cycle - k));
          if (lit > 0 && cycle < 11.4) {
            const fade = cycle > 10 ? 1 - (cycle - 10) / 1.4 : 1;
            ctx.beginPath();
            ctx.arc(cx, cy, R, a, a + span * lit);
            ctx.strokeStyle = rgba(gold, 0.3 * fade * e);
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }

        // breath-wave ribbons: a crest crosses about a quarter of the width every 4s
        const baseY = Math.min(h * 0.72, cy + R * 1.1);
        for (let j = 0; j < 5; j++) {
          const lam = 0.55 + j * 0.12;
          const amp = S * (0.035 + j * 0.01) * (0.7 + 0.3 * breath) * (0.85 + 0.25 * wind);
          const k = TAU / (w * lam);
          const ph = tm * TAU / (16 * lam) + j * 1.3;
          ctx.beginPath();
          for (let x = -20; x <= w + 20; x += 14) {
            const y = baseY + j * S * 0.035 + Math.sin(x * k + ph) * amp + Math.sin(x * k * 2.3 - ph * 0.7) * amp * 0.25 + py * (4 + j * 2);
            if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = rgba(j % 2 ? sage : gold, (0.21 - j * 0.025) * e);
          ctx.lineWidth = j === 0 ? 1.7 : 1.15;
          ctx.stroke();
        }

        // olive branch in the opposite corner: sways as one piece from its base, leaves ripple along it
        const dir = anchorX < 0.5 ? 1 : -1;
        const bx = (anchorX < 0.5 ? w - S * 0.1 : S * 0.1) - px * 14, by = S * 0.04 - py * 10;
        const ex = bx - dir * S * 0.18, ey = by + S * 0.52;
        const qx = bx + dir * S * 0.08, qy = by + S * 0.28;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(live ? dir * BREEZE.sway(tm, wind) : 0);
        ctx.translate(-bx, -by);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(qx, qy, ex, ey);
        ctx.strokeStyle = rgba(olive, 0.2 * e);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        const L = Math.min(Math.max(S * 0.075, 14), 40);
        for (let i = 1; i <= 7; i++) {
          const s = i / 8;
          const x = (1 - s) * (1 - s) * bx + 2 * (1 - s) * s * qx + s * s * ex;
          const y = (1 - s) * (1 - s) * by + 2 * (1 - s) * s * qy + s * s * ey;
          const tx = 2 * (1 - s) * (qx - bx) + 2 * s * (ex - qx), ty = 2 * (1 - s) * (qy - by) + 2 * s * (ey - qy);
          const side = i % 2 ? 1 : -1;
          const flutter = live ? BREEZE.flutter(tm, i, wind) : 0;
          leafShape(x, y, Math.atan2(ty, tx) + side * 0.85 + flutter, L * (1 - s * 0.25), 1, 0.07 * e, 0.22 * e);
        }
        ctx.restore();

        // loose leaves carried by the wind, tumbling (squash = leaf turning edge-on)
        if (live) moveLeaves(tm, dt, wind, S);
        activeLeaves().forEach((lf) => {
          const x = (lf.px ? lf.x : lf.x * w) - px * 18;
          const y = (lf.px ? lf.y : lf.y * h) - py * 18;
          const squash = 0.35 + 0.65 * Math.abs(Math.cos(lf.rot * 0.8));
          leafShape(x, y, lf.rot, S * 0.034 * lf.size, squash, 0.06 * e, 0.2 * e);
        });

        // rose "now" dot riding the timer
        if (live) {
          const a = -Math.PI / 2 + (Math.min(cycle, 10) / 10) * TAU;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 3.5 + breath * 1.5, 0, TAU);
          ctx.fillStyle = rgba(rose, cycle < 10 ? 0.5 : 0.5 * (1 - (cycle - 10) / 1.4));
          ctx.fill();
        }
      }

      function resize() {
        const r = canvas.getBoundingClientRect();
        small = r.width < 600; // phones: lighter canvas, fewer leaves, lower frame rate
        const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
        const firstSize = !w;
        w = r.width; h = r.height;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!firstSize) leaves.forEach((lf) => { if (lf.px) { lf.x = Math.min(lf.x, w); lf.y = Math.min(lf.y, h); } });
        prevT = null;
        draw(live || breathOnly ? (performance.now() - t0) / 1000 : 30);
      }
      function frame(now) {
        raf = requestAnimationFrame(frame);
        if (now - last < (small ? 42 : 33)) return; // ~24fps on phones, ~30fps otherwise
        last = now;
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
        draw((now - t0) / 1000);
      }
      const animates = live || breathOnly;
      function play() { if (animates && !raf && onScreen && !document.hidden) { prevT = null; raf = requestAnimationFrame(frame); } }
      function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else resize();
      if (animates) {
        if (live) {
          const host = canvas.parentElement;
          host.addEventListener('pointermove', (ev) => {
            if (ev.pointerType !== 'mouse') return;
            const r = host.getBoundingClientRect();
            pointer.tx = ((ev.clientX - r.left) / r.width - 0.5) * 2;
            pointer.ty = ((ev.clientY - r.top) / r.height - 0.5) * 2;
          });
          host.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
        }
        new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; onScreen ? play() : stop(); }).observe(canvas);
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));
      }
    });
  }

  function initThankYou() {
    const emailEl = document.querySelector('[data-email]');
    const email = store.get('sessionStorage', 'fm-email');
    const name = store.get('sessionStorage', 'fm-name');
    if (emailEl && email) emailEl.textContent = email;
    if (name) document.querySelectorAll('[data-name]').forEach((el) => { el.textContent = name.split(' ')[0]; });
  }

  function initDashboard() {
    const list = document.getElementById('checkin');
    if (!list) return;
    const boxes = [...list.querySelectorAll('input[type="checkbox"]')];
    const count = document.getElementById('checkin-count');
    const saved = (store.get('localStorage', 'fm-day1') || '').split(',');
    boxes.forEach((b) => { b.checked = saved.includes(b.id); });
    function update() {
      const done = boxes.filter((b) => b.checked);
      count.textContent = done.length + ' من ' + boxes.length;
      list.classList.toggle('all-done', done.length === boxes.length);
      store.set('localStorage', 'fm-day1', done.map((b) => b.id).join(','));
    }
    boxes.forEach((b) => b.addEventListener('change', update));
    update();

    const startBtn = document.getElementById('start-workout');
    if (startBtn) startBtn.addEventListener('click', () => {
      const status = document.getElementById('workout-status');
      status.textContent = 'تمام! التمرين بدأ — في النسخة الحقيقية الفيديو والمؤقت بيشتغلوا هنا.';
      document.getElementById('task-1').checked = true;
      update();
    });
  }
})();
