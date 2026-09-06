# Kick Online

Dashboard menampilkan aksi **Kick** pada setiap karakter di menu **Pemain** agar fiturnya mudah ditemukan. Tombol hanya aktif untuk karakter yang terdeteksi online; karakter offline menampilkan tombol nonaktif dengan tooltip yang menjelaskan statusnya. Operator wajib memilih alasan sebelum sesi diputus.

Backend memvalidasi Character ID terhadap database dan status sesi aktif, lalu mengirim `kick_out <character_id> 0` melalui socket CGI ZoneServer yang sudah dikonfigurasi oleh `ZONE_CGI_HOST`, `ZONE_CGI_PORT`, dan `ZONE_CGI_KEY`.

Nama karakter tidak pernah diterima sebagai command dari browser. Target dibaca ulang dari database dan perintah hanya dibangun dari Character ID numerik yang tervalidasi, sehingga nama karakter maupun input operator tidak dapat menjadi command injection.

Handler `Server_TC_KickOut` pada build ZoneServer produksi mencari entitas live langsung berdasarkan Character ID lalu menjalankan `PlayerQuit`, tanpa bergantung pada lookup lokasi karakter di database. Handler tidak mengirim body respons CGI. Karena itu timeout tanpa balasan hanya dianggap sebagai indikasi bahwa command telah dikirim; backend kemudian menunggu cache sesi kedaluwarsa dan memastikan Character ID maupun Account ID sudah hilang dari daftar aktif. Operasi dinyatakan gagal bila sesi masih terlihat atau socket menghasilkan error selain timeout tanpa balasan.

Panel **Service > ZoneServer > Log Runtime** menampilkan file `GMCommand*.log*` terbaru karena di situlah koneksi dan command CGI dicatat oleh build produksi ini.

Setiap keberhasilan ditulis sebagai event JSON `[KickOnline]` pada log dashboard, termasuk operator, Character ID, nama karakter, alasan, catatan, dan timestamp.
