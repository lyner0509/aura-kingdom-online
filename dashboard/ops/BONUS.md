# Bonus Mall (Toko Poin Bonus)

Halaman admin untuk mengelola katalog item yang dijual di Bonus Mall (`FFAccount.public.itemmall` dengan `money_unit = 3`).
Item dibeli pemain menggunakan mata uang Bonus Points (BP), yang diperoleh dari pembelanjaan AP (1 Bonus Point per 30 AP yang dihabiskan).

Setiap item memiliki atribut:
- `item_group`: Kategori tab (e.g. 2: Kostum & Fashion, 3: Konsumsi & Tempa, 4: Batu Permata, 5: Tas/Penyimpanan, 8: Aksesori & Senjata, 47: Event Khusus, 49: Mount & Tunggangan, 99: Paket Promo, dll.)
- `detail_type`: Sub-kategori / tipe detail (default 1)
- `item_index`: Nomor indeks urutan dalam kategori
- `item_id`: ID item game (nama item otomatis diambil dari `Data/db/T_ItemMall.ini` / `T_Item.ini` / `data/item-names.json`)
- `item_num`: Jumlah stack yang diterima per pembelian
- `point`: Harga dalam Bonus Points (BP)
- `special_price`: Harga promo / diskon BP (0 = tidak ada promo)
- `num_limit`: Batas pembelian per karakter/akun (0 = tanpa batas)
- `sell`: Status penjualan (1 = Aktif dijual, 0 = Non-aktif)

Operator dapat menambah item baru, mengubah item yang ada, menghapus item, serta memfilter berdasarkan kategori dan status aktif.
Penyimpanan menerapkan row locking `FOR UPDATE` pada `money_unit = 3`, validasi skema Zod, pengecekan token revisi SHA-256 (concurrency check),
dan mencatat snapshot sebelum/sesudah di tabel `dashboard.bonus_history`.

Jalankan `npm test` dan `npm run check` sebelum deployment.
