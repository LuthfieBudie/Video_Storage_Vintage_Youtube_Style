


const GDRIVE_API_KEY = "AIzaSyA5HcMQPSCTGkGPWiig8Nx1V77p0X8mFQ4";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzTZJ7fgf6w_OkVa3Yv2zFGmKmZP3TZ_MPci_q9Kd-6l41Nr-rBOKMz7lzIyAZTJp9dfg/exec";






async function fetchDriveMetadata(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,createdTime,videoMediaMetadata&key=${GDRIVE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gagal ambil metadata file (${res.status}): ${errBody}`);
    }
    return res.json();
}




// Duration
function formatDuration(durationMillis) {
    if (!durationMillis) return "00:00";

    const totalSeconds = Math.floor(Number(durationMillis) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, "0");

    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
}






// Added file format from Gdrive  
// Ubah tanggal ISO dari Google Drive (createdTime) jadi format "5 Agustus 2026"
function formatDate(isoString) {
    if (!isoString) return "-";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}





// ============================================================
// PARSING NAMA FILE VIDEO
// Format nama file yang didukung di Google Drive (semua bagian OPSIONAL,
// boleh ada boleh tidak, urutan bebas):
//
//   Judul Video /Channel/ (Category) [Tag1, Tag2] {Deskripsi}.mp4
//
// Contoh:
//   Ref do something! He's spamming! Help! /ben10/ (music) [Gaming, gamer, beauty, vlog, tech, funny] {Lorem ipsum dolor sit amet...}.mp4
//
// Hasil parsing:
//   title       -> "Ref do something! He's spamming! Help!"
//   channel     -> "ben10"       (dari /.../  -> tampil di "From: ")
//   category    -> "music"       (dari (...)  -> tampil di "Category: ")
//   tags        -> "Gaming, gamer, beauty, vlog, tech, funny"  (dari [...] -> "Tags: ")
//   description -> "Lorem ipsum dolor sit amet..."             (dari {...})
// ============================================================
function parseVideoFileName(rawFileName) {
    // 1. Buang ekstensi file (.mp4, .mov, dll) dulu
    const nameNoExt = rawFileName.replace(/\.[^/.]+$/, "");

    let sisa = nameNoExt;

    // 2. Channel: teks di antara dua garis miring /.../
    const channelMatch = sisa.match(/\/([^/]+)\//);
    const channel = channelMatch ? channelMatch[1].trim() : "";
    if (channelMatch) sisa = sisa.replace(channelMatch[0], " ");

    // 3. Category: teks di dalam kurung biasa (...)
    const categoryMatch = sisa.match(/\(([^)]+)\)/);
    const category = categoryMatch ? categoryMatch[1].trim() : "";
    if (categoryMatch) sisa = sisa.replace(categoryMatch[0], " ");

    // 4. Tags: teks di dalam kurung siku [...]
    const tagsMatch = sisa.match(/\[([^\]]+)\]/);
    const tags = tagsMatch ? tagsMatch[1].trim() : "";
    if (tagsMatch) sisa = sisa.replace(tagsMatch[0], " ");

    // 5. Deskripsi: teks di dalam kurung kurawal {...}
    const descMatch = sisa.match(/\{([^}]+)\}/);
    const description = descMatch ? descMatch[1].trim() : "";
    if (descMatch) sisa = sisa.replace(descMatch[0], " ");

    // 6. Figma/UI-UX label: teks di antara dua tanda dolar $...$
    const figmaMatch = sisa.match(/\$([^$]+)\$/);
    const figma = figmaMatch ? figmaMatch[1].trim() : "";
    if (figmaMatch) sisa = sisa.replace(figmaMatch[0], " ");

    // 7. Sisa teks (setelah semua bagian di atas dibuang) = judul asli.
    //    Rapikan spasi ganda/berlebih jadi satu spasi saja.
    const title = sisa.replace(/\s+/g, " ").trim();

    return { title, channel, category, tags, description, figma };
}

// Fetch nama folder induk lewat Apps Script (dijalankan sebagai akun pemilik Drive,
// jadi tidak kena batasan "parents" yang disembunyikan untuk request anonim)
async function fetchFolderNameViaAppsScript(fileId) {
    const url = `${APPS_SCRIPT_URL}?fileId=${encodeURIComponent(fileId)}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Apps Script gagal (${res.status})`);
    }
    const data = await res.json();
    if (data.error) {
        throw new Error(`Apps Script error: ${data.error}`);
    }
    return data.folderName;
}

async function syncVideoCard(card) {
    const fileId = card.dataset.fileId;
    if (!fileId) return;

    const wrapper = card.parentElement;
    const titleEl = wrapper.querySelector('.feature_video_title');
    const durationEl = wrapper.querySelector('.feature_video_duration');
    const categoryEl = wrapper.querySelector('.feature_video_category');
    const channelEl = wrapper.querySelector('.feature_video_channel');
    const tagsEl = wrapper.querySelector('.feature_video_tags');
    const descriptionEl = wrapper.querySelector('.feature_video_description');
    const addedEl = wrapper.querySelector('.feature_video_added');

    if (!titleEl) {
        console.warn("Tidak menemukan .feature_video_title untuk file:", fileId);
        return;
    }

    try {
        const meta = await fetchDriveMetadata(fileId);
        console.log("Metadata diterima:", meta);

        // Pecah nama file asli jadi title, channel, category, tags, deskripsi
        const parsed = parseVideoFileName(meta.name);

        titleEl.textContent = parsed.title;

        const durationMillis = meta.videoMediaMetadata?.durationMillis;
        // Simpan durasi asli (ms) di kartu, dipakai fitur Loop supaya tahu kapan harus restart video
        card.dataset.durationMillis = durationMillis || 0;

        if (durationEl) {
            durationEl.textContent = formatDuration(durationMillis);
        }

        if (categoryEl) {
            categoryEl.textContent = "Category: " + (parsed.category || "Uncategorized");
        }

        if (channelEl) {
            channelEl.textContent = "From: " + (parsed.channel || "Unknown");
        }

        if (tagsEl) {
            tagsEl.textContent = "Tags: " + (parsed.tags || "-");
        }

        if (descriptionEl) {
            descriptionEl.textContent = parsed.description || "";
        }

        if (addedEl) {
            addedEl.textContent = "Added: " + formatDate(meta.createdTime);
        }

    } catch (err) {
        console.error("Sync gagal untuk file:", fileId, err);
        titleEl.textContent = "Gagal memuat judul (cek Console - F12)";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const cards = document.querySelectorAll(".video-card[data-file-id]");
    console.log(`Ditemukan ${cards.length} video-card dengan data-file-id`);
    cards.forEach(syncVideoCard);
});


// ============================================================
// RENDER OTOMATIS DARI FOLDER GOOGLE DRIVE (untuk videos.html)
// ============================================================

// Ganti dengan ID folder Google Drive kamu (dari URL folder, setelah /folders/)
const DRIVE_FOLDER_ID = "1EJk31gXdhMCOCyYOBe8XGK9tIzOJ_3Hi";

// Ambil daftar semua video di dalam folder tersebut lewat Apps Script
// Cache: setiap folderId cuma di-fetch SEKALI, hasilnya dipakai ulang oleh
// semua fitur (channel map, search index, render video/foto, dll). Sebelumnya
// tiap fitur fetch sendiri-sendiri secara bersamaan saat halaman dimuat,
// bikin request menumpuk ke Apps Script dan halaman jadi lambat/macet.
const folderListCache = {};

async function fetchFileListFromFolder(folderId) {
    if (folderListCache[folderId]) {
        return folderListCache[folderId]; // sudah pernah di-fetch (atau sedang di-fetch) -> pakai promise yang sama
    }

    const promise = (async () => {
        const url = `${APPS_SCRIPT_URL}?action=listFiles&folderId=${encodeURIComponent(folderId)}`;
        const res = await fetch(url);
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Gagal ambil daftar file (${res.status}): ${errBody}`);
        }
        return res.json();
    })();

    folderListCache[folderId] = promise;

    try {
        return await promise;
    } catch (err) {
        delete folderListCache[folderId]; // gagal -> jangan cache, biar bisa dicoba ulang nanti
        throw err;
    }
}

