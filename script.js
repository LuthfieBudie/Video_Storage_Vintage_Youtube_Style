document.getElementById("last-update").innerHTML = new Date(document.lastModified).toLocaleString('id-ID', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true});


  function muatVideo(nomor) {
            // 1. Sembunyikan thumbnail sesuai nomor kotak yang diklik
            let thumb = document.getElementById('thumbContainer' + nomor);
            if (thumb) {
                thumb.style.display = 'none';
            }
            
            // 2. Ambil elemen pemutar video sesuai nomor kotak yang diklik
            let player = document.getElementById('driveVideo' + nomor);
            
            // 3. Masukkan link GDrive berdasarkan nomor videonya
            if (nomor === 1) {
                player.src = "https://drive.google.com/file/d/1o5aP9HXWyuy5q0SoU_XK2wytovoJICZg/preview?autoplay=1";
            } else if (nomor === 2) {
                // Ganti link di bawah ini dengan link video Google Drive kedua kamu
                player.src = "https://drive.google.com/file/d/1o5aP9HXWyuy5q0SoU_XK2wytovoJICZg/preview?autoplay=1";
            }
            
            // 4. Tampilkan pemutar video khusus di kotak tersebut
            player.style.display = 'block';
        }