# Redeem Code (Exchange PIN) Operations Guide

Fitur Redeem Code di Dashboard Operasi Aura Kingdom terintegrasi langsung dengan engine server native `FFAccount.public.exchange_pin`, `public.exchange_rule`, dan `public.exchange_list`.

## 1. Arsitektur Data

### Tabel Engine Server (`FFAccount`):
1. **`public.exchange_pin`**:
   - `pin` (VARCHAR 16, PK): Kode unik redeem (maksimal 16 karakter alfanumerik).
   - `password` (VARCHAR 16): Password kode (opsional / default kosong atau '0').
   - `rule_id` (INTEGER): Mengacu ke ID aturan hadiah pada `exchange_rule` dan `exchange_list`.
   - `state` (VARCHAR 16): Status pin (`open` = aktif siap klaim, `used` = sudah dipakai, `create` = draft, `disabled` = dinonaktifkan).
   - `zoneserver_id` (INTEGER): ID zoneserver saat klaim in-game.
   - `account_id` (INTEGER): ID akun yang mengklaim kode.
   - `character_id` (INTEGER): ID karakter yang mengklaim kode.
   - `log_time` (TIMESTAMP): Waktu saat kode berhasil diklaim.
   - `pin_set` (INTEGER): Grup pembatasan klaim akun. Jika `pin_set > 0`, satu akun hanya dapat mengklaim 1 kode dari grup `pin_set` tersebut.

2. **`public.exchange_rule`**:
   - `id` (INTEGER): ID aturan hadiah (sesuai `rule_id` pada PIN).
   - `item_id` (INTEGER): ID item game dari katalog.
   - `item_num` (INTEGER): Jumlah item yang diberikan (default 1).
   - `rate` (INTEGER): Peluang/bobot perolehan item. Nilai 1000 = garansi 100% didapatkan.
   - `set` (INTEGER): Nomor slot set. Setiap hadiah pasti diletakkan pada set terpisah (set 1, set 2, dst).

3. **`public.exchange_list`**:
   - `id` (INTEGER, PK): ID aturan hadiah.
   - `description` (VARCHAR 50): Nama kampanye / event / deskripsi paket hadiah.
   - `amount` (INTEGER): Jumlah PIN yang menggunakan aturan ini.

4. **`dashboard.redeem_code_history`**:
   - Audit trail transaksi untuk mencatat setiap pembuatan, perubahan status, maupun penghapusan kode oleh operator dashboard.

## 2. Format & Aturan Validasi
- **Kode PIN**: 3 hingga 16 karakter, alfanumerik huruf kapital, angka, `-`, dan `_`.
- **Password**: Maksimal 16 karakter.
- **Item Hadiah**: Minimal 1 item, `item_id > 0`, `item_num` antara 1 - 999, `rate` antara 1 - 1000.
- **Batch Generator**: Mendukung pembuatan otomatis 1 - 500 kode unik sekaligus dengan prefix kustom untuk event/giveaway Discord.
