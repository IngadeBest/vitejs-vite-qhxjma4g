-- Kopieer scores van WE0 proeven naar WE0 - Jeugd proeven voor jeugdruiters
-- Stap 1: Vind de juiste proef mappings (WE0 -> WE0 - Jeugd voor zelfde datum en onderdeel)

-- Voor de wedstrijd van 7 december 2025:
-- Dit script kopieert scores van jeugdruiters van WE0 proeven naar WE0 - Jeugd proeven

WITH jeugd_ruiters AS (
  -- Vind alle jeugdruiters (die nu klasse 'WE0 - Jeugd' hebben)
  SELECT DISTINCT startnummer
  FROM inschrijvingen
  WHERE wedstrijd_id = 'a070c9c5-c0d7-4e43-bf6c-d145ad4838d6'  -- Pas aan naar je wedstrijd_id
    AND klasse LIKE '%Jeugd%'
    AND startnummer IS NOT NULL
),
proef_mappings AS (
  -- Map WE0 proeven naar WE0 - Jeugd proeven op basis van datum en onderdeel
  SELECT 
    p1.id AS we0_proef_id,
    p1.onderdeel,
    p1.datum,
    p2.id AS jeugd_proef_id
  FROM proeven p1
  JOIN proeven p2 
    ON p1.datum = p2.datum 
    AND p1.onderdeel = p2.onderdeel
  WHERE p1.klasse LIKE 'Introductieklasse (WE0)'
    AND p2.klasse LIKE 'Introductieklasse (WE0)%Jeugd%'
    AND p1.datum = '2025-12-07'  -- Pas aan naar je wedstrijd datum
),
scores_to_copy AS (
  -- Vind alle scores van jeugdruiters voor WE0 proeven
  SELECT 
    s.ruiter_id,
    s.proef_id AS oude_proef_id,
    pm.jeugd_proef_id AS nieuwe_proef_id,
    s.score,
    s.dq
  FROM scores s
  JOIN jeugd_ruiters jr ON s.ruiter_id = jr.startnummer
  JOIN proef_mappings pm ON s.proef_id = pm.we0_proef_id
  WHERE NOT EXISTS (
    -- Alleen kopiëren als er nog geen score bestaat voor deze ruiter in de jeugd proef
    SELECT 1 FROM scores s2
    WHERE s2.ruiter_id = s.ruiter_id
      AND s2.proef_id = pm.jeugd_proef_id
  )
)
-- Voer de insert uit
INSERT INTO scores (ruiter_id, proef_id, score, dq)
SELECT ruiter_id, nieuwe_proef_id, score, dq
FROM scores_to_copy;

-- Controleer resultaat
SELECT 
  i.ruiter,
  i.paard,
  i.klasse,
  p.onderdeel,
  p.klasse AS proef_klasse,
  s.score
FROM scores s
JOIN proeven p ON s.proef_id = p.id
JOIN inschrijvingen i ON s.ruiter_id = i.startnummer
WHERE i.klasse LIKE '%Jeugd%'
  AND p.datum = '2025-12-07'
ORDER BY i.ruiter, p.onderdeel;
