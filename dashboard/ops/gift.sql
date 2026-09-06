CREATE SCHEMA IF NOT EXISTS dashboard;

-- 1. Default gift settings and templates
CREATE TABLE IF NOT EXISTS dashboard.gift_settings (
    id INT PRIMARY KEY DEFAULT 1,
    default_sender_name VARCHAR(32) NOT NULL DEFAULT 'Game Master',
    default_mail_title VARCHAR(40) NOT NULL DEFAULT '[Hadiah GM] Hadiah Spesial',
    default_mail_content TEXT NOT NULL DEFAULT 'Selamat! Kamu menerima hadiah item dari Game Master. Selamat berpetualang di Azuria!',
    default_is_bound BOOLEAN NOT NULL DEFAULT true,
    allow_online_broadcast BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL DEFAULT 'admin',
    CONSTRAINT single_row_gift_settings CHECK (id = 1)
);

INSERT INTO dashboard.gift_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Audit trail of gifted items
CREATE TABLE IF NOT EXISTS dashboard.gift_history (
    id SERIAL PRIMARY KEY,
    operator VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL DEFAULT 'character', -- 'character', 'online', 'all'
    target_name VARCHAR(64) NOT NULL,
    char_id INT,
    item_id INT NOT NULL,
    item_name VARCHAR(128) NOT NULL DEFAULT '',
    item_count INT NOT NULL DEFAULT 1,
    is_bound BOOLEAN NOT NULL DEFAULT true,
    gold INT NOT NULL DEFAULT 0,
    title VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    announced BOOLEAN NOT NULL DEFAULT false,
    delivered_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_history_created ON dashboard.gift_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_history_char ON dashboard.gift_history (char_id);

-- Permissions
GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dashboard.gift_settings TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dashboard.gift_history TO akdashboard;
GRANT USAGE, SELECT ON SEQUENCE dashboard.gift_history_id_seq TO akdashboard;
