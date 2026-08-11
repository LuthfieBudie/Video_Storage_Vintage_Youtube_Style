document.getElementById("last-update").innerHTML = new Date(document.lastModified).toLocaleString('id-ID', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true});


function toggleFilterDropdown() {
    document.getElementById("filterDropDownMenu").classList.toggle("show-dropdown");
}

// ============================================================
// FILTER PENCARIAN AKTIF (title / from / category / tags / figma)
// Dipetakan dari ikon yang dipilih di dropdown-filter-content.
// Disimpan di localStorage supaya tetap "diingat" walau pindah halaman.
// ============================================================
const IKON_KE_FILTER = {
    "fa-magnifying-glass": "title",
    "fa-at": "from",
    "fa-list": "category",
    "fa-tag": "tags",
    "fa-figma": "figma"
};

function tentukanFilterDariIkon(iconEl) {
    if (!iconEl) return "title";
    for (const kelas of iconEl.classList) {
        if (IKON_KE_FILTER[kelas]) return IKON_KE_FILTER[kelas];
    }
    return "title";
}

function getFilterAktif() {
    return localStorage.getItem("searchFilterType") || "title";
}

function setFilterAktif(filterType) {
    localStorage.setItem("searchFilterType", filterType);
}

// Mengganti ikon tombol filter sesuai pilihan yang diklik di dropdown
function selectFilter(el, event) {
    event.preventDefault();

    var chosenIcon = el.querySelector("i");
    var filterIcon = document.getElementById("filterIcon");

    if (chosenIcon && filterIcon) {
        filterIcon.className = chosenIcon.className;
    }

    setFilterAktif(tentukanFilterDariIkon(chosenIcon));
    document.getElementById("filterDropDownMenu").classList.remove("show-dropdown");

    // Filter baru dipilih -> langsung tampilkan saran baru sesuai filter itu
    tampilkanSaranPencarian();
}

// Menutup dropdown otomatis jika pengguna mengklik area di luar tombol
window.onclick = function(event) {
    if (!event.target.matches('.filter') && !event.target.closest('.filter')) {
        var dropdowns = document.getElementsByClassName("dropdown-filter-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show-dropdown')) {
                openDropdown.classList.remove('show-dropdown');
            }
        }
    }

    if (!event.target.closest('.search')) {
        sembunyikanSaranPencarian();
    }
}

// ============================================================
// DROPDOWN SARAN PENCARIAN
// Muncul di bawah kotak input, isinya diambil dari gdrive.js
// (window.getSearchSuggestions / window.getAllTagsForSearch)
// ============================================================

function ambilElemenSaran(searchBox) {
    let ul = searchBox.querySelector(".search-suggestions");
    if (!ul) {
        ul = document.createElement("ul");
        ul.className = "search-suggestions";
        searchBox.appendChild(ul);
    }
    return ul;
}

function sembunyikanSaranPencarian() {
    document.querySelectorAll(".search-suggestions").forEach((ul) => {
        ul.classList.remove("show-suggestions");
        ul.innerHTML = "";
    });
}

function renderDaftarSaran(ul, daftar, filterType, inputEl) {
    if (!daftar.length) {
        ul.classList.remove("show-suggestions");
        ul.innerHTML = "";
        return;
    }

    ul.innerHTML = daftar.map((teks) =>
        `<li><i class="fa-solid fa-magnifying-glass"></i> ${teks}</li>`
    ).join("");

    ul.querySelectorAll("li").forEach((li, i) => {
        li.addEventListener("click", () => {
            inputEl.value = daftar[i];
            sembunyikanSaranPencarian();
            jalankanPencarian(filterType, daftar[i]);
        });
    });

    ul.classList.add("show-suggestions");
}

async function tampilkanSaranPencarian() {
    const searchBox = document.querySelector(".search");
    const inputEl = searchBox ? searchBox.querySelector("input[type='text']") : null;
    if (!searchBox || !inputEl || typeof window.getSearchSuggestions !== "function") return;

    const filterType = getFilterAktif();
    const query = inputEl.value;
    const ul = ambilElemenSaran(searchBox);

    // Kasih tahu user datanya lagi dimuat (fetch pertama kali biasanya perlu beberapa detik)
    ul.innerHTML = `<li class="search-suggestions-loading">Memuat...</li>`;
    ul.classList.add("show-suggestions");

    const daftar = await window.getSearchSuggestions(filterType, query, 5);

    // Kalau selama menunggu tadi user sudah ganti filter/ketikan lain, jangan timpa hasil yang lebih baru
    if (getFilterAktif() !== filterType || inputEl.value !== query) return;

    renderDaftarSaran(ul, daftar, filterType, inputEl);
}

// Klik tombol Search dengan filter "tags" + kotak kosong -> tampilkan SEMUA
// tag yang ada (bukan cuma 5 acak), supaya user tinggal pilih salah satu.
async function tampilkanSemuaTag() {
    const searchBox = document.querySelector(".search");
    const inputEl = searchBox ? searchBox.querySelector("input[type='text']") : null;
    if (!searchBox || !inputEl || typeof window.getAllTagsForSearch !== "function") return;

    const ul = ambilElemenSaran(searchBox);
    ul.innerHTML = `<li class="search-suggestions-loading">Memuat...</li>`;
    ul.classList.add("show-suggestions");

    const daftarTag = await window.getAllTagsForSearch(inputEl.value);
    renderDaftarSaran(ul, daftarTag, "tags", inputEl);
}

function jalankanPencarian(filterType, query) {
    const q = (query || "").trim();
    if (!q) return; // tidak ada yang diketik/dipilih, jangan pindah halaman

    const params = new URLSearchParams();
    params.set("type", filterType);
    params.set("q", q);

    // search.html ada di folder /html/ yang sama seperti halaman lain
    window.location.href = `search.html?${params.toString()}`;
}

document.addEventListener("DOMContentLoaded", () => {
    const searchBox = document.querySelector(".search");
    if (!searchBox) return;

    const inputEl = searchBox.querySelector("input[type='text']");
    const submitBtn = searchBox.querySelector(".submit");

    if (inputEl) {
        // Ketik-ketik -> perbarui saran sesuai filter yang lagi aktif
        inputEl.addEventListener("input", tampilkanSaranPencarian);
        inputEl.addEventListener("focus", tampilkanSaranPencarian);

        // Tekan Enter di kotak pencarian -> langsung cari
        inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                sembunyikanSaranPencarian();
                jalankanPencarian(getFilterAktif(), inputEl.value);
            }
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const filterType = getFilterAktif();
            const query = inputEl ? inputEl.value.trim() : "";

            // Filter "tags" + kotak kosong -> tampilkan semua tag dulu,
            // biar user tinggal klik salah satu tag, bukan langsung nyasar ke hasil kosong
            if (filterType === "tags" && !query) {
                tampilkanSemuaTag();
                return;
            }

            sembunyikanSaranPencarian();
            jalankanPencarian(filterType, query);
        });
    }
});