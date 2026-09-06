BEGIN;

CREATE SCHEMA IF NOT EXISTS dashboard;

CREATE TABLE IF NOT EXISTS dashboard.exp_bonus_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    exp_rate INTEGER NOT NULL DEFAULT 100,
    quest_exp_rate INTEGER NOT NULL DEFAULT 100,
    drop_rate INTEGER NOT NULL DEFAULT 100,
    gold_rate INTEGER NOT NULL DEFAULT 100,
    np_rate INTEGER NOT NULL DEFAULT 100,
    is_event_active BOOLEAN NOT NULL DEFAULT FALSE,
    event_name VARCHAR(120),
    event_start TIMESTAMP WITH TIME ZONE,
    event_end TIMESTAMP WITH TIME ZONE,
    event_exp_rate INTEGER NOT NULL DEFAULT 200,
    event_quest_exp_rate INTEGER NOT NULL DEFAULT 150,
    event_drop_rate INTEGER NOT NULL DEFAULT 150,
    event_gold_rate INTEGER NOT NULL DEFAULT 150,
    event_np_rate INTEGER NOT NULL DEFAULT 150,
    broadcast_event BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    last_applied_at TIMESTAMP WITH TIME ZONE,
    last_applied_status TEXT,
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO dashboard.exp_bonus_settings (id, exp_rate, quest_exp_rate, drop_rate, gold_rate, np_rate)
VALUES (1, 100, 100, 100, 100, 100)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS dashboard.exp_bonus_history (
    id BIGSERIAL PRIMARY KEY,
    operator VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    exp_rate INTEGER NOT NULL,
    drop_rate INTEGER NOT NULL,
    gold_rate INTEGER NOT NULL,
    np_rate INTEGER NOT NULL,
    is_event_active BOOLEAN NOT NULL DEFAULT FALSE,
    event_name VARCHAR(120),
    applied_to_server BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT ALL ON TABLE dashboard.exp_bonus_settings TO akdashboard;
GRANT ALL ON TABLE dashboard.exp_bonus_history TO akdashboard;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA dashboard TO akdashboard;

COMMIT;
