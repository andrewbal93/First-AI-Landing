'use strict';

/* =====================================================
   ORBITAL — логика лендинга
   Каждая функция отвечает за одну задачу,
   инициализация — в DOMContentLoaded.
   ===================================================== */

// Помечаем документ: стили .js .reveal применяются только при работающем JS
document.documentElement.classList.add('js');

/* ===== HELPERS ===== */
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Выполняет функцию не чаще одного раза за кадр. */
function rafThrottle(fn) {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      fn(...args);
    });
  };
}

/* ===== MOBILE NAV ===== */
function initMobileNav() {
  const burger = document.querySelector('[data-burger]');
  const nav = document.getElementById('site-nav');
  if (!burger || !nav) return;

  const body = document.body;
  const desktopQuery = window.matchMedia('(min-width: 1024px)');

  const setOpen = (open) => {
    body.classList.toggle('is-menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };

  burger.addEventListener('click', () => {
    setOpen(!body.classList.contains('is-menu-open'));
  });

  // Клик по ссылке внутри меню закрывает его
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('is-menu-open')) {
      setOpen(false);
      burger.focus();
    }
  });

  // Клик по затемнению под меню закрывает его (клики по body::after попадают на body)
  body.addEventListener('click', (event) => {
    if (event.target === body && body.classList.contains('is-menu-open')) setOpen(false);
  });

  // Trap фокуса: Tab зацикливается между бургером и пунктами открытого меню
  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !body.classList.contains('is-menu-open')) return;

    const focusables = [burger, ...nav.querySelectorAll('a[href]')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  desktopQuery.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}

/* ===== HEADER STATE ===== */
function initHeaderState() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  update();
  window.addEventListener('scroll', rafThrottle(update), { passive: true });
}

/* ===== SMOOTH SCROLL ===== */
function initSmoothScroll() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;

    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;

    const behavior = reduceMotionQuery.matches ? 'auto' : 'smooth';

    if (hash === '#top') {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior });
      return;
    }

    const target = document.querySelector(hash);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior, block: 'start' });
    history.pushState(null, '', hash);

    // Переносим фокус для пользователей клавиатуры и скринридеров
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}

/* ===== ACTIVE NAV LINK ===== */
function initActiveNavLink() {
  const links = [...document.querySelectorAll('.nav__link')];
  if (!links.length || !('IntersectionObserver' in window)) return;

  const byId = new Map();
  links.forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section) byId.set(section, link);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = byId.get(entry.target);
      if (!link) return;
      if (entry.isIntersecting) {
        links.forEach((item) => item.removeAttribute('aria-current'));
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  byId.forEach((_, section) => observer.observe(section));
}

/* ===== REVEAL ON SCROLL ===== */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window) || reduceMotionQuery.matches) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  items.forEach((item) => observer.observe(item));
}

