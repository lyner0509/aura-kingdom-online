# Starter Pack Operations

## Overview
Modul **Starter Pack** di dashboard operasi Aura Kingdom V15 menyediakan pengelolaan paket awal untuk pemain baru maupun distribusi langsung:
- **Konfigurasi Item Starter Pack**:
  - Item ID, nama item (sinkronisasi live catalog item name), jumlah item (`item_count`), bound status (Tradable / Non-tradable), kategori (Equipment, Consumable, Mount, Costume, Material, Other), sort order, dan catatan.
  - Quick Presets: Standar Petualang (7 item awal esensial), High-Rate Booster (item boost EXP & Drop), Minimalis (paket dasar).
- **Pengaturan Global & Distribusi**:
  - Sakelar aktif/nonaktif sistem starter pack global (`is_enabled`).
  - Auto-delivery otomatis ke karakter baru yang baru dibuat (`auto_deliver_new_char`).
  - Bonus Gold (`bonus_gold`) yang dikirim langsung via surat in-game mail.
  - Bonus Loyalty Points / Gift Points (`bonus_loyalty`) yang ditambahkan langsung ke akun pemain (`FFAccount.accounts.gift_point`).
  - Batas klaim per akun (`max_claims_per_account`) dan syarat level minimum (`min_level`).
  - Template surat in-game mail: Sender name, mail title, dan mail body message.
- **Pemberian Langsung (Manual Grant) & Batch Dispatch**:
  - Kirim starter pack langsung ke karakter tertentu berdasarkan nama karakter (`char_name`) atau akun (`account_name`).
  - Distribusi massal (Batch Dispatch) ke seluruh karakter yang memenuhi syarat yang belum menerima paket.
- **Manajemen Riwayat & Klaim (Claims History)**:
  - Pencarian riwayat klaim berdasarkan karakter atau nama akun.
  - Reset / Revoke klaim untuk memperbolehkan karakter mengklaim kembali.
- **Audit Trail & Tracking**:
  - Catatan riwayat audit lengkap seluruh perubahan konfigurasi dan aksi distribusi paket.

## Database Schema (`FFAccount` & `FFDB1`)
- `dashboard.starter_pack_settings`: Menyimpan konfigurasi global status starter pack, bonus gold/loyalty, batas klaim, dan template pesan in-game mail.
- `dashboard.starter_pack_items`: Menyimpan daftar item yang termasuk dalam paket starter pack beserta jumlah, status bind, dan urutan.
- `dashboard.starter_pack_claims`: Menyimpan data pemain/karakter yang telah mengklaim paket (`account_id`, `char_id`, `claimed_at`, `status`).
- `dashboard.starter_pack_history`: Jejak audit setiap aktivitas penambahan, perubahan konfigurasi, pemberian manual, dan batch dispatch.
- `FFDB1.sys_mail_queue`: Antrean pesan in-game mail server untuk mengirim item dan bonus gold langsung ke inventory mailbox karakter.

## Antarmuka Dashboard
- **Path Navigasi**: Tab sidebar `Starter Pack` (ikon Package / Kotak Paket).
- **Styling**: Tombol kompak yang rapi dan konsisten dengan tata letak dashboard Aura Kingdom.
