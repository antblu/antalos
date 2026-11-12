// Apply a saved preference before the React controls mount. Storage is optional.
(function () {
  try {
    var theme = localStorage.getItem('antalos:theme');
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.journalTheme = theme;
  } catch (_) { /* OS preference remains available through CSS. */ }
})();
