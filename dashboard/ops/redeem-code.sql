BEGIN;

CREATE SCHEMA IF NOT EXISTS dashboard;

CREATE TABLE IF NOT EXISTS dashboard.redeem_code_history (
    id SERIAL PRIMARY KEY,
    operator VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    pin VARCHAR(16),
    rule_id INTEGER,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT USAGE ON SCHEMA dashboard TO akdashboard;
GRANT ALL ON TABLE dashboard.redeem_code_history TO akdashboard;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA dashboard TO akdashboard;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exchange_pin TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exchange_rule TO akdashboard;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exchange_list TO akdashboard;
GRANT SELECT, INSERT, UPDATE ON TABLE public.item_receivable TO akdashboard;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.item_receivable_id_seq TO akdashboard;

COMMIT;
