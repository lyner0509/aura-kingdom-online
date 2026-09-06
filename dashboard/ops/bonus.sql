-- Run once as postgres against FFAccount.
BEGIN;
CREATE SCHEMA IF NOT EXISTS dashboard;
CREATE TABLE IF NOT EXISTS dashboard.bonus_history (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_rows jsonb NOT NULL,
  after_rows jsonb NOT NULL
);
GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT SELECT, INSERT ON dashboard.bonus_history TO akdashboard;
GRANT USAGE, SELECT ON SEQUENCE dashboard.bonus_history_id_seq TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itemmall TO akdashboard;
COMMIT;
