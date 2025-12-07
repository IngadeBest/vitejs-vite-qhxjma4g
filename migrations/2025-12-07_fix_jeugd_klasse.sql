-- Update bestaande inschrijvingen: voeg " - Jeugd" toe aan klasse als rubriek = 'Jeugd'
-- en de klasse nog niet " - Jeugd" bevat

UPDATE inschrijvingen
SET klasse = klasse || ' - Jeugd'
WHERE rubriek = 'Jeugd'
  AND klasse NOT LIKE '% - Jeugd';

-- Controleer resultaat
SELECT 
  id,
  klasse,
  rubriek,
  ruiter,
  paard
FROM inschrijvingen
WHERE rubriek = 'Jeugd'
ORDER BY klasse, ruiter;