// ============================================================
// FILTER: HANYA VIDEO YANG BOLEH TAMPIL (foto/dokumen dibuang)
// ============================================================

// Daftar ekstensi yang dianggap video, dipakai sebagai cadangan
// kalau Apps Script tidak mengirim field mimeType.
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi", "m4v", "3gp", "wmv"];

function isVideoFile(file) {
    // Cara paling akurat: cek mimeType asli dari Google Drive (contoh: "video/mp4")
    if (file.mimeType) {
        return file.mimeType.startsWith("video/");
    }

    // Cadangan kalau Apps Script belum mengirim mimeType: tebak dari ekstensi nama file
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}

// Bangun HTML satu kartu video dengan desain sama seperti "Featured Videos" di index.html
function buatKartuVideo(file, index) {
    const nomor = index + 1;
    // Google Drive punya endpoint thumbnail bawaan, tidak perlu field thumbnailUrl manual
    const thumbSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;

    // Pecah nama file jadi title & category (channel/tags/description dipakai di play.html)
    const parsed = parseVideoFileName(file.name);

    return `
        <div class="feature_video">
            <div class="video-card" data-file-id="${file.id}">
                <div class="thumbnail-container" id="thumbContainer${nomor}">
                    <img src="${thumbSrc}" alt="" class="thumbnail-img" loading="lazy">
                    <div class="play_icon">▶</div>
                </div>
            </div>
            <div class="video_feature_description">
                <a class="feature_video_title" href="#">${parsed.title}</a>
                <p class="feature_video_duration">--:--</p>
                <p class="feature_video_description">${parsed.description || ""}</p>
                <p class="feature_video_tags">Tags: ${parsed.tags || "-"}</p>
                <div class="feature_added_category">
                    <p class="feature_video_added">Added: Loading...</p>
                    <p class="feature_video_category">Category: ${parsed.category || "Uncategorized"}</p>
                </div>
                <p class="feature_video_channel">From: ${parsed.channel || "Unknown"}</p>
            </div>
        </div>
    `;
}

// Setelah kartu-kartu video dirender (title & category sudah langsung tampil dari nama file),
// panggil syncVideoCard untuk tiap kartu supaya durasi & tanggal "Added" ikut ke-fetch dari Drive
function syncAllVideoCards(container) {
    container.querySelectorAll(".video-card[data-file-id]").forEach(syncVideoCard);
}

// Klik thumbnail di videos.html -> pindah ke play.html sambil bawa fileId + title-nya
// (dipasang lewat addEventListener, bukan onclick inline, supaya aman dari nama file yang mengandung tanda kutip)
function pasangKlikPindahKePlay(container) {
    container.querySelectorAll(".video-card[data-file-id]").forEach((card) => {
        const thumb = card.querySelector(".thumbnail-container");
        const titleEl = card.parentElement.querySelector(".feature_video_title");

        const pindahKePlay = () => {
            const fileId = card.dataset.fileId;
            const title = titleEl ? titleEl.textContent.trim() : "";

            const params = new URLSearchParams();
            params.set("id", fileId);
            if (title) params.set("title", title);

            window.location.href = `play.html?${params.toString()}`;
        };

        if (thumb) thumb.addEventListener("click", pindahKePlay);

        if (titleEl) {
            titleEl.addEventListener("click", (e) => {
                e.preventDefault(); // judul cuma <a href="#">, cegah lompat ke atas halaman
                pindahKePlay();
            });
        }
    });
}

