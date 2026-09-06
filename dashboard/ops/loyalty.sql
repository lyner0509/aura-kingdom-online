-- Run once as postgres against FFAccount.
BEGIN;
CREATE SCHEMA IF NOT EXISTS dashboard;

CREATE TABLE IF NOT EXISTS dashboard.loyalty_shop (
  id serial PRIMARY KEY,
  item_id integer NOT NULL CHECK (item_id > 0),
  category varchar(64) NOT NULL DEFAULT 'Populer',
  cost_lp integer NOT NULL CHECK (cost_lp >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 32767),
  buy_limit integer NOT NULL DEFAULT 0 CHECK (buy_limit >= 0),
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active smallint NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_shop_category ON dashboard.loyalty_shop(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_loyalty_shop_active ON dashboard.loyalty_shop(is_active);

CREATE TABLE IF NOT EXISTS dashboard.loyalty_history (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_rows jsonb NOT NULL,
  after_rows jsonb NOT NULL
);

GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard.loyalty_shop TO akdashboard;
GRANT USAGE, SELECT ON SEQUENCE dashboard.loyalty_shop_id_seq TO akdashboard;
GRANT SELECT, INSERT ON dashboard.loyalty_history TO akdashboard;
GRANT USAGE, SELECT ON SEQUENCE dashboard.loyalty_history_id_seq TO akdashboard;
COMMIT;
