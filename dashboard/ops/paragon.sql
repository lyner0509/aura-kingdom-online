-- Run once as postgres against FFAccount. Game tables other than lottery remain SELECT-only.
BEGIN;
CREATE SCHEMA IF NOT EXISTS dashboard;
CREATE TABLE IF NOT EXISTS dashboard.paragon_history (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_rows jsonb NOT NULL,
  after_rows jsonb NOT NULL
);
GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT SELECT, INSERT ON dashboard.paragon_history TO akdashboard;
GRANT USAGE ON SEQUENCE dashboard.paragon_history_id_seq TO akdashboard;
GRANT UPDATE (item_id, max_stack, drop_rate, notify, get_only, shining_hint, jack_pot)
  ON public.lottery TO akdashboard;
COMMIT;
