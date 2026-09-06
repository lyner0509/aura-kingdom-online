# Item Mall (Toko AP / Cash Shop)

Halaman admin untuk mengelola katalog item yang dijual di Item Mall utama (`FFAccount.public.itemmall` dengan `money_unit = 1`).
Item dibeli pemain menggunakan mata uang Aeria Points (AP).

Setiap item memiliki atribut:
- `item_group`: Kategori tab (e.g. 1: Rekomendasi & Hot, 2: Kostum & Fashion, 3: Eidolon & Mitra, 4: Batu Permata & Gem, 5: Tas & Penyimpanan, 8: Formula & Aksesori, 47: Event Khusus, 48: Populer & Terlaris, 49: Paket Spesial & Boost, 51: Koin & Token, 52: Rainbow Coin, 99: Paket Promo)
- `detail_type`: Sub-kategori / tipe detail (default 1)
- `item_index`: Nomor indeks urutan dalam kategori
- `item_id`: ID item game (nama item otomatis diambil dari `Data/db/T_ItemMall.ini` / `T_Item.ini` / `data/item-names.json`)
- `item_num`: Jumlah stack yang diterima per pembelian
- `point`: Harga dalam Aeria Points (AP)
- `special_price`: Harga promo / diskon AP (0 = tidak ada promo)
- `num_limit`: Batas pembelian per akun/karakter (0 = tanpa batas)
- `sell`: Status penjualan (1 = Aktif dijual, 0 = Non-aktif)

Operator dapat menambah item baru, mengubah item yang ada, menghapus item, serta memfilter berdasarkan kategori dan status aktif.
Penyimpanan menerapkan row locking `FOR UPDATE` pada `money_unit = 1`, validasi skema Zod, pengecekan token revisi SHA-256 (concurrency check),
dan mencatat snapshot sebelum/sesudah di tabel `dashboard.itemmall_history`.

Jalankan `npm test` dan `npm run check` sebelum deployment.
