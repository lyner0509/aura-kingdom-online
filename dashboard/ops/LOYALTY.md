# Loyalty Shop (Toko Loyalitas)

Halaman admin untuk mengelola katalog item yang dijual di Loyalty Shop (Toko Loyalitas).
Item menggunakan mata uang Loyalty Points (LP) yang diperoleh pemain melalui aktivitas in-game.

Item ID, nama item, kategori, harga LP, jumlah stack per pembelian, batas beli (buy limit), diskon (%),
status aktif, dan urutan tampilan dapat diubah, ditambah, atau dihapus langsung oleh operator.
Nama item dibaca dari katalog item game server `Data/db/T_ItemMall.ini` (`data/item-names.json`).

`loyalty.sql` membuat tabel `dashboard.loyalty_shop` dan tabel audit `dashboard.loyalty_history` di database `FFAccount`.
Script deploy menjalankan migrasi ini secara otomatis sebelum mengaktifkan release baru.

Penyimpanan menggunakan mekanisme transaksi berkeamanan tinggi:
1. Memverifikasi kecocokan revision token (optimistic concurrency control) untuk mencegah tabrakan edit antar admin.
2. Menyimpan snapshot sebelum dan sesudah perubahan di `dashboard.loyalty_history` lengkap dengan nama operator (actor) dan timestamp.
3. Menolak input jika ada data yang tidak valid (harga negatif, item ID tidak valid, atau diskon > 100%).

Jalankan `npm test` dan `npm run check` sebelum deploy.