/* ===== STARFIELD (canvas) ===== */
function initStarfield() {
  const canvas = document.querySelector('[data-starfield]');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const STAR_COUNT = 150;
  const TINTS = ['255,255,255', '255,255,255', '255,255,255', '175,225,255', '255,200,170'];

  let width = 0;
  let height = 0;
  let stars = [];
  let frameId = 0;
  let lastTime = 0;
  let isVisible = true;

  const random = (min, max) => min + Math.random() * (max - min);

  function createStar() {
    const radius = random(0.3, 1.7);
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius,
      // крупные звёзды «ближе» и движутся чуть быстрее
      speed: random(1.5, 5) + radius * 4,
      twinkleSpeed: random(0.6, 2.2),
      phase: random(0, Math.PI * 2),
      tint: TINTS[Math.floor(Math.random() * TINTS.length)],
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const prevWidth = width;
    const prevHeight = height;

    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!stars.length) {
      stars = Array.from({ length: STAR_COUNT }, createStar);
    } else if (prevWidth && prevHeight) {
      // сохраняем расположение звёзд при изменении размера
      stars.forEach((star) => {
        star.x = (star.x / prevWidth) * width;
        star.y = (star.y / prevHeight) * height;
      });
    }

    draw(performance.now(), 0);
  }

  function draw(time, delta) {
    ctx.clearRect(0, 0, width, height);
    const seconds = time / 1000;

    for (const star of stars) {
      // медленный дрейф влево-вниз
      star.x -= star.speed * delta * 0.7;
      star.y += star.speed * delta * 0.25;
      if (star.x < -2) star.x = width + 2;
      if (star.y > height + 2) star.y = -2;

      const twinkle = 0.55 + 0.45 * Math.sin(seconds * star.twinkleSpeed + star.phase);

      ctx.beginPath();
      ctx.fillStyle = `rgba(${star.tint}, ${(0.35 + twinkle * 0.65).toFixed(3)})`;
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();

      if (star.radius > 1.3) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${star.tint}, ${(twinkle * 0.12).toFixed(3)})`;
        ctx.arc(star.x, star.y, star.radius * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function frame(time) {
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    draw(time, delta);
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (frameId || reduceMotionQuery.matches || !isVisible) return;
    lastTime = performance.now();
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  resize();
  start();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  // Не тратим ресурсы, когда hero вне экрана
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible) start();
      else stop();
    }).observe(canvas);
  }

  reduceMotionQuery.addEventListener('change', () => {
    if (reduceMotionQuery.matches) {
      stop();
      draw(performance.now(), 0);
    } else {
      start();
    }
  });
}

/* ===== VIDEO DIALOG ===== */
function initVideoDialog() {
  const dialog = document.getElementById('video-dialog');
  const openers = document.querySelectorAll('[data-video-open]');
  const embed = dialog ? dialog.querySelector('[data-video-embed]') : null;
  if (!dialog || !embed || typeof dialog.showModal !== 'function') return;

  // nocookie-домен; autoplay срабатывает, потому что открытие — действие пользователя
  const VIDEO_SRC = 'https://www.youtube-nocookie.com/embed/u81Jlrp_CG0?autoplay=1&rel=0';

  // iframe создаётся только при открытии — YouTube не грузится заранее,
  // а при закрытии удаляется вместе с воспроизведением
  function mount() {
    const iframe = document.createElement('iframe');
    iframe.className = 'dialog__frame';
    iframe.src = VIDEO_SRC;
    iframe.title = 'Видео о полёте Aurora-1';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    embed.replaceChildren(iframe);
  }

  function unmount() {
    embed.replaceChildren();
  }

  openers.forEach((opener) => {
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      mount();
      dialog.showModal();
    });
  });

  dialog.addEventListener('close', unmount);

  dialog.querySelectorAll('[data-dialog-close]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });

  // Закрытие кликом по затемнённому фону
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

/* ===== SHIP SCHEMATIC ===== */
const SHIP_ZONES = {
  cabin: {
    title: 'Кабина',
    text: 'Герметичная кабина на шесть пассажиров и пилота. На взлёте кресла откинуты почти горизонтально, в невесомости — свободны, и вы можете парить.',
    specs: [
      ['Вместимость', '6 пассажиров + пилот'],
      ['Перегрузка на старте', 'до 3 g'],
      ['Давление в кабине', 'как на высоте 2 000 м'],
    ],
  },
  windows: {
    title: 'Иллюминаторы',
    text: 'У каждого кресла — собственный большой иллюминатор, а над головой — обзорное окно. Кривизну Земли видно, не поворачивая головы.',
    specs: [
      ['Количество', '6 боковых + 1 верхний'],
      ['Диаметр бокового', '40 см'],
      ['Стекло', 'три слоя, защита от УФ'],
    ],
  },
  tank: {
    title: 'Топливный отсек',
    text: 'Гибридное топливо: твёрдое горючее и жидкий окислитель. Подачу можно прекратить в любой момент, поэтому набор высоты остаётся управляемым.',
    specs: [
      ['Тип двигателя', 'гибридный'],
      ['Время работы', '60 секунд'],
      ['Запас топлива', '+15% к расчётному'],
    ],
  },
  fins: {
    title: 'Крылья-стабилизаторы',
    text: 'На спуске крылья складываются вверх и превращают корабль в «воланчик». Он сам принимает правильное положение и мягко входит в плотную атмосферу.',
    specs: [
      ['Режим спуска', 'складные крылья'],
      ['Максимальный нагрев', 'низкий'],
      ['Посадка', 'на взлётную полосу'],
    ],
  },
  engines: {
    title: 'Двигатели',
    text: 'Три двигателя работают синхронно примерно минуту и разгоняют корабль до скорости, втрое превышающей скорость звука. Любой из них можно отключить отдельно.',
    specs: [
      ['Количество', '3'],
      ['Тяга каждого', '170 кН'],
      ['Максимальная скорость', 'Mach 3'],
    ],
  },
};

function initShip() {
  const root = document.querySelector('[data-ship]');
  if (!root) return;

  const tabs = [...root.querySelectorAll('[data-zone-tab]')];
  const zones = [...root.querySelectorAll('[data-zone]')];
  const info = root.querySelector('[data-ship-info]');
  const titleEl = root.querySelector('[data-ship-title]');
  const textEl = root.querySelector('[data-ship-text]');
  const specsEl = root.querySelector('[data-ship-specs]');
  if (!tabs.length || !info || !titleEl || !textEl || !specsEl) return;

  function renderSpecs(specs) {
    specsEl.replaceChildren(
      ...specs.map(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'ship__spec';
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        row.append(dt, dd);
        return row;
      })
    );
  }

  function select(zoneId, { focus = false } = {}) {
    const data = SHIP_ZONES[zoneId];
    if (!data) return;

    tabs.forEach((tab) => {
      const active = tab.dataset.zoneTab === zoneId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active) {
        info.setAttribute('aria-labelledby', tab.id);
        if (focus) tab.focus();
      }
    });

    zones.forEach((zone) => {
      zone.classList.toggle('is-active', zone.dataset.zone === zoneId);
    });

    titleEl.textContent = data.title;
    textEl.textContent = data.text;
    renderSpecs(data.specs);

    // перезапуск анимации смены контента
    info.classList.remove('is-changing');
    void info.offsetWidth;
    info.classList.add('is-changing');
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.zoneTab));

    // Навигация по вкладкам стрелками (шаблон WAI-ARIA tabs)
    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      let next = null;

      if (event.key in keys) next = (index + keys[event.key] + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === null) return;

      event.preventDefault();
      select(tabs[next].dataset.zoneTab, { focus: true });
    });
  });

  // Клик по самой схеме
  zones.forEach((zone) => {
    zone.addEventListener('click', () => select(zone.dataset.zone));
  });

  select('cabin');
  info.classList.remove('is-changing');
}

/* ===== TIMELINE ===== */
function initTimeline() {
  const timeline = document.querySelector('[data-timeline]');
  if (!timeline) return;

  const steps = [...timeline.querySelectorAll('.timeline__step')];
  const list = timeline.querySelector('.timeline__list');
  if (!steps.length || !list) return;

  function update() {
    const viewport = window.innerHeight;
    const trigger = viewport * 0.6;
    const rect = list.getBoundingClientRect();

    const progress = clamp((trigger - rect.top) / rect.height, 0, 1);
    timeline.style.setProperty('--progress', progress.toFixed(4));

    steps.forEach((step) => {
      const dot = step.querySelector('.timeline__dot');
      const dotRect = dot.getBoundingClientRect();
      const center = dotRect.top + dotRect.height / 2;
      step.classList.toggle('is-active', center <= trigger);
    });
  }

  const onScroll = rafThrottle(update);
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
}

/* ===== FAQ ACCORDION ===== */
function initFaq() {
  const faq = document.querySelector('[data-faq]');
  if (!faq) return;

  const items = [...faq.querySelectorAll('.faq__item')];

  function setOpen(item, open) {
    const trigger = item.querySelector('.faq__trigger');
    item.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  }

  items.forEach((item) => {
    const trigger = item.querySelector('.faq__trigger');
    trigger.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      // одновременно открыт только один вопрос
      items.forEach((other) => setOpen(other, other === item ? willOpen : false));
    });
  });
}

/* ===== BOOKING: ВЫБОР ТАРИФА И ДАТЫ ===== */
function initBookingLinks() {
  const form = document.querySelector('[data-lead-form]');
  const chip = document.querySelector('[data-lead-chip]');
  const booking = document.getElementById('booking');
  if (!form || !chip || !booking) return;

  const planInput = form.querySelector('[data-lead-plan]');
  const dateInput = form.querySelector('[data-lead-date]');
  const planWrap = chip.querySelector('[data-chip-plan-wrap]');
  const dateWrap = chip.querySelector('[data-chip-date-wrap]');
  const planText = chip.querySelector('[data-chip-plan]');
  const dateText = chip.querySelector('[data-chip-date]');
  const clearButton = chip.querySelector('[data-chip-clear]');
  if (!planInput || !dateInput) return;

  function updateChip() {
    const plan = planInput.value;
    const date = dateInput.value;
    chip.hidden = !plan && !date;
    planWrap.hidden = !plan;
    dateWrap.hidden = !date;
    planText.textContent = plan;
    dateText.textContent = date;
  }

  function goToForm() {
    booking.scrollIntoView({ behavior: reduceMotionQuery.matches ? 'auto' : 'smooth', block: 'start' });
  }

  document.querySelectorAll('[data-plan]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      planInput.value = link.dataset.plan;
      updateChip();
      goToForm();
    });
  });

  document.querySelectorAll('[data-date]').forEach((button) => {
    button.addEventListener('click', () => {
      dateInput.value = button.dataset.date;
      updateChip();
      goToForm();
    });
  });

  clearButton.addEventListener('click', () => {
    planInput.value = '';
    dateInput.value = '';
    updateChip();
  });

  updateChip();
}

/* ===== GALLERY LIGHTBOX ===== */
function initGallery() {
  const dialog = document.getElementById('gallery-dialog');
  const openers = [...document.querySelectorAll('[data-gallery-open]')];
  if (!dialog || !openers.length || typeof dialog.showModal !== 'function') return;

  const imageEl = dialog.querySelector('[data-lb-image]');
  const captionEl = dialog.querySelector('[data-lb-caption]');
  const counterEl = dialog.querySelector('[data-lb-counter]');
  const prevButton = dialog.querySelector('[data-lb-prev]');
  const nextButton = dialog.querySelector('[data-lb-next]');
  const closeButton = dialog.querySelector('[data-lb-close]');

  // Данные о кадрах берём из самой разметки — единый источник правды
  const items = openers.map((opener) => {
    const img = opener.querySelector('img');
    const figure = opener.closest('figure');
    const caption = figure ? figure.querySelector('.gallery__caption') : null;
    return {
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      caption: caption ? caption.textContent.trim() : '',
    };
  });

  let currentIndex = 0;

  function render() {
    const item = items[currentIndex];
    imageEl.src = item.src;
    imageEl.alt = item.alt;
    captionEl.textContent = item.caption;
    counterEl.textContent = `${currentIndex + 1} / ${items.length}`;
  }

  function open(index) {
    currentIndex = index;
    render();
    dialog.showModal();
  }

  function step(delta) {
    currentIndex = (currentIndex + delta + items.length) % items.length;
    render();
  }

  openers.forEach((opener, index) => {
    opener.addEventListener('click', () => open(index));
  });

  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  closeButton.addEventListener('click', () => dialog.close());

  // Листание стрелками клавиатуры
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  });

  // Закрытие кликом по затемнённому фону (как у video dialog)
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  // Возврат фокуса на миниатюру, с которой открыли
  dialog.addEventListener('close', () => {
    openers[currentIndex]?.focus();
  });
}

/* ===== BACK TO TOP ===== */
function initToTop() {
  const button = document.querySelector('[data-to-top]');
  if (!button) return;

  const update = () => {
    const shouldShow = window.scrollY > 600;
    // если состояние уже правильное — выходим
    if (shouldShow === !button.hidden) return;

    if (shouldShow) {
      button.hidden = false;
      requestAnimationFrame(() => button.classList.add('is-visible'));
    } else {
      button.classList.remove('is-visible');
      setTimeout(() => {
        if (!button.classList.contains('is-visible')) button.hidden = true;
      }, 320);
    }
  };

  window.addEventListener('scroll', rafThrottle(update), { passive: true });
  update();

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotionQuery.matches ? 'auto' : 'smooth' });
  });
}

/* ===== LEAD FORM ===== */
function initLeadForm() {
  const form = document.querySelector('[data-lead-form]');
  const success = document.querySelector('[data-lead-success]');
  if (!form || !success) return;

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const nameInput = form.elements.name;
  const emailInput = form.elements.email;
  const phoneInput = form.elements.phone;
  const honeypot = form.elements.website;
  const submitButton = form.querySelector('button[type="submit"]');
  const emailOutput = success.querySelector('[data-lead-email]');
  const extraOutput = success.querySelector('[data-lead-extra]');
  const planInput = form.querySelector('[data-lead-plan]');
  const dateInput = form.querySelector('[data-lead-date]');

  const validators = new Map([
    [nameInput, (value) => {
      if (!value) return 'Введите имя.';
      if (value.length < 2) return 'Имя должно содержать минимум 2 символа.';
      return '';
    }],
    [emailInput, (value) => {
      if (!value) return 'Введите email.';
      if (!EMAIL_PATTERN.test(value)) return 'Проверьте email: он должен выглядеть как name@example.com.';
      return '';
    }],
    [phoneInput, (value) => {
      // телефон необязательный: пустое значение — валидно
      if (!value) return '';
      if (value.replace(/\D/g, '').length < 10) return 'Введите номер полностью: минимум 10 цифр.';
      return '';
    }],
  ]);

  function validateField(input) {
    const message = validators.get(input)(input.value.trim());
    const errorEl = document.getElementById(input.getAttribute('aria-describedby'));

    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (errorEl) errorEl.textContent = message;
    return !message;
  }

  // Живая проверка: после первой потери фокуса и далее при вводе
  validators.forEach((_, input) => {
    input.addEventListener('blur', () => {
      if (input.value.trim() || input.dataset.touched) {
        input.dataset.touched = 'true';
        validateField(input);
      }
    });
    input.addEventListener('input', () => {
      if (input.dataset.touched) validateField(input);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitButton.classList.contains('is-loading')) return;

    let firstInvalid = null;
    validators.forEach((_, input) => {
      input.dataset.touched = 'true';
      if (!validateField(input) && !firstInvalid) firstInvalid = input;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    function showSuccess() {
      emailOutput.textContent = emailInput.value.trim();

      const details = [];
      if (planInput && planInput.value) details.push(`Тариф: ${planInput.value}`);
      if (dateInput && dateInput.value) details.push(`Старт: ${dateInput.value}`);
      extraOutput.hidden = details.length === 0;
      extraOutput.textContent = details.join(' · ');

      form.hidden = true;
      success.hidden = false;
      success.focus();
      submitButton.classList.remove('is-loading');
      submitButton.removeAttribute('aria-busy');
    }

    // honeypot заполнен — это бот: показываем успех, ничего не отправляя
    if (honeypot && honeypot.value.trim()) {
      showSuccess();
      return;
    }

    // Эмуляция отправки (бэкенда нет)
    submitButton.classList.add('is-loading');
    submitButton.setAttribute('aria-busy', 'true');

    setTimeout(showSuccess, 1400);
  });
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initHeaderState();
  initSmoothScroll();
  initActiveNavLink();
  initReveal();
  initStarfield();
  initVideoDialog();
  initShip();
  initTimeline();
  initFaq();
  initBookingLinks();
  initLeadForm();
  initToTop();
  initGallery();
});
