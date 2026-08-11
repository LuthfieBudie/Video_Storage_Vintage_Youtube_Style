// darkmode.js
// Mengatur toggle dark mode untuk seluruh halaman.
// Cukup include file ini + dark-mode.css di semua halaman.

(function () {
    const STORAGE_KEY = "site-theme"; // value: "dark" | "light"

    function applyTheme(theme) {
        if (theme === "dark") {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }
        updateToggleLabel(theme);
    }

    function updateToggleLabel(theme) {
        const toggleEl = document.getElementById("darkModeToggle");
        if (!toggleEl) return;
        toggleEl.textContent = theme === "dark" ? "|   Light mode   |" : "|   Dark mode   |";
    }

    function getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY);
    }

    function saveTheme(theme) {
        localStorage.setItem(STORAGE_KEY, theme);
    }

    function toggleTheme(e) {
        if (e) e.preventDefault();
        const isDark = document.body.classList.contains("dark-mode");
        const newTheme = isDark ? "light" : "dark";
        applyTheme(newTheme);
        saveTheme(newTheme);
    }

    function init() {
        const theme = getSavedTheme() || "light";
        applyTheme(theme);

        const toggleEl = document.getElementById("darkModeToggle");
        if (toggleEl) {
            toggleEl.addEventListener("click", toggleTheme);
        }
    }

    // Script ini biasanya diletakkan di akhir <body>, artinya DOM sudah
    // ready saat kode ini jalan. Jadi cek readyState dulu, jangan cuma
    // andalkan DOMContentLoaded (yang mungkin sudah keburu selesai).
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // expose in case it's needed elsewhere
    window.toggleTheme = toggleTheme;
})();