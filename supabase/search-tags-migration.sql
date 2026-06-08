-- Add search_tags column for color/visual label search
ALTER TABLE plant_species ADD COLUMN IF NOT EXISTS search_tags text;
COMMENT ON COLUMN plant_species.search_tags IS 'Pipe-separated visual tags e.g. "flower|white|pink|shrub|petal". Computed by Google Vision on photo upload.';
