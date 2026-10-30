-- Progression synchronisée : une ligne par code de synchronisation et par saison.
-- user_hash : SHA-256 du code (le code lui-même n'est jamais stocké).
-- data : la table de progression en JSON, telle que l'application la garde en local.
-- rev : incrémenté à chaque écriture, pour détecter deux appareils qui écrivent en même temps.
CREATE TABLE IF NOT EXISTS progress (
  user_hash TEXT NOT NULL,
  season TEXT NOT NULL,
  data TEXT NOT NULL,
  rev INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_hash, season)
) WITHOUT ROWID;
