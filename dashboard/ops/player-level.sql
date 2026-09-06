BEGIN;

CREATE SCHEMA IF NOT EXISTS dashboard;

-- 1. Pending / completed level assignments.
--    One row per character: a new assignment replaces the previous one,
--    so an operator can correct a mistake before it lands.
CREATE TABLE IF NOT EXISTS dashboard.player_level_assignment (
    player_id     BIGINT PRIMARY KEY,
    player_name   VARCHAR(64) NOT NULL,
    target_level  INTEGER NOT NULL,
    from_level    INTEGER,
    status        VARCHAR(16) NOT NULL DEFAULT 'pending',
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    requested_by  VARCHAR(64) NOT NULL,
    requested_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    applied_at    TIMESTAMP WITH TIME ZONE,
    CONSTRAINT player_level_status_known
      CHECK (status IN ('pending', 'applied', 'failed', 'cancelled')),
    CONSTRAINT player_level_target_sane
      CHECK (target_level >= 1 AND target_level <= 255)
);

-- The background sweep only ever asks for pending rows.
CREATE INDEX IF NOT EXISTS idx_player_level_pending
    ON dashboard.player_level_assignment (requested_at)
    WHERE status = 'pending';

-- A written level is not trusted until it has been read back, so the write
-- is stamped here and the sweep confirms it later. Added after the table
-- shipped, hence the ALTERs.
ALTER TABLE dashboard.player_level_assignment
    ADD COLUMN IF NOT EXISTS written_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dashboard.player_level_assignment
    ADD COLUMN IF NOT EXISTS note TEXT;

-- 2. Audit trail. Every applied change is kept, even after the
--    assignment row is replaced by a later one for the same character.
CREATE TABLE IF NOT EXISTS dashboard.player_level_history (
    id           BIGSERIAL PRIMARY KEY,
    player_id    BIGINT NOT NULL,
    player_name  VARCHAR(64) NOT NULL,
    from_level   INTEGER,
    to_level     INTEGER NOT NULL,
    action       VARCHAR(16) NOT NULL,
    operator     VARCHAR(64) NOT NULL,
    details      TEXT,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_level_history_player
    ON dashboard.player_level_history (player_id, created_at DESC);

-- Grants
GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT ALL ON TABLE dashboard.player_level_assignment TO akdashboard;
GRANT ALL ON TABLE dashboard.player_level_history TO akdashboard;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA dashboard TO akdashboard;

COMMIT;