// Dipanggil saat thumbnail diklik: sembunyikan thumbnail, tampilkan player video asli
function muatVideoDinamis(fileId, nomor) {
    const thumb = document.getElementById('thumbContainer' + nomor);
    if (thumb) thumb.style.display = 'none';

    const player = document.getElementById('driveVideo' + nomor);
    if (!player) return;

    // Streaming langsung dari Google Drive API (bukan iframe /preview lagi),
    // supaya elemennya jadi <video> asli: native loop & native fullscreen (kayak YouTube)
    player.src = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GDRIVE_API_KEY}`;
    player.loop = !!(typeof loopState !== 'undefined' && loopState[nomor]);
    player.style.display = 'block';
    player.play().catch((err) => console.warn('Autoplay diblokir browser, user perlu klik play manual:', err));
}

// Dipanggil saat tombol play di play.html diklik: ambil fileId dari data-file-id kartu itu sendiri
function playCurrentVideo(nomor) {
    const thumb = document.getElementById('thumbContainer' + nomor);
    const card = thumb ? thumb.closest('.video-card') : null;
    const fileId = card ? card.dataset.fileId : null;
    if (!fileId) return;
    muatVideoDinamis(fileId, nomor);
}

// ============================================================
// ISI OTOMATIS KOTAK HITAM DI play.html DARI VIDEO YANG DIKLIK
// ============================================================
function initPlayPage() {
    // Kartu play.html tidak lagi punya data-file-id bawaan di HTML, cari lewat thumbContainer1
    const thumb = document.getElementById('thumbContainer1');
    const targetCard = thumb ? thumb.closest('.video-card') : null;
    if (!targetCard) return; // bukan halaman play.html

    const params = new URLSearchParams(window.location.search);
    const fileId = params.get('id');
    const title = params.get('title');

    const wrapper = targetCard.parentElement;
    const titleEl = wrapper.querySelector('.feature_video_title');
    const thumbImg = targetCard.querySelector('.thumbnail-img');

    if (!fileId) {
        // Tidak ada video yang dipilih (misalnya buka play.html langsung) -> kosongkan saja
        if (titleEl) titleEl.textContent = "";
        return;
    }

    targetCard.dataset.fileId = fileId;

    if (thumbImg) thumbImg.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;

    // Tampilkan dulu title dari URL (biar langsung muncul), nanti ditimpa oleh syncVideoCard
    // dengan judul asli dari Google Drive begitu selesai di-fetch
    if (titleEl) {
        titleEl.textContent = title || "Loading...";
        titleEl.href = `https://drive.google.com/file/d/${fileId}/view`;
    }

    // Ambil judul, durasi, dan kategori asli dari Google Drive (fungsi yang sudah ada di atas)
    syncVideoCard(targetCard);
}

document.addEventListener("DOMContentLoaded", initPlayPage);

function getchannelFilterFromURL() {
    const params = new URLSearchParams(window.location.search);
    const kategori = params.get("from");
    return kategori ? kategori.trim() : null;
}

// Update judul "Featured Videos" di videos.html supaya nunjukin filter yang lagi aktif
// + kasih link "Clear filter" buat balik nampilin semua video
function updatechannelListHeading(categoryFilter, jumlahHasil) {
    const heading = document.querySelector("#channelContainer")?.closest(".trending")?.querySelector(".trending_title");
    if (!heading) return;

    if (categoryFilter) {
        heading.innerHTML = `Videos & Photos - ${categoryFilter} (${jumlahHasil}) <a href="channels.html" style="float:right; font-weight:normal; font-size:12px;">Clear filter</a>`;
    } else {
        heading.textContent = "Channels";
    }
}

// Ambil nama kategori yang aktif dari URL, kalau ada (?category=Music)
function getCategoryFilterFromURL() {
    const params = new URLSearchParams(window.location.search);
    const kategori = params.get("category");
    return kategori ? kategori.trim() : null;
}

// Update judul "Featured Videos" di videos.html supaya nunjukin filter yang lagi aktif
// + kasih link "Clear filter" buat balik nampilin semua video
function updateVideoListHeading(categoryFilter, jumlahHasil) {
    const heading = document.querySelector("#videoContainer")?.closest(".trending")?.querySelector(".trending_title");
    if (!heading) return;

    if (categoryFilter) {
        heading.innerHTML = `Videos - ${categoryFilter} (${jumlahHasil}) <a href="videos.html" style="float:right; font-weight:normal; font-size:12px;">Clear filter</a>`;
    } else {
        heading.textContent = "Featured Videos";
    }
}

// Ambil daftar video dari folder Drive lalu render semua kartunya ke #videoContainer
async function renderVideoList() {
    const container = document.getElementById("videoContainer");
    if (!container) return; // halaman ini tidak punya container otomatis, skip

    const categoryFilter = getCategoryFilterFromURL();

    try {
        const semuaFile = await fetchFileListFromFolder(DRIVE_FOLDER_ID);
        let files = semuaFile.filter(isVideoFile); // <- foto/file lain dibuang di sini

        // Kalau ada filter kategori di URL, saring lagi berdasarkan (...) di nama file
        if (categoryFilter) {
            files = files.filter((file) => {
                const parsed = parseVideoFileName(file.name);
                return parsed.category.toLowerCase() === categoryFilter.toLowerCase();
            });
        }

        updateVideoListHeading(categoryFilter, files.length);

        if (!files.length) {
            container.innerHTML = categoryFilter
                ? `<p style='padding:10px;'>Tidak ada video dengan kategori "${categoryFilter}".</p>`
                : "<p style='padding:10px;'>Belum ada video di folder ini.</p>";
            return;
        }

        container.innerHTML = files.map(buatKartuVideo).join("");
        pasangKlikPindahKePlay(container);
        syncAllVideoCards(container);
    } catch (err) {
        console.error("Gagal render daftar video:", err);
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat video. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderVideoList);


// ============================================================
// RENDER OTOMATIS FOTO DARI FOLDER GOOGLE DRIVE (untuk photo.html)
// ============================================================

// Ganti dengan ID folder Google Drive khusus foto (dari URL folder, setelah /folders/)
const DRIVE_PHOTO_FOLDER_ID = "1EJk31gXdhMCOCyYOBe8XGK9tIzOJ_3Hi";

// Ekstensi cadangan kalau Apps Script tidak mengirim mimeType
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "tiff"];

