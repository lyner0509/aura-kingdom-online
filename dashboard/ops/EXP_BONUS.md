# EXP Bonus & Server Rates Operations

## Overview
Pengaturan **EXP Bonus** di dashboard operasi Aura Kingdom V15 memungkinkan operator server mengatur pengganda tingkat perolehan (rates) server secara langsung (real-time) tanpa harus mematikan atau me-restart server:
- **Monster EXP Rate (%)**: Mengatur pengali EXP dari membunuh monster (`set_node_exp <node> <rate>`). Default `100` (1x).
- **Quest EXP Rate (%)**: Mengatur target pengali EXP misi/quest. Default `100` (1x).
- **Item Drop Rate (%)**: Mengatur pengali peluang drop item dari monster (`set_node_drop <node> <rate>`). Default `100` (1x).
- **Gold Gain Rate (%)**: Mengatur pengali perolehan uang gold (`set_node_gold <node> <rate>`). Default `100` (1x).
- **Loyalty / NP Rate (%)**: Mengatur pengali perolehan Loyalty Points (`set_node_np <node> <rate>`). Default `100` (1x).

## Integrasi ZoneServer Real-Time CGI
ZoneServer menyediakan antarmuka socket TCP CGI pada port `20060`:
- **Host**: `10.11.18.118` (internal LAN server)
- **Port**: `20060` (`CGIPort` di `setup.ini`)
- **Key**: `0KjaM85BjfqjA` (`CGIKey` di `setup.ini`)
- **Protokol Paket**:
  - Format frame: `uint16_le(payload_len) + uint16_le(string_len) + string_bytes`
  - Format string: `<CGIKey>,<command>`
  - Perintah didukung:
    - `set_node_exp 0 <rate>`
    - `set_node_drop 0 <rate>`
    - `set_node_gold 0 <rate>`
    - `set_node_np 0 <rate>`
    - `gm <message>` / `announce <message>`

Node `0` mewakili seluruh node / realm broadcast.

## Database Schema (`FFAccount`)
Pengaturan dan jadwal event disimpan di tabel:
- `dashboard.exp_bonus_settings`: Menyimpan konfigurasi rate dasar, status event terjadwal, waktu mulai/selesai, rate event, dan status apply terakhir.
- `dashboard.exp_bonus_history`: Menyimpan jejak audit (audit trail) setiap perubahan rate atau aktivasi event oleh operator.
