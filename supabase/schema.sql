-- =============================================================================
-- Elan Greens — Supabase PostgreSQL Schema
-- Version : 1.0.0
-- Date    : April 2026
-- Shared  : Used by both elan-greens (main app) and elan-greens-admin
-- =============================================================================

-- Enable UUID generation (available by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- FUNCTION: set_updated_at
-- WHY: Rather than relying on application code to stamp updated_at on every
--      UPDATE, a DB trigger guarantees it never gets missed — even if a future
--      admin tool updates rows directly via the Supabase dashboard.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLE: plant_species
-- One row per unique plant species. Shared botanical data and images.
-- Physical locations of each plant are in plant_instances (FK to this table).
-- =============================================================================
CREATE TABLE plant_species (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  plant_id              VARCHAR(10)   UNIQUE NOT NULL,          -- e.g. P001
  common_name           VARCHAR(100)  NOT NULL,
  botanical_name        VARCHAR(150),
  hindi_name            VARCHAR(100),
  kannada_name          VARCHAR(100),
  tamil_name            VARCHAR(100),

  -- Classification
  category              VARCHAR(20)   NOT NULL
                          CHECK (category IN (
                            'Tree','Palm','Shrub','Herb',
                            'Creeper','Climber','Hedge','Grass'
                          )),
  height_category       VARCHAR(10)
                          CHECK (height_category IN ('Short','Medium','Tall')),
  flowering_type        VARCHAR(20)
                          CHECK (flowering_type IN ('Flowering','Non-Flowering')),
  flowering_season      VARCHAR(50),

  -- Descriptions (auto-filled by Plant.id, tagged tentative until verified)
  description           TEXT,
  medicinal_properties  TEXT,           -- pipe-separated values
  plant_family          VARCHAR(100),
  toxicity              VARCHAR(50),
  edible_parts          TEXT,
  native_region         VARCHAR(150),
  sunlight_needs        VARCHAR(30),
  watering_needs        VARCHAR(20),
  interesting_fact      TEXT,
  life_span_description VARCHAR(100),   -- e.g. "150–200 years"

  -- Image slots that are not applicable for this species (pipe-separated)
  -- e.g. "fruit|bark|root" for a lawn grass species
  not_applicable_parts  TEXT,

  -- Quality flags
  tentative             BOOLEAN       DEFAULT true,   -- true = AI-suggested, not yet verified
  active                BOOLEAN       DEFAULT true,

  -- Main hero image (uploaded to Supabase Storage by admin)
  img_main_url          TEXT,
  img_main_attr         VARCHAR(255),

  -- Sub-images auto-fetched from Wikimedia Commons after identification
  img_flower_1_url      TEXT,
  img_flower_1_attr     VARCHAR(255),
  img_flower_2_url      TEXT,
  img_flower_2_attr     VARCHAR(255),

  img_fruit_1_url       TEXT,
  img_fruit_1_attr      VARCHAR(255),
  img_fruit_2_url       TEXT,
  img_fruit_2_attr      VARCHAR(255),

  img_leaf_1_url        TEXT,
  img_leaf_1_attr       VARCHAR(255),
  img_leaf_2_url        TEXT,
  img_leaf_2_attr       VARCHAR(255),

  img_bark_1_url        TEXT,
  img_bark_1_attr       VARCHAR(255),
  img_bark_2_url        TEXT,
  img_bark_2_attr       VARCHAR(255),

  img_root_1_url        TEXT,
  img_root_1_attr       VARCHAR(255),
  img_root_2_url        TEXT,
  img_root_2_attr       VARCHAR(255),

  notes                 TEXT,

  -- Audit
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ             -- NULL = active; non-null = soft deleted
);

-- =============================================================================
-- TABLE: plant_instances
-- One row per physical plant in the society.
-- Many instances can share one species (e.g. 10 Neem trees = 10 rows here,
-- but all point to the single Neem row in plant_species).
-- =============================================================================
CREATE TABLE plant_instances (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id                  UUID    NOT NULL
                                REFERENCES plant_species(id) ON DELETE RESTRICT,

  -- Society's own internal tree number (optional, assigned by society manager)
  internal_identification_no  INTEGER,

  -- Location — captured from photo EXIF, browser geolocation, or manual entry
  lat                         DECIMAL(10,7),
  lng                         DECIMAL(10,7),
  custom_location_desc        VARCHAR(100),   -- e.g. "Behind Block E"

  date_of_plantation          DATE,

  active                      BOOLEAN       DEFAULT true,

  -- Audit
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at                  TIMESTAMPTZ
);

-- =============================================================================
-- TABLE: staff_data
-- Gardening and maintenance staff. Shown on "Our Green Team" page.
-- =============================================================================
CREATE TABLE staff_data (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        VARCHAR(10)   UNIQUE NOT NULL,     -- e.g. S001
  name            VARCHAR(100)  NOT NULL,
  role            VARCHAR(50)   NOT NULL
                    CHECK (role IN (
                      'Head Gardener',
                      'Assistant Gardener',
                      'Maintenance Staff'
                    )),
  date_of_joining DATE,                              -- FE computes tenure from this
  speciality      VARCHAR(150),
  photo_url       TEXT,                              -- Supabase Storage URL
  tribute_note    TEXT,

  active          BOOLEAN       DEFAULT true,

  -- Audit
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- =============================================================================
-- TRIGGERS — auto-stamp updated_at on every UPDATE
-- WHY: Keeps change history reliable without trusting application code.
-- =============================================================================
CREATE TRIGGER trg_plant_species_updated_at
  BEFORE UPDATE ON plant_species
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_plant_instances_updated_at
  BEFORE UPDATE ON plant_instances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_data_updated_at
  BEFORE UPDATE ON staff_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- INDEXES
-- WHY: The main app queries by common_name (search), category (filter),
--      and active/deleted_at (every query). These indexes make those fast.
-- =============================================================================
CREATE INDEX idx_species_common_name  ON plant_species(lower(common_name));
CREATE INDEX idx_species_category     ON plant_species(category);
CREATE INDEX idx_species_active       ON plant_species(active, deleted_at);
CREATE INDEX idx_instances_species_id ON plant_instances(species_id);
CREATE INDEX idx_instances_active     ON plant_instances(active, deleted_at);
CREATE INDEX idx_staff_active         ON staff_data(active, deleted_at);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- WHY: Enforces access rules at the database layer, not just application layer.
--      Public (anon) key used in the main app can only READ active, visible rows.
--      The admin app uses the service_role key server-side — it bypasses RLS,
--      which is why admin API routes must NEVER be called from the browser.
-- =============================================================================
ALTER TABLE plant_species  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_data     ENABLE ROW LEVEL SECURITY;

-- Public read: only active, non-deleted rows visible to the main app
CREATE POLICY "public_read_plant_species"
  ON plant_species FOR SELECT
  TO anon, authenticated
  USING (active = true AND deleted_at IS NULL);

CREATE POLICY "public_read_plant_instances"
  ON plant_instances FOR SELECT
  TO anon, authenticated
  USING (active = true AND deleted_at IS NULL);

CREATE POLICY "public_read_staff_data"
  ON staff_data FOR SELECT
  TO anon, authenticated
  USING (active = true AND deleted_at IS NULL);

-- =============================================================================
-- STORAGE BUCKETS (run in Supabase dashboard Storage tab, or via API)
-- WHY: Separate buckets for plants vs staff keeps storage organised and
--      allows different access policies per bucket in future.
-- =============================================================================
-- Create via Supabase dashboard:
--   Bucket name: "plant-images"   | Public: true
--   Bucket name: "staff-photos"   | Public: true
-- Both set to public so image URLs work directly in <img> tags without
-- signed URL overhead on every page load.
