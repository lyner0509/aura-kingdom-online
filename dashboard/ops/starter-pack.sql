CREATE SCHEMA IF NOT EXISTS dashboard;

-- 1. Starter pack settings table
CREATE TABLE IF NOT EXISTS dashboard.starter_pack_settings (
    id INT PRIMARY KEY DEFAULT 1,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_deliver_new_chars BOOLEAN NOT NULL DEFAULT false,
    mail_sender_name VARCHAR(32) NOT NULL DEFAULT 'Azuria Operations',
    mail_title VARCHAR(40) NOT NULL DEFAULT '[Starter Pack] Paket Petualang',
    mail_content TEXT NOT NULL DEFAULT 'Selamat datang di Dunia Aura Kingdom! Berikut adalah paket perlengkapan petualang untuk membantumu memulai perjalanan di Azuria.',
    bonus_gold INT NOT NULL DEFAULT 50000,
    bonus_loyalty_points INT NOT NULL DEFAULT 500,
    min_character_level INT NOT NULL DEFAULT 1,
    max_claims_per_account INT NOT NULL DEFAULT 1,
    last_dispatch_at TIMESTAMPTZ,
    last_dispatch_status TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL DEFAULT 'system',
    CONSTRAINT single_row_starter_pack CHECK (id = 1)
);

INSERT INTO dashboard.starter_pack_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Starter pack items table
CREATE TABLE IF NOT EXISTS dashboard.starter_pack_items (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL,
    item_name VARCHAR(128) NOT NULL DEFAULT '',
    item_count INT NOT NULL DEFAULT 1,
    is_bound BOOLEAN NOT NULL DEFAULT true,
    category VARCHAR(32) NOT NULL DEFAULT 'general',
    sort_order INT NOT NULL DEFAULT 0,
    note VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT valid_item_count CHECK (item_count > 0 AND item_count <= 999)
);

CREATE INDEX IF NOT EXISTS idx_starter_pack_items_sort ON dashboard.starter_pack_items (sort_order, id);

-- Seed default starter pack items if table is empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dashboard.starter_pack_items) THEN
        INSERT INTO dashboard.starter_pack_items (item_id, item_name, item_count, is_bound, category, sort_order, note)
        VALUES
            (40358, '20-Slot Backpack (Non-tradable)', 2, true, 'bag', 1, 'Perluas kapasitas inventory petualang'),
            (40079, '24 Hour XP Crystal (Non-tradable)', 5, true, 'buff', 2, 'Booster EXP 24 jam'),
            (40239, 'Instant Teleportation Stone', 20, true, 'consumable', 3, 'Teleport cepat ke lokasi mana pun'),
            (40035, 'Feather of Revival (Non-tradable)', 10, true, 'consumable', 4, 'Bangkit di tempat saat gugur'),
            (40176, 'Exclusive Healing Potion (Non-tradable)', 50, true, 'potion', 5, 'Ramuan pemulih HP instan'),
            (40348, 'Dragon Point Crystal: 500', 2, true, 'currency', 6, 'Poin naga untuk ditukar hadiah khusus'),
            (40214, '100 Loyalty Points', 5, true, 'currency', 7, 'Loyalty points ekstra');
    END IF;
END $$;

-- 3. Claims history
CREATE TABLE IF NOT EXISTS dashboard.starter_pack_claims (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    username VARCHAR(64) NOT NULL,
    character_id INT NOT NULL,
    character_name VARCHAR(64) NOT NULL,
    delivery_method VARCHAR(32) NOT NULL DEFAULT 'manual',
    items_delivered_count INT NOT NULL DEFAULT 0,
    gold_delivered INT NOT NULL DEFAULT 0,
    loyalty_delivered INT NOT NULL DEFAULT 0,
    operator VARCHAR(64) NOT NULL DEFAULT 'system',
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_starter_claims_acc ON dashboard.starter_pack_claims (account_id);
CREATE INDEX IF NOT EXISTS idx_starter_claims_char ON dashboard.starter_pack_claims (character_id);
CREATE INDEX IF NOT EXISTS idx_starter_claims_time ON dashboard.starter_pack_claims (claimed_at DESC);

-- 4. Audit trail
CREATE TABLE IF NOT EXISTS dashboard.starter_pack_history (
    id SERIAL PRIMARY KEY,
    operator VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    target VARCHAR(64),
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_starter_history_created ON dashboard.starter_pack_history (created_at DESC);

-- Permissions
GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dashboard.starter_pack_settings TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dashboard.starter_pack_items TO akdashboard;
GRANT USAGE, SELECT ON SEQUENCE dashboard.starter_pack_items_id_seq TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dashboard.starter_pack_claims TO akdashboard;
GRANT USAGE, SELECT ON SEQUENCE dashboard.starter_pack_claims_id_seq TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dashboard.starter_pack_history TO akdashboard;
GRANT USAGE, SELECT ON SEQUENCE dashboard.starter_pack_history_id_seq TO akdashboard;
GRANT SELECT, UPDATE (gift_point) ON TABLE public.accounts TO akdashboard;
