# Item Index & Catalog Operations

## Overview
Halaman **Item Index** di dashboard operasi Aura Kingdom V15 menyediakan katalog dan pencarian komprehensif untuk seluruh item game yang tersedia di server (36.700+ item):
- **Pencarian Cepat & Filter Pintar**:
  - Pencarian instan berdasarkan **Item ID** (angka) maupun **Nama Item** (case-insensitive substring).
  - Filter kategori: *Weapon*, *Armor & Gear*, *Costume*, *Mount*, *Eidolon*, *Consumable*, *Bag*, *Secret Stone*, *Material*, dan *Other*.
  - Filter status tradeability: *Semua Status*, *Tradable Sahaja*, atau *Non-tradable (Bound)*.
  - Opsi pengurutan: ID Menaik (1 → 9), ID Menurun (9 → 1), Nama (A → Z), Nama (Z → A).
  - Pilihan jumlah item per halaman (24, 48, 96 item) dengan kontrol paginasi dan lompat ke halaman tertentu (*jump to page*).
- **Opsi Tampilan (View Modes)**:
  - **Tabel View**: Tampilan tabular data detail dengan kolom *Item ID*, *Nama Item*, *Kategori*, *Status*, dan tombol *Salin ID*.
  - **Grid View**: Tampilan kartu grid modern responsif dengan badge kategori, status bound/tradable, dan tombol salin ID besar.
  - Pilihan tampilan otomatis tersimpan di browser (`localStorage.getItem('aura_item_view')`).
- **Fitur Salin ID (One-Click Copy)**:
  - Tombol **Salin ID** dan badge ID yang dapat diklik langsung untuk menyalin angka ID item ke clipboard.
  - Indikator feedback visual langsung (ikon check hijau `Tersalin!`) serta pop-up banner notifikasi.
  - Memudahkan operator untuk menyalin Item ID saat mengonfigurasi Paragon Table, Loyalty Shop, Bonus Mall, Item Mall, Starter Pack, atau pengiriman in-game mail manual.

## Sumber Data & Arsitektur
- **Sumber Data**: `/opt/aura-dashboard/current/data/item-names.json` (dikompilasi otomatis dari file data game server `T_Item.ini` dan `T_ItemMall.ini` saat proses release deployment).
- **Caching & Performa**:
  - In-memory cache dengan indeks pencarian cepat.
  - Respons pencarian sub-10ms tanpa membebani database PostgreSQL game server.
- **Endpoint API**:
  - `GET /ops/api/item-index`: Menerima query parameter `q`, `page`, `limit`, `category`, `tradable`, `sort`.
  - Mengembalikan daftar item yang difilter, total hasil, jumlah halaman, dan statistik katalog.

## Antarmuka Dashboard
- **Path Navigasi**: Tab sidebar `Item Index` (ikon Database / Disk).
- **Styling**: Tombol aksi kompak dan modern yang konsisten dengan estetika dark mode dashboard Aura Kingdom.
