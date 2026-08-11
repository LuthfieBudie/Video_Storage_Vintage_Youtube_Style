// ============================================================
// SHORTS FEED (shorts.html)
// Gabungan video (DRIVE_FOLDER_ID) + foto (DRIVE_PHOTO_FOLDER_ID) yang
// diacak jadi satu feed vertikal, mirip YouTube Shorts / TikTok.
// Naik-turun antar short pakai scroll-snap CSS bawaan browser, jadi
// otomatis bisa dipakai lewat mouse wheel (desktop) maupun swipe jari
// (HP) tanpa perlu library tambahan. Fungsi & konstanta di bawah ini
// memakai ulang yang sudah ada di gdrive.js (harus dimuat sebelum file
// ini): GDRIVE_API_KEY, DRIVE_FOLDER_ID, DRIVE_PHOTO_FOLDER_ID,
// fetchFileListFromFolder, isVideoFile, isImageFile, parseVideoFileName,
// ambilRandom.
// ============================================================

// Bangun satu slide short untuk file video: <video> di-mute+loop+playsinline
// biar autoplay diizinkan browser. src asli baru dipasang belakangan
// (data-src) supaya tidak semua video di-load sekaligus (hemat bandwidth).
function buatSlideShortsVideo(file) {
    const parsed = parseVideoFileName(file.name);
    const streamSrc = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_API_KEY}`;
    const posterSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;

    return `
        <div class="short-slide" data-type="video" data-file-id="${file.id}">
            <video class="short-media" data-src="${streamSrc}" poster="${posterSrc}" muted loop playsinline preload="metadata"></video>
            <div class="short-controls">
                <button class="short-mute-btn" type="button" aria-label="Mute/Unmute"><i class="fa-solid fa-volume-xmark"></i></button>
            </div>
            <div class="short-progress" aria-label="Seek video">
                <div class="short-progress-track">
                    <div class="short-progress-fill"></div>
                </div>
            </div>
            <div class="short-overlay">
                <p class="short-title">${parsed.title || "Untitled"}</p>
                ${parsed.channel ? `<p class="short-channel">@${parsed.channel}</p>` : ""}
                ${parsed.category ? `<p class="short-category">Category: ${parsed.category}</p>` : ""}
                ${parsed.description ? `<p class="short-desc">${parsed.description}</p>` : ""}
            </div>
        </div>
    `;
}

// Bangun satu slide short untuk file foto: gambar full-cover polos + info singkat.
function buatSlideShortsFoto(file) {
    const parsed = parseVideoFileName(file.name);
    const fullSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;

    return `
        <div class="short-slide" data-type="photo" data-file-id="${file.id}">
            <img class="short-media" src="${fullSrc}" alt="" loading="lazy">
            <div class="short-overlay">
                <p class="short-title">${parsed.title || "Photo"}</p>
                ${parsed.channel ? `<p class="short-channel">@${parsed.channel}</p>` : ""}
            </div>
        </div>
    `;
}

function buatSlideShorts(file) {
    return file.__shortType === "video" ? buatSlideShortsVideo(file) : buatSlideShortsFoto(file);
}

// Pasang src asli video (dari data-src) dan mulai buffer-nya lebih awal,
// dipanggil untuk slide yang sedang aktif MAUPUN tetangganya (sebelum &
// sesudah) supaya pas discroll, video sudah setengah/sudah ke-buffer dan
// langsung muter tanpa jeda loading yang lama.
function preloadVideoSrc(slide) {
    if (!slide) return;
    const video = slide.querySelector("video.short-media");
    if (!video || video.src || !video.dataset.src) return;
    video.preload = "auto";
    video.src = video.dataset.src; // assign src saja sudah otomatis memicu loading, tidak perlu .load() lagi
}

// Preferensi suara global: begitu user pernah klik unmute, short berikutnya
// juga dicoba diputar dengan suara. Defaultnya true supaya begitu halaman
// dibuka, short pertama langsung dicoba autoplay BERSUARA dulu; kalau
// browser memblokirnya (kebijakan autoplay), otomatis jatuh ke mode mute.
let shortsSoundEnabled = true;

// Pasang IntersectionObserver di dalam #shortsFeed: video di-play otomatis
// hanya kalau slide-nya sedang dominan terlihat, sisanya di-pause supaya
// suara/CPU tidak numpuk (persis behaviour Shorts/Reels/TikTok). Video yang
// baru saja ditinggalkan langsung di-reset ke detik 0, jadi kalau user
// scroll balik lagi ke situ, videonya mulai dari awal lagi (bukan
// melanjutkan dari posisi terakhir).
function setupShortsObserver(feed) {
    const slides = feed.querySelectorAll(".short-slide");

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            try {
                const slide = entry.target;
                const video = slide.querySelector("video.short-media");

                // Preload lebih awal begitu slide mulai kelihatan (belum perlu nunggu dominan penuh)
                if (entry.isIntersecting) {
                    preloadVideoSrc(slide);
                    preloadVideoSrc(slide.nextElementSibling);
                    preloadVideoSrc(slide.previousElementSibling);
                }

                if (!video) return;

                if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                    video.muted = !shortsSoundEnabled;
                    video.play().catch(() => {
                        // Browser blokir autoplay bersuara -> jatuh ke mode mute otomatis
                        video.muted = true;
                        video.play().catch(() => {
                            // Kalau tetap gagal, biarkan user klik untuk play manual
                        });
                    });
                    updateMuteIcon(slide, video.muted);
                    slide.classList.add("active-slide");
                } else {
                    video.pause();
                    // Reset ke awal cuma kalau video-nya sudah punya sumber (src) yang ke-assign.
                    // Kalau belum ada src sama sekali (slide yang jauh, belum pernah di-preload),
                    // set currentTime akan error dan bisa menghentikan proses slide lain
                    // (termasuk slide yang seharusnya autoplay) -> makanya video sempat gagal muter sendiri.
                    if (video.src) {
                        video.currentTime = 0;
                    }
                    const fill = slide.querySelector(".short-progress-fill");
                    if (fill) fill.style.width = "0%";
                    slide.classList.remove("active-slide");
                }
            } catch (err) {
                console.error("Shorts observer error:", err);
            }
        });
    }, { root: feed, threshold: [0, 0.6, 1] });

    slides.forEach((slide) => observer.observe(slide));
}

function updateMuteIcon(slide, muted) {
    const icon = slide.querySelector(".short-mute-btn i");
    if (!icon) return;
    icon.className = muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
}

// Update lebar bar progress mengikuti posisi putar video saat ini.
function pasangProgressListener(feed) {
    feed.addEventListener("timeupdate", (e) => {
        const video = e.target;
        if (!video.matches || !video.matches("video.short-media")) return;
        const slide = video.closest(".short-slide");
        const fill = slide && slide.querySelector(".short-progress-fill");
        if (fill && video.duration) {
            fill.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }
    }, true); // 'timeupdate' tidak bubbling, jadi harus di-tangkap fase capture
}

// Hitung posisi klik/drag pada progress bar lalu loncatkan video.currentTime
// ke posisi tersebut (persis fitur seek bar YouTube/TikTok).
function seekDariPointer(e, bar, video) {
    if (!video.duration) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const rasio = rect.width ? x / rect.width : 0;
    video.currentTime = rasio * video.duration;
    const fill = bar.querySelector(".short-progress-fill");
    if (fill) fill.style.width = `${rasio * 100}%`;
}

// Klik SEKALI atau klik-tahan-geser di progress bar -> video loncat ke detik
// yang ditunjuk. Dipasang lewat event delegation di #shortsFeed supaya
// otomatis berlaku untuk semua slide video, termasuk yang baru dirender.
function setupShortsProgress(feed) {
    let bar = null;
    let video = null;

    feed.addEventListener("pointerdown", (e) => {
        const target = e.target.closest(".short-progress");
        if (!target) return;
        e.stopPropagation(); // jangan sampai memicu drag-scroll / toggle play-pause

        const slide = target.closest(".short-slide");
        video = slide && slide.querySelector("video.short-media");
        if (!video) return;

        bar = target;
        bar.setPointerCapture(e.pointerId);
        seekDariPointer(e, bar, video);
    });

    feed.addEventListener("pointermove", (e) => {
        if (!bar || !video) return;
        seekDariPointer(e, bar, video);
    });

    function selesaiSeek() {
        bar = null;
        video = null;
    }
    feed.addEventListener("pointerup", selesaiSeek);
    feed.addEventListener("pointercancel", selesaiSeek);
}

function isShortsFeedInViewport(feed) {
    const rect = feed.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
}

function scrollShortsBy(feed, direction) {
    feed.scrollBy({ top: direction * feed.clientHeight, behavior: "smooth" });
}

function updateShortsCounter(feed) {
    const counter = document.getElementById("shortsCounter");
    if (!counter) return;

    const totalSlide = feed.querySelectorAll(".short-slide").length;
    const tinggiSlide = feed.clientHeight || 1;
    const indexSekarang = Math.round(feed.scrollTop / tinggiSlide);

    counter.textContent = `${Math.min(indexSekarang + 1, totalSlide)} / ${totalSlide}`;
}

// Drag pakai mouse (klik-tahan lalu tarik ke atas/bawah) buat pindah short,
// setara dengan swipe jari di HP yang sudah otomatis jalan lewat scroll
// bawaan browser. Touch dibiarkan pakai scroll native (lebih mulus & sudah
// mendukung inertia bawaan OS), jadi drag manual ini cuma aktif untuk mouse.
function setupShortsDrag(feed) {
    let isPointerDown = false;
    let isDragging = false; // baru true begitu gerakan drag beneran terdeteksi
    let startY = 0;
    let startScrollTop = 0;
    let pointerId = null;

    feed.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") return; // touch pakai scroll native
        if (e.target.closest(".short-mute-btn") || e.target.closest(".short-progress")) return; // biar tombol mute & seek bar tetap bisa diklik normal

        isPointerDown = true;
        isDragging = false;
        startY = e.clientY;
        startScrollTop = feed.scrollTop;
        pointerId = e.pointerId;
    });

    feed.addEventListener("pointermove", (e) => {
        if (!isPointerDown) return;
        const delta = e.clientY - startY;

        // Baru dianggap "drag" (dan baru capture pointer) begitu gerakannya
        // melewati ambang batas. Kalau langsung capture di pointerdown, klik
        // biasa (tanpa gerak) ikut ke-capture juga dan bikin event click
        // browser salah sasaran (targetnya jadi feed, bukan video yang
        // diklik) -> itu penyebab tombol pause sempat gak berfungsi.
        if (!isDragging && Math.abs(delta) > 4) {
            isDragging = true;
            feed.classList.add("dragging");
            feed.setPointerCapture(pointerId);
        }

        if (isDragging) {
            feed.scrollTop = startScrollTop - delta;
        }
    });

    function selesaiDrag() {
        if (!isPointerDown) return;
        const sedangDrag = isDragging;
        isPointerDown = false;
        isDragging = false;

        if (sedangDrag) {
            feed.classList.remove("dragging");
            // Snap manual ke short terdekat setelah dilepas
            const tinggiSlide = feed.clientHeight || 1;
            const indexTerdekat = Math.round(feed.scrollTop / tinggiSlide);
            feed.scrollTo({ top: indexTerdekat * tinggiSlide, behavior: "smooth" });
        }

        // Simpan status "abis drag" biar klik yang menyusul tidak dianggap tap play/pause
        feed.dataset.justDragged = sedangDrag ? "true" : "false";
    }

    feed.addEventListener("pointerup", selesaiDrag);
    feed.addEventListener("pointercancel", selesaiDrag);
    feed.addEventListener("pointerleave", () => { if (isPointerDown) selesaiDrag(); });
}

// Klik video -> toggle play/pause. Klik tombol speaker -> toggle mute.
// Tombol panah atas/bawah + tombol keyboard ArrowUp/ArrowDown -> pindah short
// (di atas scroll-snap CSS yang sudah otomatis jalan lewat mouse wheel & swipe).
function setupShortsControls(feed) {
    feed.addEventListener("click", (e) => {
        // Kalau klik ini adalah ekor dari drag mouse, jangan toggle play/pause
        if (feed.dataset.justDragged === "true") {
            feed.dataset.justDragged = "false";
            return;
        }

        const muteBtn = e.target.closest(".short-mute-btn");
        const progressBar = e.target.closest(".short-progress");
        if (progressBar) return; // klik/seek di progress bar jangan sampai toggle play-pause juga

        const slide = e.target.closest(".short-slide") || feed.querySelector(".short-slide.active-slide");
        if (!slide) return;

        const video = slide.querySelector("video.short-media");
        if (!video) return;

        if (muteBtn) {
            video.muted = !video.muted;
            shortsSoundEnabled = !video.muted; // ingat preferensi user buat short berikutnya
            updateMuteIcon(slide, video.muted);
            return;
        }

        if (video.paused) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    });

    feed.addEventListener("scroll", () => updateShortsCounter(feed));

    document.addEventListener("keydown", (e) => {
        if (!isShortsFeedInViewport(feed)) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            scrollShortsBy(feed, 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            scrollShortsBy(feed, -1);
        }
    });

    const prevBtn = document.getElementById("shortsPrevBtn");
    const nextBtn = document.getElementById("shortsNextBtn");
    if (prevBtn) prevBtn.addEventListener("click", () => scrollShortsBy(feed, -1));
    if (nextBtn) nextBtn.addEventListener("click", () => scrollShortsBy(feed, 1));
}

async function initShorts() {
    const feed = document.getElementById("shortsFeed");
    if (!feed) return; // bukan shorts.html, skip

    try {
        const [videoFiles, photoFiles] = await Promise.all([
            fetchFileListFromFolder(DRIVE_FOLDER_ID),
            fetchFileListFromFolder(DRIVE_PHOTO_FOLDER_ID)
        ]);

        const videos = videoFiles.filter(isVideoFile).map((f) => ({ ...f, __shortType: "video" }));
        const photos = photoFiles.filter(isImageFile).map((f) => ({ ...f, __shortType: "photo" }));

        const gabungan = [...videos, ...photos];
        const items = ambilRandom(gabungan, gabungan.length); // acak urutan videp & foto

        if (!items.length) {
            feed.innerHTML = "<p class='shorts-loading'>Belum ada video maupun foto.</p>";
            return;
        }

        feed.innerHTML = items.map(buatSlideShorts).join("");

        // Langsung mulai buffer video pertama & kedua begitu dirender, jangan
        // nunggu IntersectionObserver sempat jalan, biar short pertama pas
        // dibuka bisa langsung muter tanpa jeda loading.
        const semuaSlide = feed.querySelectorAll(".short-slide");
        preloadVideoSrc(semuaSlide[0]);
        preloadVideoSrc(semuaSlide[1]);

        setupShortsObserver(feed);
        setupShortsControls(feed);
        setupShortsDrag(feed);
        setupShortsProgress(feed);
        pasangProgressListener(feed);
        updateShortsCounter(feed);
    } catch (err) {
        console.error("Gagal memuat shorts:", err);
        feed.innerHTML = "<p class='shorts-loading'>Gagal memuat konten. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", initShorts);