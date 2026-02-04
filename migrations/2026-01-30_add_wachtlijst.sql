-- Migration: Add wachtlijst (waitlist) functionality
-- Date: 2026-01-30

-- Create wachtlijst table
CREATE TABLE IF NOT EXISTS wachtlijst (
  id SERIAL PRIMARY KEY,
  wedstrijd_id INTEGER NOT NULL REFERENCES wedstrijden(id) ON DELETE CASCADE,
  klasse VARCHAR(20) NOT NULL,
  ruiter VARCHAR(255) NOT NULL,
  paard VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefoon VARCHAR(50),
  weh_lid BOOLEAN DEFAULT false,
  leeftijd_ruiter INTEGER,
  geslacht_paard VARCHAR(20),
  omroeper VARCHAR(255),
  opmerkingen TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  notified_at TIMESTAMP,
  CONSTRAINT wachtlijst_unique_entry UNIQUE(wedstrijd_id, klasse, email, ruiter, paard)
);

-- Add wachtlijst_enabled column to wedstrijden table
ALTER TABLE wedstrijden 
ADD COLUMN IF NOT EXISTS wachtlijst_enabled BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wachtlijst_wedstrijd ON wachtlijst(wedstrijd_id);
CREATE INDEX IF NOT EXISTS idx_wachtlijst_created ON wachtlijst(created_at);

-- Add comment
COMMENT ON TABLE wachtlijst IS 'Wachtlijst voor volle wedstrijden - mensen kunnen zich aanmelden als er geen plek meer is';
COMMENT ON COLUMN wachtlijst.notified_at IS 'Timestamp wanneer persoon is genotificeerd over beschikbare plek';
