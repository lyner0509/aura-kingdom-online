BEGIN;

CREATE SCHEMA IF NOT EXISTS dashboard;

-- 1. VIP Global Settings
CREATE TABLE IF NOT EXISTS dashboard.vip_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    points_per_ap INTEGER NOT NULL DEFAULT 1,
    auto_vip_on_spending BOOLEAN NOT NULL DEFAULT TRUE,
    daily_mail_reward_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    daily_mail_title VARCHAR(60) NOT NULL DEFAULT 'Hadiah Harian VIP Server',
    daily_mail_content TEXT NOT NULL DEFAULT 'Terima kasih atas dukunganmu pada server! Berikut hadiah harian sesuai tingkat VIP akunmu.',
    last_mail_dispatch_at TIMESTAMP WITH TIME ZONE,
    last_mail_dispatch_status TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO dashboard.vip_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. VIP Tiers
CREATE TABLE IF NOT EXISTS dashboard.vip_tiers (
    level INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    required_points INTEGER NOT NULL,
    exp_bonus_percent INTEGER NOT NULL DEFAULT 10,
    drop_bonus_percent INTEGER NOT NULL DEFAULT 5,
    gold_bonus_percent INTEGER NOT NULL DEFAULT 5,
    move_speed_percent INTEGER NOT NULL DEFAULT 2,
    daily_loyalty_points INTEGER NOT NULL DEFAULT 50,
    daily_item_id INTEGER NOT NULL DEFAULT 0,
    daily_item_count INTEGER NOT NULL DEFAULT 1,
    buff_desc VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed default tiers 1-10
INSERT INTO dashboard.vip_tiers (level, name, required_points, exp_bonus_percent, drop_bonus_percent, gold_bonus_percent, move_speed_percent, daily_loyalty_points, daily_item_id, daily_item_count, buff_desc)
VALUES
(1, 'VIP 1 - Bronze', 100, 10, 5, 5, 2, 50, 42001, 1, 'Bonus EXP 10%, Drop 5%, Gold 5%, Speed 2%'),
(2, 'VIP 2 - Iron', 300, 15, 10, 8, 4, 100, 42002, 1, 'Bonus EXP 15%, Drop 10%, Gold 8%, Speed 4%'),
(3, 'VIP 3 - Silver', 600, 20, 15, 10, 6, 150, 42003, 1, 'Bonus EXP 20%, Drop 15%, Gold 10%, Speed 6%'),
(4, 'VIP 4 - Gold', 1000, 25, 20, 15, 8, 200, 42004, 1, 'Bonus EXP 25%, Drop 20%, Gold 15%, Speed 8%'),
(5, 'VIP 5 - Platinum', 2000, 30, 25, 20, 10, 300, 42005, 1, 'Bonus EXP 30%, Drop 25%, Gold 20%, Speed 10%'),
(6, 'VIP 6 - Diamond', 3500, 35, 30, 25, 12, 400, 42006, 1, 'Bonus EXP 35%, Drop 30%, Gold 25%, Speed 12%'),
(7, 'VIP 7 - Master', 5000, 40, 35, 30, 14, 500, 42007, 1, 'Bonus EXP 40%, Drop 35%, Gold 30%, Speed 14%'),
(8, 'VIP 8 - Grandmaster', 7500, 45, 40, 35, 16, 650, 42008, 1, 'Bonus EXP 45%, Drop 40%, Gold 35%, Speed 16%'),
(9, 'VIP 9 - Legend', 10000, 50, 45, 40, 18, 800, 42009, 1, 'Bonus EXP 50%, Drop 45%, Gold 40%, Speed 18%'),
(10, 'VIP 10 - Mythic', 15000, 60, 50, 50, 20, 1000, 42010, 2, 'Bonus EXP 60%, Drop 50%, Gold 50%, Speed 20%')
ON CONFLICT (level) DO NOTHING;

-- 3. Account VIP records
CREATE TABLE IF NOT EXISTS dashboard.account_vip (
    account_id INTEGER PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    vip_level INTEGER NOT NULL DEFAULT 1,
    vip_points INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_daily_claim_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM'
);

CREATE INDEX IF NOT EXISTS idx_account_vip_username ON dashboard.account_vip(username);
CREATE INDEX IF NOT EXISTS idx_account_vip_active ON dashboard.account_vip(is_active);

-- 4. VIP History / Audit trail
CREATE TABLE IF NOT EXISTS dashboard.vip_history (
    id BIGSERIAL PRIMARY KEY,
    operator VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    target_account VARCHAR(32),
    vip_level INTEGER,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Grants
GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT ALL ON TABLE dashboard.vip_settings TO akdashboard;
GRANT ALL ON TABLE dashboard.vip_tiers TO akdashboard;
GRANT ALL ON TABLE dashboard.account_vip TO akdashboard;
GRANT ALL ON TABLE dashboard.vip_history TO akdashboard;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA dashboard TO akdashboard;

COMMIT;
