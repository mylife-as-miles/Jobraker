(function initializeTheme() {
  try {
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var storedTheme = localStorage.getItem("theme");
    var shouldUseDark = storedTheme === "dark" || (!storedTheme && prefersDark);

    if (shouldUseDark) {
      document.documentElement.classList.add("dark");
      return;
    }

    document.documentElement.classList.remove("dark");
  } catch (_) {}
})();