function isImageFile(file) {
    if (file.mimeType) {
        return file.mimeType.startsWith("image/");
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

// Bangun satu kartu foto: hanya gambar, tanpa teks (gaya media X/Twitter)
function buatKartuFoto(file) {
    const thumbSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w500`;
    const fullSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;

    return `
        <div class="photo-item" data-file-id="${file.id}" data-full-src="${fullSrc}">
            <img src="${thumbSrc}" alt="" class="photo-thumb" loading="lazy">
        </div>
    `;
}

// Update judul "Feature Photos" supaya nunjukin filter yang lagi aktif
// + kasih link "Clear filter" buat balik nampilin semua foto
function updatePhotoListHeading(categoryFilter, jumlahHasil) {
    const heading = document.querySelector("#photoContainer")?.closest(".trending")?.querySelector(".trending_title");
    if (!heading) return;

    if (categoryFilter) {
        heading.innerHTML = `Photos - ${categoryFilter} (${jumlahHasil}) <a href="photo.html" style="float:right; font-weight:normal; font-size:12px;">Clear filter</a>`;
    } else {
        heading.textContent = "Feature Photos";
    }
}

// Ambil daftar foto dari folder Drive lalu render ke #photoContainer
async function renderPhotoList() {
    const container = document.getElementById("photoContainer");
    if (!container) return; // halaman ini tidak punya container foto, skip

    // Format nama file foto: "Judul /Channel/ (Category)" -> parseVideoFileName
    // sudah generic, jadi bisa dipakai ulang (tags & deskripsi cukup diabaikan)
    const categoryFilter = getCategoryFilterFromURL();

    try {
        const semuaFile = await fetchFileListFromFolder(DRIVE_PHOTO_FOLDER_ID);
        let files = semuaFile.filter(isImageFile); // <- video/file lain dibuang di sini

        // Kalau ada filter kategori di URL, saring lagi berdasarkan (...) di nama file
        if (categoryFilter) {
            files = files.filter((file) => {
                const parsed = parseVideoFileName(file.name);
                return parsed.category.toLowerCase() === categoryFilter.toLowerCase();
            });
        }

        updatePhotoListHeading(categoryFilter, files.length);

        if (!files.length) {
            container.innerHTML = categoryFilter
                ? `<p style='padding:10px;'>Tidak ada foto dengan kategori "${categoryFilter}".</p>`
                : "<p style='padding:10px;'>No photo available.</p>";
            return;
        }

        container.innerHTML = files.map(buatKartuFoto).join("");

        // Aktifkan fitur zoom (dari zoom.js) untuk kartu-kartu yang baru dirender
        if (window.initZoom) {
            window.initZoom(container);
        }
    } catch (err) {
        console.error("Gagal render daftar foto:", err);
        container.innerHTML = "<p style='padding:10px;'>Failed to load photo.</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderPhotoList);


// ============================================================
// UTILITY: ambil N item secara acak dari sebuah array
// (dipakai untuk section Trending & Featured Videos di index.html)
// ============================================================
function ambilRandom(array, jumlah) {
    const hasil = [...array];
    // Fisher-Yates shuffle biar benar-benar acak
    for (let i = hasil.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
    }
    return hasil.slice(0, jumlah);
}


// ============================================================
// TRENDING (index.html) -> 3 FOTO ACAK DARI FOLDER FOTO
// Klik foto -> buka zoom (bukan pindah halaman)
// ============================================================

// Kartu foto untuk section Trending, pakai desain tren-video-card yang sudah ada,
// tapi isinya cuma gambar polos (tanpa play icon, tanpa iframe video)
function buatKartuFotoTrending(file) {
    const thumbSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;
    const fullSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;

    return `
        <div class="video_items">
            <div class="tren-video-card photo-item" data-file-id="${file.id}" data-full-src="${fullSrc}">
                <div class="thumbnail-container">
                    <img src="${thumbSrc}" alt="" class="thumbnail-img" loading="lazy">
                </div>
            </div>
        </div>
    `;
}

async function renderTrendingPhotos() {
    const container = document.getElementById("trendingPhotoContainer");
    if (!container) return; // bukan index.html, skip

    try {
        const semuaFile = await fetchFileListFromFolder(DRIVE_PHOTO_FOLDER_ID);
        const files = semuaFile.filter(isImageFile);

        if (!files.length) {
            container.innerHTML = "<p style='padding:10px;'>Belum ada foto.</p>";
            return;
        }

        const tigaAcak = ambilRandom(files, 3);
        container.innerHTML = tigaAcak.map(buatKartuFotoTrending).join("");

        // Pasang fitur zoom (dari zoom.js) ke 3 foto yang baru dirender
        if (window.initZoom) {
            window.initZoom(container);
        }
    } catch (err) {
        console.error("Gagal render foto trending:", err);
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat foto. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderTrendingPhotos);


// ============================================================
// FEATURED VIDEOS (index.html) -> 7 VIDEO ACAK DARI FOLDER VIDEO
// Klik thumbnail -> pindah ke play.html (sama seperti di videos.html)
// ============================================================

async function renderFeatureVideos() {
    const container = document.getElementById("featureVideoContainer");
    if (!container) return; // bukan index.html, skip

    try {
        const semuaFile = await fetchFileListFromFolder(DRIVE_FOLDER_ID);
        const files = semuaFile.filter(isVideoFile);

        if (!files.length) {
            container.innerHTML = "<p style='padding:10px;'>Belum ada video.</p>";
            return;
        }

        const tujuhAcak = ambilRandom(files, 7);
        // buatKartuVideo sudah ada dari bagian videos.html di atas, dipakai ulang di sini
        container.innerHTML = tujuhAcak.map(buatKartuVideo).join("");

        // Klik thumbnail -> pindah ke play.html (fungsi sudah ada, dipakai ulang)
        pasangKlikPindahKePlay(container);
        syncAllVideoCards(container);
    } catch (err) {
        console.error("Gagal render featured videos:", err);
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat video. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderFeatureVideos);










function isPngAtauJpg(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    return ext === "png" || ext === "jpg" || ext === "jpeg";
}

// Foto profil channel HANYA boleh dipakai kalau nama filenya murni "/NamaChannel/.ext",
// tanpa judul, kategori (...), tags [...], atau deskripsi {...} tambahan.
// Contoh valid   : /ben10/.png
// Contoh TIDAK valid: mountain-scenery /scenery/ (web trailer).jpg -> ada judul & kategori, jadi dilewati (foto profil dikosongkan)
function isNamaFileAvatarValid(parsed) {
    return !parsed.title && !parsed.category && !parsed.tags && !parsed.description;
}

async function buildChannelMap() {
    const [semuaVideo, semuaFoto] = await Promise.all([
        fetchFileListFromFolder(DRIVE_FOLDER_ID),
        fetchFileListFromFolder(DRIVE_PHOTO_FOLDER_ID)
    ]);

    const videos = semuaVideo.filter(isVideoFile);
    const foto = semuaFoto.filter(isImageFile);

    const channelMap = {};

    // Helper: pastikan entry channel ada di map, buat baru kalau belum
    function pastikanChannelAda(namaChannel) {
        if (!channelMap[namaChannel]) {
            channelMap[namaChannel] = { name: namaChannel, videos: [], photos: [], photo: null };
        }
        return channelMap[namaChannel];
    }

    // 1. Kelompokkan video berdasarkan channel (dari /.../ di nama file)
    videos.forEach((file) => {
        const parsed = parseVideoFileName(file.name);
        const namaChannel = parsed.channel || "Unknown";

        pastikanChannelAda(namaChannel).videos.push(file);
    });

    // 2. Kelompokkan SEMUA foto berdasarkan channel juga (bukan cuma avatar),
    //    supaya foto dengan channel yang sama ikut tampil saat channel-nya difilter.
    //    Sekalian pilih 1 foto profil (.png/.jpg) per channel untuk avatar.
    foto.forEach((file) => {
        const parsed = parseVideoFileName(file.name);
        const namaChannel = parsed.channel || "";
        if (!namaChannel) return; // foto tanpa /Channel/ di nama file, lewati

        const data = pastikanChannelAda(namaChannel);
        data.photos.push(file);

        if (isPngAtauJpg(file) && isNamaFileAvatarValid(parsed) && !data.photo) {
            data.photo = file; // avatar: foto .png/.jpg dengan nama murni "/Channel/.ext"
        }
    });

    return channelMap;
}









// Bangun satu kartu foto untuk grid foto milik 1 channel (dipakai di
// renderChannelList, channels.html). Klik -> buka zoom (bukan pindah tab),
// makanya event default-nya di-preventDefault dan initZoom() dipanggil di
// renderChannelList() setelah kartu ini dirender.
function buatKartuFotoChannel(file) {
    const thumbSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;
    const fullSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;

    return `
        <a class="channel_photo_item photo-item" href="${fullSrc}" data-file-id="${file.id}" data-full-src="${fullSrc}" onclick="event.preventDefault();">
            <img src="${thumbSrc}" alt="" class="channel_photo_img" loading="lazy">
        </a>
    `;
}



function buatKartuChannel(channelData) {
    const { name, videos, photos, photo } = channelData;
    const thumbSrc = photo ? `https://drive.google.com/thumbnail?id=${photo.id}&sz=w300` : "";
    const jumlahVideo = videos.length;
    const jumlahFoto = photos.length;

    return `
        <a class="channel-card" href="channels.html?from=${encodeURIComponent(name)}">
            <div class="channel-card-thumb">
                ${photo
                    ? `<img src="${thumbSrc}" alt="${name}" class="channel-card-img" loading="lazy">`
                    : `<div class="channel-card-noimg"></div>`}
            </div>
            <div class="channel-card-info">
                <p class="channel-card-name">${name}</p>
                <p class="channel-card-count">${jumlahVideo} Video${jumlahVideo > 1 ? "s" : ""} &middot; ${jumlahFoto} Photo${jumlahFoto > 1 ? "s" : ""}</p>
            </div>
        </a>
    `;
}









async function renderChannelList() {
    const container = document.getElementById("channelContainer");
    if (!container) return; // bukan channels.html, skip

    const channelFilter = getchannelFilterFromURL();

    try {
        const channelMap = await buildChannelMap();

        if (channelFilter) {
            // MODE: daftar video + foto milik 1 channel
            const data = channelMap[channelFilter];
            const videos = data ? data.videos : [];
            const photos = data ? data.photos : [];
            const totalItem = videos.length + photos.length;

            updatechannelListHeading(channelFilter, totalItem);

            if (!totalItem) {
                container.className = "video_feature_container";
                container.innerHTML = `<p style='padding:10px;'>Tidak ada video maupun foto dari "${channelFilter}".</p>`;
                return;
            }

            container.className = "";

            let html = "";
            if (videos.length) {
                html += `<div class="video_feature_container">${videos.map(buatKartuVideo).join("")}</div>`;
            }
            if (photos.length) {
                html += `<p class="trending_title">Photos</p><div class="channel_photo_grid">${photos.map(buatKartuFotoChannel).join("")}</div>`;
            }

            container.innerHTML = html;
            pasangKlikPindahKePlay(container);
            syncAllVideoCards(container);

            // Pasang fitur zoom (dari zoom.js) ke foto-foto channel yang baru dirender.
            // Ini yang tadinya hilang, makanya klik foto channel belum bisa zoom.
            if (window.initZoom) {
                window.initZoom(container);
            }
        } else {
            // MODE: daftar semua channel
            const daftarChannel = Object.values(channelMap);
            updatechannelListHeading(null, daftarChannel.length);

            if (!daftarChannel.length) {
                container.className = "video_feature_container";
                container.innerHTML = "<p style='padding:10px;'>Belum ada channel.</p>";
                return;
            }

            container.className = "channel_grid";
            container.innerHTML = daftarChannel.map(buatKartuChannel).join("");
        }
    } catch (err) {
        console.error("Gagal render daftar channel:", err);
        container.className = "video_feature_container";
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat channel. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderChannelList);







// Kartu channel khusus untuk section "Active Channels", desainnya beda dari
// "Featured Channels" (buatKartuChannel = channel-card grid). Di sini pakai
// markup channel_item / channel_thumbnail / channel_info seperti contoh statis
// yang ada di index.html & style.css.
function buatKartuActiveChannel(channelData) {
    const { name, videos, photos, photo } = channelData;
    const thumbSrc = photo ? `https://drive.google.com/thumbnail?id=${photo.id}&sz=w150` : "";
    const jumlahVideo = videos.length;
    const jumlahFoto = photos.length;

    return `
        <div class="channel_item">
            <div class="channel_thumbnail">
                ${photo ? `<img src="${thumbSrc}" alt="${name}" style="width:100%;height:100%;object-fit:cover;display:block;">` : ""}
            </div>
            <div class="channel_info">
                <a class="channel_title" href="channels.html?from=${encodeURIComponent(name)}">${name}</a>
                <p class="channel_count">${jumlahVideo} Video${jumlahVideo > 1 ? "s" : ""} &middot; ${jumlahFoto} Photo${jumlahFoto > 1 ? "s" : ""}</p>
            </div>
        </div>
    `;
}

async function renderActiveChannels() {
    const container = document.getElementById("activeChannelContainer");
    if (!container) return; // bukan index.html, skip

    try {
        const channelMap = await buildChannelMap();
        const daftarChannel = Object.values(channelMap);

        if (!daftarChannel.length) {
            container.innerHTML = "<p style='padding:10px;'>Belum ada channel.</p>";
            return;
        }

        const beberapaChannel = ambilRandom(daftarChannel, 3);
        container.innerHTML = beberapaChannel.map(buatKartuActiveChannel).join("");

    } catch (err) {
        console.error("Gagal render active channel:", err);
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat channel.</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderActiveChannels);

// ============================================================
// TOMBOL LOOP & FULLSCREEN UNTUK VIDEO DI play.html
// (memanfaatkan properti/method bawaan <video> asli, bukan iframe lagi)
// ============================================================

// Simpan status loop tiap kartu video (key: nomor kartu -> true/false)
const loopState = {};

// Dipanggil oleh tombol "🔁 Loop".
// Karena playernya sekarang <video> asli, tinggal set properti .loop bawaan
// browser -> otomatis mengulang tepat saat video selesai, tidak perlu hitung
// durasi manual dan tidak kena blokir autoplay browser lagi.
function toggleLoop(nomor) {
    const btn = document.getElementById('loopBtn' + nomor);
    const player = document.getElementById('driveVideo' + nomor);
    if (!btn) return;

    loopState[nomor] = !loopState[nomor];
    btn.classList.toggle('active', loopState[nomor]);
    btn.setAttribute('aria-pressed', loopState[nomor] ? 'true' : 'false');

    if (player) player.loop = loopState[nomor];
}

function requestPlayerFullscreen(player) {
    if (player.requestFullscreen) {
        player.requestFullscreen();
    } else if (player.webkitRequestFullscreen) {
        player.webkitRequestFullscreen();
    } else if (player.webkitEnterFullscreen) {
        // Safari iOS: <video> punya method fullscreen sendiri
        player.webkitEnterFullscreen();
    } else if (player.msRequestFullscreen) {
        player.msRequestFullscreen();
    }
}


// ============================================================
// SEARCH INDEX (dipakai bareng oleh: dropdown saran pencarian
// di semua halaman + halaman hasil pencarian search.html)
//
// Setiap item hasil parsing nama file diubah jadi bentuk generik:
//   { type: "video" | "photo", title, channel, category, tags: [...], figma, file }
// supaya video dan foto bisa dicari dengan cara yang sama.
// ============================================================

let searchIndexPromise = null;

function pecahTags(tagsString) {
    if (!tagsString) return [];
    return tagsString.split(",").map((t) => t.trim()).filter(Boolean);
}

async function buildSearchIndex() {
    const [semuaVideo, semuaFoto] = await Promise.all([
        fetchFileListFromFolder(DRIVE_FOLDER_ID),
        fetchFileListFromFolder(DRIVE_PHOTO_FOLDER_ID)
    ]);

    const videos = semuaVideo.filter(isVideoFile).map((file) => {
        const parsed = parseVideoFileName(file.name);
        return {
            type: "video",
            title: parsed.title || "(Untitled)",
            channel: parsed.channel || "Unknown",
            category: parsed.category || "Uncategorized",
            tags: pecahTags(parsed.tags),
            figma: parsed.figma || "",
            file
        };
    });

    const photos = semuaFoto.filter(isImageFile).map((file) => {
        const parsed = parseVideoFileName(file.name);
        return {
            type: "photo",
            title: parsed.title || "(Untitled)",
            channel: parsed.channel || "Unknown",
            category: parsed.category || "Uncategorized",
            tags: pecahTags(parsed.tags),
            figma: parsed.figma || "",
            file
        };
    });

    return [...videos, ...photos];
}

// Cache: index cuma dibangun sekali per pemuatan halaman, dipakai ulang
// untuk saran pencarian (ketik-ketik) maupun eksekusi pencarian.
function getSearchIndex() {
    if (!searchIndexPromise) {
        searchIndexPromise = buildSearchIndex().catch((err) => {
            console.error("Gagal membangun search index:", err);
            searchIndexPromise = null; // biar bisa dicoba ulang kalau gagal
            return [];
        });
    }
    return searchIndexPromise;
}

// Siapkan index dari awal supaya saran pencarian sudah siap begitu user mengetik
document.addEventListener("DOMContentLoaded", () => {
    getSearchIndex();
});

// Ambil nilai field tertentu dari 1 item index sesuai tipe filter yang aktif
function ambilNilaiField(item, filterType) {
    switch (filterType) {
        case "title": return [item.title];
        case "from": return [item.channel];
        case "category": return [item.category];
        case "tags": return item.tags;
        case "figma": return item.figma ? [item.figma] : [];
        default: return [item.title];
    }
}

function ambilRandomDariArray(array, jumlah) {
    const hasil = [...array];
    for (let i = hasil.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
    }
    return hasil.slice(0, jumlah);
}

// Dipakai oleh script.js (dropdown saran di bawah kotak pencarian).
// - query kosong -> 5 nilai ACAK dari field yang sesuai filter (dedup)
// - query terisi -> nilai yang cocok (mengandung teks query), maks 5, dedup
window.getSearchSuggestions = async function (filterType, query, maxHasil) {
    const index = await getSearchIndex();
    const q = (query || "").trim().toLowerCase();

    const semuaNilai = [];
    index.forEach((item) => {
        ambilNilaiField(item, filterType).forEach((nilai) => {
            if (nilai) semuaNilai.push(nilai);
        });
    });

    const unik = [...new Set(semuaNilai)];

    if (!q) {
        return ambilRandomDariArray(unik, maxHasil || 5);
    }

    return unik.filter((nilai) => nilai.toLowerCase().includes(q)).slice(0, maxHasil || 5);
};

// Dipakai khusus filter "tags": tampilkan SEMUA tag yang ada (atau yang cocok
// dengan teks yang sedang diketik), tanpa batas 5 seperti saran biasa.
window.getAllTagsForSearch = async function (query) {
    const index = await getSearchIndex();
    const q = (query || "").trim().toLowerCase();

    const semuaTag = [];
    index.forEach((item) => item.tags.forEach((t) => semuaTag.push(t)));
    const unik = [...new Set(semuaTag)].sort((a, b) => a.localeCompare(b));

    if (!q) return unik;
    return unik.filter((tag) => tag.toLowerCase().includes(q));
};


// ============================================================
// HALAMAN HASIL PENCARIAN (search.html)
// Membaca ?type=&q= dari URL, menyaring search index, lalu
// menampilkan video (kartu -> play.html) dan foto (grid -> zoom)
// memakai ulang komponen yang sudah ada di channels.html.
// ============================================================

function updateSearchHeading(filterType, query, jumlahHasil) {
    const heading = document.querySelector("#searchResultContainer")?.closest(".trending")?.querySelector(".trending_title");
    if (!heading) return;

    const labelFilter = {
        title: "Title",
        from: "From",
        category: "Category",
        tags: "Tag",
        figma: "Figma"
    }[filterType] || "Title";

    heading.innerHTML = query
        ? `Search Results - ${labelFilter}: "${query}" (${jumlahHasil}) <a href="search.html" style="float:right; font-weight:normal; font-size:12px;">Clear search</a>`
        : `Search Results (${jumlahHasil})`;
}

async function renderSearchResults() {
    const container = document.getElementById("searchResultContainer");
    if (!container) return; // bukan search.html, skip

    const params = new URLSearchParams(window.location.search);
    const filterType = params.get("type") || "title";
    const query = (params.get("q") || "").trim();

    container.innerHTML = "<p style='padding:10px;'>Loading...</p>";

    try {
        const index = await getSearchIndex();
        const q = query.toLowerCase();

        const hasil = index.filter((item) => {
            const nilaiField = ambilNilaiField(item, filterType);
            if (!q) return false; // tidak ada query -> tidak ada hasil untuk ditampilkan
            return nilaiField.some((nilai) => nilai.toLowerCase().includes(q));
        });

        const videos = hasil.filter((i) => i.type === "video").map((i) => i.file);
        const photos = hasil.filter((i) => i.type === "photo").map((i) => i.file);

        updateSearchHeading(filterType, query, hasil.length);

        if (!hasil.length) {
            container.innerHTML = `<p style='padding:10px;'>Tidak ada hasil untuk "${query}".</p>`;
            return;
        }

        let html = "";
        if (videos.length) {
            html += `<div class="video_feature_container">${videos.map(buatKartuVideo).join("")}</div>`;
        }
        if (photos.length) {
            html += `<p class="trending_title">Photos</p><div class="channel_photo_grid">${photos.map(buatKartuFotoChannel).join("")}</div>`;
        }
        container.innerHTML = html;

        pasangKlikPindahKePlay(container);
        syncAllVideoCards(container);

        // Foto hasil pencarian -> bisa di-zoom, sama seperti di channels.html
        if (window.initZoom) {
            window.initZoom(container);
        }
    } catch (err) {
        console.error("Gagal render hasil pencarian:", err);
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat hasil pencarian. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderSearchResults);


// ============================================================
// UI/UX PROJECTS (uiux.html + viewuiux.html)
//
// Format nama file DI FOLDER UI/UX (semua bagian OPSIONAL, urutan bebas):
//
//   NamaFileAsliDrive /Channel/ $Judul Project$ ;1; {Deskripsi} <Link>.jpg
//
// - $Judul Project$ -> INI yang jadi judul & kunci pengelompokan (kalau tidak
//                       ada, dipakai sisa nama file sebagai judul, tapi lebih
//                       aman selalu isi $...$ karena nama file dari HP/Drive
//                       biasanya acak/tidak seragam)
// - /Channel/        -> nama pembuat/channel (tampil "From: ...")
// - ;N;              -> nomor urut gambar dalam SATU project.
//                        ;1; = gambar sampul/thumbnail -> tampil di uiux.html
//                        DAN di bagian atas viewuiux.html. ;2; ;3; dst HANYA
//                        tampil di galeri viewuiux.html.
// - {Deskripsi}      -> deskripsi project -> tampil di uiux.html & viewuiux.html
// - <Link>           -> link luar (misal link Figma) -> tombol "Open Link" di
//                        viewuiux.html
//
// PENTING: semua file dengan $Judul Project$ yang SAMA otomatis dikelompokkan
// jadi SATU project. Contoh 3 file (nama file di depan boleh acak/beda-beda,
// yang penting $...$-nya sama):
//
//   Bassmen /minecraft/ $SpaceRocket$;1;{Sed ut perspiciatis...}.jpg
//   Beyond the Mirrors /minecraft/ $SpaceRocket$;2;.jpg
//   cf47d104-fb51-4149-8425-cb23106bfa08 /minecraft/ $SpaceRocket$;3;<https://figma.com/xxx>.jpg
// ============================================================

function parseUiuxFileName(rawFileName) {
    const nameNoExt = rawFileName.replace(/\.[^/.]+$/, "");
    let sisa = nameNoExt;

    // Channel: /Text/
    const channelMatch = sisa.match(/\/([^/]+)\//);
    const channel = channelMatch ? channelMatch[1].trim() : "";
    if (channelMatch) sisa = sisa.replace(channelMatch[0], " ");

    // Nama/judul project: $Text$  (INI yang dipakai sebagai judul & kunci
    // pengelompokan kalau ada, karena teks lain di nama file Drive biasanya
    // cuma nama file acak/random dari HP, bukan judul project sungguhan)
    const namaProjectMatch = sisa.match(/\$([^$]+)\$/);
    const namaProject = namaProjectMatch ? namaProjectMatch[1].trim() : "";
    if (namaProjectMatch) sisa = sisa.replace(namaProjectMatch[0], " ");

    // Nomor urut gambar: ;N;  (default 1 kalau tidak ditulis)
    const indexMatch = sisa.match(/;(\d+);/);
    const urutan = indexMatch ? parseInt(indexMatch[1], 10) : 1;
    if (indexMatch) sisa = sisa.replace(indexMatch[0], " ");

    // Deskripsi: {Text}
    const descMatch = sisa.match(/\{([^}]+)\}/);
    const description = descMatch ? descMatch[1].trim() : "";
    if (descMatch) sisa = sisa.replace(descMatch[0], " ");

    // Link: <Text>
    const linkMatch = sisa.match(/<([^>]+)>/);
    const link = linkMatch ? linkMatch[1].trim() : "";
    if (linkMatch) sisa = sisa.replace(linkMatch[0], " ");

    // Sisa teks setelah semua tanda dibuang (biasanya nama file asli/acak dari Drive)
    const sisaTeks = sisa.replace(/\s+/g, " ").trim();

    // Judul final: pakai $Nama Project$ kalau ada, kalau tidak ada baru pakai sisa teks
    const title = namaProject || sisaTeks;
    const adaTagProject = Boolean(namaProject); 

    return { title, channel, urutan, description, link, adaTagProject };
}

// Ganti dengan ID folder Google Drive khusus UI/UX kamu (dari URL folder,
// setelah /folders/). Kalau belum diganti, uiux.html akan kosong.
const DRIVE_UIUX_FOLDER_ID = "1EJk31gXdhMCOCyYOBe8XGK9tIzOJ_3Hi";

let uiuxProjectsPromise = null;

async function buildUiuxProjects() {
    const semuaFile = await fetchFileListFromFolder(DRIVE_UIUX_FOLDER_ID);
    const gambarFile = semuaFile.filter(isImageFile);

    const projectMap = new Map(); // key: judul project -> data project

    gambarFile.forEach((file) => {
        const parsed = parseUiuxFileName(file.name);

        // Cuma file yang punya tanda $...$ yang dihitung sebagai project UI/UX.
        // Foto-foto biasa (wallpaper, screenshot, dll) di folder yang sama diabaikan.
        if (!parsed.adaTagProject) return;

        const title = parsed.title;

        if (!projectMap.has(title)) {
            projectMap.set(title, {
                title,
                channel: "",
                description: "",
                link: "",
                images: [] // { urutan, file }
            });
        }

        const project = projectMap.get(title);
        project.images.push({ urutan: parsed.urutan, file });

        // Isi channel/deskripsi/link dari file manapun dalam grup yang punya nilainya
        // (biasanya cuma diisi di file ;1;, tapi jaga-jaga kalau diisi di file lain)
        if (parsed.channel && !project.channel) project.channel = parsed.channel;
        if (parsed.description && !project.description) project.description = parsed.description;
        if (parsed.link && !project.link) project.link = parsed.link;
    });

    return [...projectMap.values()].map((project) => {
        project.images.sort((a, b) => a.urutan - b.urutan);

        const thumbEntry = project.images.find((img) => img.urutan === 1) || project.images[0];
        project.thumbnail = thumbEntry.file;
        project.galeri = project.images
            .filter((img) => img.file.id !== project.thumbnail.id)
            .map((img) => img.file);

        project.channel = project.channel || "Unknown";
        project.id = encodeURIComponent(project.title);

        return project;
    });
}

// Cache: daftar project cuma dibangun sekali per pemuatan halaman
function getUiuxProjects() {
    if (!uiuxProjectsPromise) {
        uiuxProjectsPromise = buildUiuxProjects().catch((err) => {
            console.error("Gagal membangun daftar project UI/UX:", err);
            uiuxProjectsPromise = null;
            return [];
        });
    }
    return uiuxProjectsPromise;
}

function thumbSrcUiux(file, ukuran) {
    return `https://drive.google.com/thumbnail?id=${file.id}&sz=w${ukuran || 600}`;
}

// ------------------------------------------------------------
// uiux.html: grid daftar project
// ------------------------------------------------------------
function buatKartuUiux(project) {
    return `
        <a class="uiux-card" href="viewuiux.html?id=${project.id}">
            <div class="uiux-card-thumb">
                <img src="${thumbSrcUiux(project.thumbnail, 500)}" alt="" class="uiux-card-img" loading="lazy">
            </div>
            <div class="uiux-card-info">
                <p class="uiux-card-title">${project.title}</p>
                <p class="uiux-card-desc">${project.description || ""}</p>
                <p class="uiux-card-meta">Added: <span class="uiux-added" data-file-id="${project.thumbnail.id}">Loading...</span></p>
                <p class="uiux-card-meta">From: ${project.channel}</p>
            </div>
        </a>
    `;
}

async function renderUiuxList() {
    const container = document.getElementById("uiuxContainer");
    if (!container) return; // bukan uiux.html, skip

    container.innerHTML = "<p style='padding:10px;'>Loading...</p>";

    try {
        const projects = await getUiuxProjects();

        if (!projects.length) {
            container.innerHTML = "<p style='padding:10px;'>Belum ada project UI/UX.</p>";
            return;
        }

        container.innerHTML = `<div class="uiux_grid">${projects.map(buatKartuUiux).join("")}</div>`;

        // "Added" diambil dari metadata Drive (createdTime) secara terpisah per kartu,
        // sama seperti kartu video di videos.html
        container.querySelectorAll(".uiux-added[data-file-id]").forEach(async (el) => {
            try {
                const meta = await fetchDriveMetadata(el.dataset.fileId);
                el.textContent = formatDate(meta.createdTime);
            } catch (err) {
                el.textContent = "-";
            }
        });
    } catch (err) {
        console.error("Gagal render daftar UI/UX:", err);
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat data. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderUiuxList);

// ------------------------------------------------------------
// viewuiux.html: halaman detail 1 project
// ------------------------------------------------------------
async function renderUiuxDetail() {
    const container = document.getElementById("uiuxDetailContainer");
    if (!container) return; // bukan viewuiux.html, skip

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    container.innerHTML = "<p style='padding:10px;'>Loading...</p>";

    try {
        const projects = await getUiuxProjects();
        const project = projects.find((p) => p.id === id);

        if (!project) {
            container.innerHTML = "<p style='padding:10px;'>Project tidak ditemukan.</p>";
            return;
        }

        let addedText = "-";
        try {
            const meta = await fetchDriveMetadata(project.thumbnail.id);
            addedText = formatDate(meta.createdTime);
        } catch (err) {
            // biarin tetap "-" kalau gagal ambil metadata
        }

        const galeriHtml = project.galeri.length
            ? `<div class="uiux_gallery_grid">${project.galeri.map((file) => `
                <div class="photo-item" data-file-id="${file.id}" data-full-src="${thumbSrcUiux(file, 1600)}">
                    <img src="${thumbSrcUiux(file, 500)}" alt="" class="photo-thumb" loading="lazy">
                </div>
            `).join("")}</div>`
            : "";

        container.innerHTML = `
            <img src="${thumbSrcUiux(project.thumbnail, 1200)}" alt="" class="uiux-detail-thumb">
            <p class="uiux-detail-title">${project.title}</p>
            <p class="uiux-detail-desc">${project.description || ""}</p>
            <p class="uiux-detail-meta">Added: ${addedText} &nbsp;|&nbsp; From: ${project.channel}</p>
            ${project.link ? `<a class="uiux-detail-link" href="${project.link}" target="_blank" rel="noopener">Open Link</a>` : ""}
            ${galeriHtml ? `<p class="trending_title" style="margin-top:20px;">Gallery</p>${galeriHtml}` : ""}
        `;

        // Gambar galeri (;2; ;3; dst) bisa di-zoom, sama seperti foto di halaman lain
        if (window.initZoom) window.initZoom(container);
    } catch (err) {
        console.error("Gagal render detail UI/UX:", err);
        container.innerHTML = "<p style='padding:10px;'>Gagal memuat data. Cek console (F12).</p>";
    }
}

document.addEventListener("DOMContentLoaded", renderUiuxDetail);