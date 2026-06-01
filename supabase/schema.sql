-- Turnpike — Supabase Database Schema
-- Run this in the Supabase SQL editor after creating your project.

-- Publishers table (one row per publisher account)
CREATE TABLE IF NOT EXISTS publishers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  provider_wallet  TEXT NOT NULL,      -- Base USDC wallet address (0x...)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-level security: publishers can only read/update their own row
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "publishers_self_read" ON publishers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "publishers_self_update" ON publishers
  FOR UPDATE USING (auth.uid() = id);

-- Withdrawals log (Transak offramp requests)
CREATE TABLE IF NOT EXISTS withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  amount_usdc  NUMERIC(18, 6) NOT NULL,
  iban         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  transak_id   TEXT,                            -- Transak order ID
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_self_read" ON withdrawals
  FOR SELECT USING (auth.uid() = publisher_id);

-- Auto-withdrawal settings per publisher
CREATE TABLE IF NOT EXISTS auto_withdrawal_settings (
  publisher_id     UUID PRIMARY KEY REFERENCES publishers(id) ON DELETE CASCADE,
  enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  threshold_usdc   NUMERIC(18, 6) NOT NULL DEFAULT 50,  -- trigger when balance exceeds this
  iban             TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auto_withdrawal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_withdrawal_self" ON auto_withdrawal_settings
  FOR ALL USING (auth.uid() = publisher_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_withdrawals_publisher ON withdrawals(publisher_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status    ON withdrawals(status);

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER publishers_updated_at
  BEFORE UPDATE ON publishers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER withdrawals_updated_at
  BEFORE UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER auto_withdrawal_updated_at
  BEFORE UPDATE ON auto_withdrawal_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
