document.addEventListener('DOMContentLoaded', function () {
  try {
    const svg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`;

    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(btn => {
      // allow existing content (text) to stay if developer prefers; otherwise overwrite
      if (!btn.innerHTML.trim()) btn.innerHTML = svg;

      // Read optional fallback from data-fallback attribute
      const fallback = btn.getAttribute('data-fallback') || '/staff-dashboard.html';
      const alwaysShow = btn.getAttribute('data-always-show') === 'true';

      // Accessibility
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') || 'Go back');
      btn.tabIndex = btn.tabIndex >= 0 ? btn.tabIndex : 0;

      // Click handler: prefer history.back when possible, otherwise go to fallback
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          if (window.history && window.history.length > 1) {
            window.history.back();
            return;
          }
        } catch (err) {
          // ignore history errors
        }
        // fallback target
        window.location.href = fallback;
      });

      // Hide if no meaningful history unless explicitly requested to always show
      try {
        if (!alwaysShow && (!window.history || window.history.length <= 1)) btn.style.display = 'none';
      } catch (err) {
        // ignore
      }
    });

    // Keyboard shortcut: Alt+ArrowLeft or Meta+ArrowLeft
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
      if ((e.altKey && e.key === 'ArrowLeft') || (e.metaKey && e.key === 'ArrowLeft')) {
        try {
          if (window.history && window.history.length > 1) {
            window.history.back();
          }
        } catch (err) {
          // ignore
        }
      }
    });
  } catch (err) {
    console.error('back.js error', err);
  }
});
