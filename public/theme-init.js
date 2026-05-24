(function initializeTheme() {
  try {
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var storedTheme = localStorage.getItem("appearance_theme") || localStorage.getItem("theme");
    
    var shouldUseDark = true; // Default to dark mode
    if (storedTheme === "light") {
      shouldUseDark = false;
    } else if (storedTheme === "auto") {
      shouldUseDark = prefersDark;
    }

    if (shouldUseDark) {
      document.documentElement.classList.add("dark");
      return;
    }

    document.documentElement.classList.remove("dark");
  } catch (_) {}
})();
