// ============================================================
// ZOOM FOTO (lightbox sederhana) - untuk photo.html
// Klik foto -> tampil besar di tengah layar
// Klik area gelap / tombol X / tekan Esc -> tutup
// ============================================================

(function () {
    let overlay = null;

    function createOverlay() {
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "zoomOverlay";
        overlay.className = "zoom-overlay";
        overlay.innerHTML = `
            <span class="zoom-close" aria-label="Tutup">&times;</span>
            <img class="zoom-image" src="" alt="">
        `;
        document.body.appendChild(overlay);

        // Klik di luar gambar (area gelap) atau tombol X -> tutup
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay || e.target.classList.contains("zoom-close")) {
                closeZoom();
            }
        });

        // Tombol Esc -> tutup
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeZoom();
        });

        return overlay;
    }

    function openZoom(src) {
        const ov = createOverlay();
        const img = ov.querySelector(".zoom-image");
        img.src = src;
        ov.classList.add("active");
        document.body.style.overflow = "hidden"; // kunci scroll saat zoom aktif
    }

    function closeZoom() {
        if (!overlay) return;
        overlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    // Pasang event klik ke semua .photo-item di dalam container tertentu
    function attachZoomHandlers(container) {
        container.querySelectorAll(".photo-item").forEach((item) => {
            // Hindari pasang event dobel kalau dipanggil ulang
            if (item.dataset.zoomBound === "true") return;
            item.dataset.zoomBound = "true";

            item.addEventListener("click", () => {
                const img = item.querySelector("img");
                const fullSrc = item.dataset.fullSrc || (img ? img.src : "");
                if (fullSrc) openZoom(fullSrc);
            });
        });
    }

    // Dipanggil dari gdrive.js setelah kartu-kartu foto selesai dirender,
    // atau otomatis saat halaman dimuat kalau foto sudah ada duluan di HTML.
    function initZoom(container) {
        createOverlay();
        attachZoomHandlers(container || document);
    }

    // Ekspor supaya bisa dipanggil dari gdrive.js
    window.initZoom = initZoom;

    document.addEventListener("DOMContentLoaded", () => {
        initZoom(document);
    });
})();