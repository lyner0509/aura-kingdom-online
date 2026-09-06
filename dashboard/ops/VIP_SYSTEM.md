# VIP System Operations

## Overview
Modul **VIP System** di dashboard operasi Aura Kingdom V15 menyediakan pengelolaan privilege dan keanggotaan VIP untuk pemain secara terpadu:
- **Tingkatan VIP (Level 1–10)**:
  - Konfigurasi nama tier, syarat poin VIP akumulatif.
  - Multiplier hak istimewa (Perks): Bonus EXP (%), Bonus Drop Rate (%), Bonus Gold (%), Movement Speed (%), dan Loyalty Points harian.
  - Hadiah harian: Item ID hadiah gratis dan jumlah item yang dikirim melalui sistem pesan in-game mail.
  - Keterangan buff dan preset instan (Standar RPG, High Booster, Casual).
- **Manajemen Anggota VIP (Member Management)**:
  - Pencarian akun pemain dan filter tingkat VIP.
  - Pemberian status VIP ke akun pemain dengan pilihan durasi (7 hari, 30 hari, 90 hari, 180 hari, 365 hari, atau Permanen).
  - Perpanjangan masa aktif instan (+30 hari).
  - Pencabutan status VIP (revoke).
- **Pengaturan Global & Distribusi Mail Harian**:
  - Sakelar aktif/nonaktif sistem VIP global.
  - Rasio perolehan poin VIP otomatis saat berbelanja di Item Mall (AP).
  - Distribusi hadiah harian ke karakter aktif member VIP melalui sistem in-game mail (`FFDB1.sys_mail_queue`).
- **Audit Trail & Tracking**:
  - Catatan riwayat lengkap seluruh aksi operator (grant, extend, revoke, update settings, mail dispatch).

## Database Schema (`FFAccount` & `FFDB1`)
- `dashboard.vip_settings`: Menyimpan konfigurasi global status VIP, rasio poin AP, dan template surat hadiah harian.
- `dashboard.vip_tiers`: Menyimpan konfigurasi perk, bonus rate, dan hadiah item untuk 10 level VIP.
- `dashboard.account_vip`: Menyimpan relasi akun (`account_id`), level VIP, total poin, tanggal kadaluarsa, dan klaim harian terakhir.
- `dashboard.vip_history`: Jejak audit setiap aktivitas penambahan, pembaruan, dan pengiriman mail VIP.
- `FFDB1.sys_mail_queue`: Antrean pesan in-game mail server untuk mengirim hadiah harian langsung ke karakter milik akun VIP aktif.

## Antarmuka Dashboard
- **Path Navigasi**: Tab sidebar `VIP System` (ikon Crown/Mahkota).
- **Styling**: Tombol kompak yang rapi dan konsisten dengan dashboard operational Aura Kingdom.
