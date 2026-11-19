(function () {
  'use strict';

  const rail = document.querySelector('.ve-reader-rail');
  const toc = rail && rail.querySelector('[data-ve-toc]');
  const article = document.querySelector('.post-page');
  if (!toc || !article) return;

  const nav = toc.querySelector('.ve-chapter-nav');
  const summary = toc.querySelector('summary');
  const currentLabel = toc.querySelector('[data-ve-current]');
  const chapters = Array.from(nav.querySelectorAll('a[href^="#"]')).map(function (link) {
    return { link: link, target: document.getElementById(link.hash.slice(1)) };
  }).filter(function (chapter) { return chapter.target; });
  if (!chapters.length) return;

  const narrow = window.matchMedia('(max-width: 1050px)');
  let active = null;
  let scheduled = false;

  function keepCurrentVisible() {
    if (!active || !toc.open) return;
    const item = active.link.getBoundingClientRect();
    const viewport = nav.getBoundingClientRect();
    // Do not use scrollIntoView: it can also scroll the article's viewport.
    if (item.top < viewport.top + 8) nav.scrollTop += item.top - viewport.top - 8;
    else if (item.bottom > viewport.bottom - 8) nav.scrollTop += item.bottom - viewport.bottom + 8;
  }

  function setActive(chapter) {
    if (chapter === active) return;
    if (active) active.link.removeAttribute('aria-current');
    active = chapter;
    if (active) active.link.setAttribute('aria-current', 'location');
    currentLabel.textContent = active ? active.link.textContent : '文章开头';
    keepCurrentVisible();
  }

  function update() {
    scheduled = false;
    const offset = narrow.matches ? Math.ceil(summary.getBoundingClientRect().height) + 36 : 32;
    document.body.style.setProperty('--ve-heading-offset', offset + 'px');
    let chapter = null;
    for (const candidate of chapters) {
      if (candidate.target.getBoundingClientRect().top <= offset + 4) chapter = candidate;
      else break;
    }
    setActive(chapter);
    keepCurrentVisible();
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  }

  function adaptLayout() {
    toc.open = !narrow.matches;
    scheduleUpdate();
  }

  nav.addEventListener('click', function (event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (narrow.matches) toc.open = false;
    // Native anchors preserve hash URLs, history, and keyboard navigation.
    scheduleUpdate();
  });
  toc.addEventListener('toggle', function () {
    scheduleUpdate();
    keepCurrentVisible();
  });
  toc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && narrow.matches && toc.open) {
      toc.open = false;
      summary.focus({ preventScroll: true });
    }
  });
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  narrow.addEventListener('change', adaptLayout);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleUpdate).observe(article);
  if (document.fonts) document.fonts.ready.then(scheduleUpdate);
  adaptLayout();
})();
