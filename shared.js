/* ═══════════════════════════════════════════════════════
   Database Design Course — Shared JavaScript
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initAccordions();
  initMobileMenu();
  initBackToTop();
  initReadingProgress();
  initSidebarHighlight();
  initScrollReveal();
});

/* ── Tabs ───────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const buttons = tabGroup.querySelectorAll('.tab-btn');
    const panels = tabGroup.querySelectorAll('.tab-panel');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        buttons.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const panel = tabGroup.querySelector(`[data-panel="${target}"]`);
        if (panel) panel.classList.add('active');
      });
    });
  });
}

/* ── Accordions ─────────────────────────────────────── */
function initAccordions() {
  document.querySelectorAll('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion-item');
      const wasOpen = item.classList.contains('open');

      // Close siblings in single-open mode
      const accordion = item.closest('.accordion');
      if (accordion && accordion.dataset.single !== 'false') {
        accordion.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
      }

      // Toggle the clicked item
      if (wasOpen) {
        item.classList.remove('open');
      } else {
        item.classList.add('open');
      }
    });
  });
}

/* ── Mobile Sidebar ─────────────────────────────────── */
function initMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (!btn || !sidebar) return;

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    const isOpen = sidebar.classList.contains('open');
    btn.textContent = isOpen ? '✕' : '☰';
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.setAttribute('aria-label', isOpen ? '페이지 목차 닫기' : '페이지 목차 열기');
  });

  // Close sidebar on link click (mobile)
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
        btn.textContent = '☰';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', '페이지 목차 열기');
      }
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      btn.textContent = '☰';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', '페이지 목차 열기');
      btn.focus();
    }
  });
}

/* ── Back to Top ────────────────────────────────────── */
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ── Reading Progress ───────────────────────────────── */
function initReadingProgress() {
  const bar = document.querySelector('.reading-progress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / docHeight) * 100;
    bar.style.width = progress + '%';
  });
}

/* ── Sidebar Active Link ────────────────────────────── */
function initSidebarHighlight() {
  const sections = document.querySelectorAll('section[id], [id].block-header');
  const navLinks = document.querySelectorAll('.sidebar nav a[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  sections.forEach(section => observer.observe(section));
}

/* ── Scroll Reveal ──────────────────────────────────── */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => observer.observe(el));
}

/* ── Quiz Helper ────────────────────────────────────── */
function initQuiz(quizId) {
  const container = document.getElementById(quizId);
  if (!container) return;

  const options = container.querySelectorAll('.quiz-option');
  const feedback = container.querySelector('.quiz-feedback');
  let answered = false;

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      const isCorrect = opt.dataset.correct === 'true';
      opt.classList.add(isCorrect ? 'correct' : 'wrong');

      if (!isCorrect) {
        const correctOpt = container.querySelector('[data-correct="true"]');
        if (correctOpt) correctOpt.classList.add('correct');
      }

      if (feedback) {
        feedback.textContent = isCorrect
          ? (opt.dataset.explanation || 'Correct!')
          : (container.querySelector('[data-correct="true"]')?.dataset.explanation || 'Try again!');
        feedback.className = 'quiz-feedback show ' + (isCorrect ? 'info-box tip' : 'info-box danger');
      }
    });
  });
}

/* ── Constraint Checker Helper ──────────────────────── */
function checkConstraint(btnId, resultId, isViolation, explanation) {
  const btn = document.getElementById(btnId);
  const result = document.getElementById(resultId);
  if (!btn || !result) return;

  btn.addEventListener('click', () => {
    result.style.display = 'block';
    result.className = isViolation ? 'info-box danger' : 'info-box tip';
    result.innerHTML = `<div class="box-title">${isViolation ? '❌ Violation!' : '✅ OK'}</div><p>${explanation}</p>`;
  });
}

/* ── Highlighted Row Toggle ─────────────────────────── */
function toggleHighlight(el) {
  el.classList.toggle('highlight-row');
}
