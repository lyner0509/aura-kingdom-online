# Loyalty Shop (Toko Loyalitas)

Halaman admin untuk mengelola katalog item yang dijual di Loyalty Shop (`FFAccount.public.itemmall` dengan `money_unit = 2`).
Item dibeli pemain menggunakan mata uang Loyalty Points (LP).

Setiap item memiliki atribut:
- `item_group`: Kategori tab (e.g. 48: Populer/Rekomendasi, 2: Kostum, 3: Konsumsi, 4: Batu Permata, 5: Tas/Penyimpanan, 8: Aksesori/Senjata, dll.)
- `detail_type`: Sub-kategori (default 1)
- `item_index`: Nomor indeks urutan dalam kategori
- `item_id`: ID item game (nama item otomatis diambil dari `Data/db/T_ItemMall.ini` / `data/item-names.json`)
- `item_num`: Jumlah stack yang diterima per pembelian
- `point`: Harga dalam Loyalty Points (LP)
- `special_price`: Harga promo / diskon LP (0 = tidak ada promo)
- `num_limit`: Batas pembelian (0 = tanpa batas)
- `sell`: Status penjualan (1 = Aktif dijual, 0 = Non-aktif)

Operator dapat menambah item baru, mengubah item yang ada, menghapus item, serta memfilter berdasarkan kategori dan status aktif.
Penyimpanan menerapkan row locking `FOR UPDATE`, validasi skema Zod, pengecekan token revisi SHA-256 (concurrency check),
dan mencatat snapshot sebelum/sesudah di tabel `dashboard.loyalty_history`.

Jalankan `npm test` dan `npm run check` sebelum deployment.
