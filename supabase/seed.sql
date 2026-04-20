-- =============================================================================
-- Elan Greens — Seed Data
-- Version : 1.0.0
-- Purpose : Populates the 22 known plant species from John's initial list.
--           All botanical/descriptive fields are blank — to be filled via
--           the admin app camera upload + Plant.id identification flow.
--           tentative = true for all rows until admin verifies each entry.
-- =============================================================================

INSERT INTO plant_species
  (plant_id, common_name, category, active, tentative)
VALUES
  -- Trees / Palms / Flowering Plants
  ('P001', 'Royal Palm',                             'Palm',   true, true),
  ('P002', 'Norman Palm',                            'Palm',   true, true),
  ('P003', 'Plumeria (White & Pink)',                'Tree',   true, true),
  ('P004', 'Spathodea (Red) – Flame of Forest',      'Tree',   true, true),
  ('P005', 'Tabebuia – Pink',                        'Tree',   true, true),
  ('P006', 'Plumbago',                               'Shrub',  true, true),
  ('P007', 'Golden Cypress',                         'Tree',   true, true),
  ('P008', 'Morayya (White Jasmine)',                'Shrub',  true, true),
  ('P009', 'Rose',                                   'Shrub',  true, true),
  ('P010', 'Bougainvillea (White, Pink, Red, Yellow)','Climber',true, true),
  ('P011', 'Ficus varieties',                        'Tree',   true, true),
  ('P012', 'Neem Tree',                              'Tree',   true, true),
  ('P013', 'Brahma Kamala',                          'Herb',   true, true),

  -- Hedge / Border Plants
  ('P014', 'Golden Duranta',                         'Hedge',  true, true),
  ('P015', 'Eranthemum – Purple',                    'Shrub',  true, true),
  ('P016', 'Acalypha – Green',                       'Shrub',  true, true),
  ('P017', 'Acalypha – Red',                         'Shrub',  true, true),
  ('P018', 'Acalypha – Pink',                        'Shrub',  true, true),

  -- Ornamental / Flowering Shrubs
  ('P019', 'Croton Petra',                           'Shrub',  true, true),
  ('P020', 'Croton Plant',                           'Shrub',  true, true),
  ('P021', 'Pentas',                                 'Shrub',  true, true),
  ('P022', 'Table Rose',                             'Shrub',  true, true);
