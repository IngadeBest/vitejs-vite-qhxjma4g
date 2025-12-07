-- Update bestaande inschrijvingen: voeg " - Jeugd" toe aan klasse als leeftijd_ruiter = 'Jeugd'
-- en de klasse nog niet " - Jeugd" bevat

UPDATE inschrijvingen
SET klasse = klasse || ' - Jeugd'
WHERE leeftijd_ruiter = 'Jeugd'
  AND klasse NOT LIKE '% - Jeugd';

-- Controleer resultaat
SELECT 
  id,
  klasse,
  leeftijd_ruiter,
  ruiter,
  paard
FROM inschrijvingen
WHERE leeftijd_ruiter = 'Jeugd'
ORDER BY klasse, ruiter;
