BEGIN;

CREATE SCHEMA IF NOT EXISTS dashboard;

CREATE TABLE IF NOT EXISTS dashboard.drop_loot_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    drop_rate INTEGER NOT NULL DEFAULT 100,
    boss_drop_rate INTEGER NOT NULL DEFAULT 100,
    dungeon_drop_rate INTEGER NOT NULL DEFAULT 100,
    quest_drop_rate INTEGER NOT NULL DEFAULT 100,
    gold_drop_rate INTEGER NOT NULL DEFAULT 100,
    extra_loot_chance INTEGER NOT NULL DEFAULT 0,
    rare_drop_rate INTEGER NOT NULL DEFAULT 100,
    is_event_active BOOLEAN NOT NULL DEFAULT FALSE,
    event_name VARCHAR(120),
    event_start TIMESTAMP WITH TIME ZONE,
    event_end TIMESTAMP WITH TIME ZONE,
    event_drop_rate INTEGER NOT NULL DEFAULT 200,
    event_boss_drop_rate INTEGER NOT NULL DEFAULT 150,
    event_dungeon_drop_rate INTEGER NOT NULL DEFAULT 200,
    event_quest_drop_rate INTEGER NOT NULL DEFAULT 150,
    event_gold_drop_rate INTEGER NOT NULL DEFAULT 150,
    event_extra_loot_chance INTEGER NOT NULL DEFAULT 25,
    event_rare_drop_rate INTEGER NOT NULL DEFAULT 150,
    broadcast_event BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    last_applied_at TIMESTAMP WITH TIME ZONE,
    last_applied_status TEXT,
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO dashboard.drop_loot_settings (
    id, drop_rate, boss_drop_rate, dungeon_drop_rate, quest_drop_rate, gold_drop_rate, extra_loot_chance, rare_drop_rate
) VALUES (1, 100, 100, 100, 100, 100, 0, 100)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS dashboard.drop_loot_history (
    id BIGSERIAL PRIMARY KEY,
    operator VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    drop_rate INTEGER NOT NULL,
    boss_drop_rate INTEGER NOT NULL,
    dungeon_drop_rate INTEGER NOT NULL,
    gold_drop_rate INTEGER NOT NULL,
    extra_loot_chance INTEGER NOT NULL,
    rare_drop_rate INTEGER NOT NULL DEFAULT 100,
    is_event_active BOOLEAN NOT NULL DEFAULT FALSE,
    event_name VARCHAR(120),
    applied_to_server BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT ALL ON TABLE dashboard.drop_loot_settings TO akdashboard;
GRANT ALL ON TABLE dashboard.drop_loot_history TO akdashboard;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA dashboard TO akdashboard;

COMMIT;
