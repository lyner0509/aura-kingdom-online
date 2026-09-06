# Kick Online

Dashboard menampilkan aksi **Kick** pada setiap karakter di menu **Pemain** agar fiturnya mudah ditemukan. Tombol hanya aktif untuk karakter yang terdeteksi online; karakter offline menampilkan tombol nonaktif dengan tooltip yang menjelaskan statusnya. Operator wajib memilih alasan sebelum sesi diputus.

Backend memvalidasi Character ID terhadap database dan status sesi aktif, lalu mengirim `kick <character_name>` melalui socket CGI ZoneServer yang sudah dikonfigurasi oleh `ZONE_CGI_HOST`, `ZONE_CGI_PORT`, dan `ZONE_CGI_KEY`.

Nama karakter tidak pernah diterima langsung sebagai command dari browser. Nama dibaca ulang dari database dan ditolak bila berisi whitespace, koma, atau control character untuk mencegah command injection.

Handler `TC_KickOut` pada build ZoneServer produksi menjalankan `PlayerQuit` tanpa mengirim body respons CGI. Karena itu timeout tanpa balasan hanya dianggap sebagai indikasi bahwa command telah dikirim; backend kemudian menunggu cache sesi kedaluwarsa dan memastikan Character ID maupun Account ID sudah hilang dari daftar aktif. Operasi dinyatakan gagal bila sesi masih terlihat atau socket menghasilkan error selain timeout tanpa balasan.

Setiap keberhasilan ditulis sebagai event JSON `[KickOnline]` pada log dashboard, termasuk operator, Character ID, nama karakter, alasan, catatan, dan timestamp.
