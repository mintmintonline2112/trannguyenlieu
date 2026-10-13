/* F&B Tea — site interactions (vanilla JS, shared by every page) */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = reduceMotion ? 'auto' : 'smooth';
  const params = new URLSearchParams(location.search);

  // Bỏ dấu tiếng Việt để tìm kiếm: "ô long" khớp "o long", "Đào" khớp "dao"
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const setUrl = (search, hash = location.hash) => {
    try { history.replaceState(null, '', location.pathname + (search ? '?' + search : '') + hash); } catch (e) { /* file:// */ }
  };

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
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: scrollBehavior }));

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

  /* ---------- Scrollspy (only in-page links, i.e. the home page) ---------- */
  const navLinks = $$('.nav__list a[href^="#"]');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if (sections.length && 'IntersectionObserver' in window) {
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
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { runCount(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------- Home: product filter ---------- */
  const filters = $$('.filter');
  const homeProducts = $$('#productGrid .product');
  filters.forEach((btn) => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    filters.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    homeProducts.forEach((p) => {
      const show = f === 'all' || p.dataset.cat === f;
      p.hidden = !show;
      if (show) p.classList.add('is-in');
    });
  }));

  /* ---------- Search box helper (clear button + debounced input) ---------- */
  const bindSearch = (input, clear, onChange) => {
    const sync = () => { clear.hidden = !input.value; };
    input.addEventListener('input', debounce(() => { sync(); onChange(); }, 150));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    clear.addEventListener('click', () => { input.value = ''; sync(); onChange(); input.focus(); });
    sync();
  };

  /* ---------- Product catalog: filter · search · sort ---------- */
  const catalog = $('#catalog');
  if (catalog) {
    const cards = $$('.product', catalog);
    const chips = $$('[data-cat-filter]');
    const search = $('#catalogSearch');
    const sort = $('#catalogSort');
    const count = $('#catalogCount');
    const label = $('#catalogLabel');
    const empty = $('#catalogEmpty');
    const text = new Map(cards.map((c, i) => { c.dataset.index = i; return [c, fold(c.textContent)]; }));
    const sorters = {
      featured: (a, b) => a.dataset.index - b.dataset.index,
      'price-asc': (a, b) => a.dataset.price - b.dataset.price || a.dataset.index - b.dataset.index,
      'price-desc': (a, b) => b.dataset.price - a.dataset.price || a.dataset.index - b.dataset.index,
      name: (a, b) => a.dataset.name.localeCompare(b.dataset.name, 'vi'),
    };

    let cat = params.get('loai');
    if (!chips.some((c) => c.dataset.catFilter === cat)) cat = 'all';
    search.value = params.get('q') || '';
    if (sorters[params.get('sap-xep')]) sort.value = params.get('sap-xep');

    const apply = () => {
      const q = fold(search.value);
      let n = 0;
      cards.forEach((card) => {
        const show = (cat === 'all' || card.dataset.cat === cat) && (!q || text.get(card).includes(q));
        card.hidden = !show;
        if (show) { n++; card.classList.add('is-in'); }
      });
      cards.slice().sort(sorters[sort.value]).forEach((c) => catalog.appendChild(c));
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.catFilter === cat)));
      const active = chips.find((c) => c.dataset.catFilter === cat);
      count.textContent = n;
      label.textContent = cat === 'all' ? '' : ' · ' + active.firstChild.textContent.trim();
      catalog.hidden = n === 0;
      empty.hidden = n > 0;

      const p = new URLSearchParams();
      if (cat !== 'all') p.set('loai', cat);
      if (search.value.trim()) p.set('q', search.value.trim());
      if (sort.value !== 'featured') p.set('sap-xep', sort.value);
      setUrl(p.toString());
    };

    chips.forEach((c) => c.addEventListener('click', () => { cat = c.dataset.catFilter; apply(); }));
    sort.addEventListener('change', apply);
    bindSearch(search, $('#catalogClear'), apply);
    $('#catalogReset').addEventListener('click', () => {
      cat = 'all'; search.value = ''; $('#catalogClear').hidden = true; apply(); search.focus();
    });
    if (cat !== 'all' || search.value || sort.value !== 'featured') apply();
  }

  /* ---------- Product quick view (native <dialog>, deep-linkable via #slug) ---------- */
  const qv = $('#qv');
  const dataEl = $('#productData');
  if (qv && dataEl && typeof qv.showModal === 'function') {
    const data = JSON.parse(dataEl.textContent);
    const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
    let lastFocus = null;

    const fill = (p) => {
      const img = $('#qvImg');
      img.src = p.img; img.alt = p.name;
      $('#qvCat').textContent = p.cat;
      $('#qvTitle').textContent = p.name;
      $('#qvPrice').textContent = vnd(p.price);
      $('#qvPack').textContent = '/ gói ' + p.pack + ' · giá lẻ tham khảo';
      $('#qvDesc').textContent = p.desc;
      const specs = $('#qvSpecs');
      specs.replaceChildren(...p.specs.flatMap(([k, v]) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        return [dt, dd];
      }));
      $('#qvDrinks').replaceChildren(...p.drinks.map((d) => {
        const li = document.createElement('li'); li.className = 'tag'; li.textContent = d; return li;
      }));
      $('#qvRecipe').hidden = !p.recipe;
      $('#qvRecipeText').textContent = p.recipe;
      $('#qvQuote').href = p.quote;
      $('#qvSource').href = p.src;
    };

    const open = (id) => {
      const p = data[id];
      if (!p) return;
      fill(p);
      if (!qv.open) {
        lastFocus = document.activeElement;
        qv.showModal();
        document.documentElement.classList.add('has-modal');
      }
      if (location.hash !== '#' + id) setUrl(location.search.slice(1), '#' + id);
    };

    qv.addEventListener('close', () => {
      document.documentElement.classList.remove('has-modal');
      setUrl(location.search.slice(1), '');
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    });
    qv.addEventListener('click', (e) => { if (e.target === qv || e.target.closest('[data-close]')) qv.close(); });
    $$('[data-qv]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); open(el.dataset.qv); }));
    window.addEventListener('hashchange', () => open(location.hash.slice(1)));
    if (location.hash) open(decodeURIComponent(location.hash.slice(1)));
  }

  /* ---------- News: topic filter · search · load more ---------- */
  const newsList = $('#newsList');
  if (newsList) {
    const PAGE = 9;
    const items = $$('.news', newsList);
    const chips = $$('[data-news-filter]');
    const search = $('#newsSearch');
    const more = $('#newsMore');
    const status = $('#newsStatus');
    const bar = $('#newsBar');
    const empty = $('#newsEmpty');
    const pager = $('#newsPager');
    const text = new Map(items.map((el) => [el, fold(el.textContent)]));
    let limit = PAGE;
    let cat = params.get('chu-de');
    if (!chips.some((c) => c.dataset.newsFilter === cat)) cat = 'all';
    search.value = params.get('q') || '';

    const matches = () => {
      const q = fold(search.value);
      return items.filter((el) => (cat === 'all' || el.dataset.cat === cat) && (!q || text.get(el).includes(q)));
    };
    const apply = (reveal = true) => {
      const list = matches();
      items.forEach((el) => { el.hidden = true; });
      list.slice(0, limit).forEach((el) => { el.hidden = false; if (reveal) el.classList.add('is-in'); });
      const shown = Math.min(limit, list.length);
      status.textContent = 'Đang xem ' + shown + ' / ' + list.length + ' bài viết';
      bar.style.width = list.length ? (shown / list.length) * 100 + '%' : '0';
      more.hidden = list.length <= limit;
      pager.hidden = list.length === 0;
      empty.hidden = list.length > 0;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.newsFilter === cat)));

      const p = new URLSearchParams();
      if (cat !== 'all') p.set('chu-de', cat);
      if (search.value.trim()) p.set('q', search.value.trim());
      setUrl(p.toString());
      return list;
    };

    chips.forEach((c) => c.addEventListener('click', () => { cat = c.dataset.newsFilter; limit = PAGE; apply(); }));
    bindSearch(search, $('#newsClear'), () => { limit = PAGE; apply(); });
    more.addEventListener('click', () => {
      const first = limit;
      limit += PAGE;
      const list = apply(false);
      const next = list[first] && $('a', list[first]);
      if (next) next.focus({ preventScroll: true });
    });
    $('#newsReset').addEventListener('click', () => {
      cat = 'all'; search.value = ''; $('#newsClear').hidden = true; limit = PAGE; apply(); search.focus();
    });
    apply(false);
  }

  /* ---------- Contact forms: validation → mailto ---------- */
  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Vui lòng nhập họ và tên.'),
    phone: (v) => (/^(\+?84|0)\d{8,10}$/.test(v.replace(/[\s.-]/g, '')) ? '' : 'Số điện thoại chưa đúng định dạng (vd: 0357 845 748).'),
    email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Email chưa đúng định dạng (vd: ban@congty.vn).'),
  };
  const labelOf = (form, el) => {
    if (el.dataset.label) return el.dataset.label;
    const fs = el.closest('fieldset');
    const lab = (fs && $('legend', fs)) || (el.id && $('label[for="' + el.id + '"]', form));
    return lab ? lab.textContent.replace('*', '').trim() : el.name;
  };

  $$('form[data-mailto], #contactForm').forEach((form) => {
    const fields = Object.keys(rules).map((n) => form.elements[n]).filter(Boolean);
    const validate = (input) => {
      const err = rules[input.name](input.value);
      const field = input.closest('.field');
      const out = $('#e-' + input.name, form);
      field.classList.toggle('has-error', !!err);
      input.setAttribute('aria-invalid', err ? 'true' : 'false');
      if (out) { out.textContent = err; input.setAttribute('aria-describedby', out.id); }
      return !err;
    };
    fields.forEach((input) => {
      input.addEventListener('blur', () => validate(input));
      input.addEventListener('input', () => { if (input.closest('.field').classList.contains('has-error')) validate(input); });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const ok = fields.map(validate).every(Boolean);
      if (!ok) { fields.find((i) => i.getAttribute('aria-invalid') === 'true').focus(); return; }

      const lines = [];
      const seen = new Set();
      Array.from(form.elements).forEach((el) => {
        if (!el.name || seen.has(el.name)) return;
        seen.add(el.name);
        const value = el.type === 'checkbox'
          ? $$('[name="' + el.name + '"]:checked', form).map((c) => c.value).join(', ')
          : form.elements[el.name].value;
        lines.push(labelOf(form, el) + ': ' + (value.trim() || '—'));
      });
      const need = form.elements.need ? form.elements.need.value : 'Liên hệ';
      const subject = '[Website] ' + need + ' – ' + form.elements.name.value.trim();
      window.location.href = 'mailto:info@tranguyenlieu.vn?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
      $('.form__success', form).hidden = false;
    });
  });

  /* ---------- Home: prefill the in-page form from CTAs ---------- */
  const homeForm = $('#contactForm');
  if (homeForm) {
    const need = $('#f-need');
    const msg = $('#f-msg');
    const goToForm = () => {
      $('#lien-he').scrollIntoView({ behavior: scrollBehavior });
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
  }

  /* ---------- Contact page: prefill from ?need=…&sp=… ---------- */
  const pageForm = $('#form[data-mailto]');
  if (pageForm) {
    const pick = (name, value) => {
      const el = value && $$('[name="' + name + '"]', pageForm).find((i) => i.value === value);
      if (el) el.checked = true;
      return !!el;
    };
    pick('need', params.get('need'));
    if (params.get('sp') && !pick('products', params.get('sp'))) {
      pageForm.elements.message.value = 'Sản phẩm quan tâm: ' + params.get('sp');
    }
  }

  /* ---------- Newsletter ---------- */
  const sub = $('#subscribeForm');
  if (sub) {
    const input = sub.elements.email;
    const err = $('#e-s-email');
    sub.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const msg = !v ? 'Vui lòng nhập email để đăng ký.' : (rules.email(v) ? 'Email chưa đúng định dạng (vd: ban@congty.vn).' : '');
      err.textContent = msg;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) { input.focus(); return; }
      window.location.href = 'mailto:info@tranguyenlieu.vn?subject=' + encodeURIComponent('Đăng ký nhận tin – ' + v)
        + '&body=' + encodeURIComponent('Tôi muốn đăng ký nhận tin tức từ F&B Tea qua email: ' + v);
      $('#subscribeOk').hidden = false;
    });
  }

  /* ---------- Footer year ---------- */
  $('#year').textContent = new Date().getFullYear();
})();
