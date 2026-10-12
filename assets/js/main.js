/* F&B Tea — company profile interactions (vanilla JS) */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header shadow + back-to-top ---------- */
  const header = $('#header');
  const toTop = $('#toTop');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    toTop.classList.toggle('is-visible', y > 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------- Mobile nav ---------- */
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const setNav = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    toggle.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setNav(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setNav(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) setNav(false); });

  /* ---------- Scrollspy ---------- */
  const navLinks = $$('.nav__list a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Reveal on scroll (staggered within each parent) ---------- */
  const reveals = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const groups = new Map();
    reveals.forEach((el) => {
      const list = groups.get(el.parentElement) || [];
      list.push(el);
      groups.set(el.parentElement, list);
    });
    groups.forEach((list) => list.forEach((el, i) => el.style.setProperty('--d', Math.min(i, 6) * 70 + 'ms')));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- Count-up stats ---------- */
  const counters = $$('.count');
  const runCount = (el) => {
    const to = parseInt(el.dataset.to, 10);
    const dur = 1200;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { runCount(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------- Product filter ---------- */
  const filters = $$('.filter');
  const products = $$('#productGrid .product');
  filters.forEach((btn) => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    filters.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    products.forEach((p) => {
      const show = f === 'all' || p.dataset.cat === f;
      p.hidden = !show;
      if (show) p.classList.add('is-in');
    });
  }));

  /* ---------- Prefill contact form from CTAs ---------- */
  const form = $('#contactForm');
  const need = $('#f-need');
  const msg = $('#f-msg');
  const goToForm = () => {
    $('#lien-he').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => $('#f-name').focus({ preventScroll: true }), reduceMotion ? 0 : 600);
  };
  $$('[data-quote]').forEach((btn) => btn.addEventListener('click', () => {
    need.value = 'Mua sỉ trà nguyên liệu';
    msg.value = 'Tôi muốn nhận báo giá sỉ sản phẩm: ' + btn.dataset.quote + '.\nSố lượng dự kiến: ';
    goToForm();
  }));
  $$('[data-need]').forEach((link) => link.addEventListener('click', (e) => {
    e.preventDefault();
    need.value = link.dataset.need;
    goToForm();
  }));

  /* ---------- Form validation → mailto ---------- */
  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Vui lòng nhập họ và tên.'),
    phone: (v) => (/^(\+?84|0)\d{8,10}$/.test(v.replace(/[\s.-]/g, '')) ? '' : 'Số điện thoại chưa đúng định dạng.'),
    email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Email chưa đúng định dạng.'),
  };
  const validate = (input) => {
    const rule = rules[input.name];
    if (!rule) return true;
    const err = rule(input.value);
    const field = input.closest('.field');
    const out = $('#e-' + input.name);
    field.classList.toggle('has-error', !!err);
    input.setAttribute('aria-invalid', err ? 'true' : 'false');
    if (out) { out.textContent = err; input.setAttribute('aria-describedby', out.id); }
    return !err;
  };
  Object.keys(rules).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('blur', () => validate(input));
    input.addEventListener('input', () => { if (input.closest('.field').classList.contains('has-error')) validate(input); });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = Object.keys(rules).map((n) => form.elements[n]);
    const ok = inputs.map(validate).every(Boolean);
    if (!ok) { inputs.find((i) => i.getAttribute('aria-invalid') === 'true').focus(); return; }

    const d = Object.fromEntries(new FormData(form));
    const subject = `[Website] ${d.need} – ${d.name}`;
    const body = [
      `Họ tên: ${d.name}`,
      `Điện thoại: ${d.phone}`,
      `Email: ${d.email || '(không có)'}`,
      `Nhu cầu: ${d.need}`,
      '',
      d.message || '',
    ].join('\n');
    window.location.href = 'mailto:info@tranguyenlieu.vn?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    $('#formSuccess').hidden = false;
  });

  /* ---------- Footer year ---------- */
  $('#year').textContent = new Date().getFullYear();
})();
