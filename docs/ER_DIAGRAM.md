# Entity Relationship Diagram
## Elan Greens — Database Schema v3.0.0

> Rendered automatically by GitHub. Uses [Mermaid](https://mermaid.js.org/) syntax.

```mermaid
erDiagram

  plant_species {
    uuid        id                    PK
    varchar     plant_id              UK  "e.g. P001"
    varchar     common_name               "Required"
    varchar     botanical_name
    varchar     hindi_name
    varchar     kannada_name
    varchar     tamil_name
    varchar     category                  "Tree/Palm/Shrub/Herb/Creeper/Climber/Hedge/Grass"
    varchar     height_category           "Short/Medium/Tall"
    varchar     flowering_type            "Flowering/Non-Flowering"
    varchar     flowering_season
    text        description
    text        medicinal_properties      "pipe-separated values"
    varchar     plant_family
    varchar     toxicity
    text        edible_parts
    varchar     native_region
    varchar     sunlight_needs
    varchar     watering_needs
    text        interesting_fact
    varchar     life_span_description     "e.g. 150-200 years"
    varchar     foliage_type              "Evergreen/Deciduous/Semi-evergreen — v3"
    varchar     conservation_status       "IUCN status — v3"
    integer     observations_count        "iNaturalist global count — v3"
    varchar     growth_rate               "Slow/Moderate/Fast — v3"
    text        propagation_methods       "pipe-separated — v3"
    text        habitat_type              "ecological context — v3"
    text        not_applicable_parts      "pipe-separated e.g. fruit|bark|root"
    boolean     tentative                 "true = AI-suggested, pending verification"
    boolean     active
    text        img_main_url
    varchar     img_main_attr
    text        img_flower_1_url
    varchar     img_flower_1_attr
    text        img_flower_2_url
    varchar     img_flower_2_attr
    text        img_fruit_1_url
    varchar     img_fruit_1_attr
    text        img_fruit_2_url
    varchar     img_fruit_2_attr
    text        img_leaf_1_url
    varchar     img_leaf_1_attr
    text        img_leaf_2_url
    varchar     img_leaf_2_attr
    text        img_bark_1_url
    varchar     img_bark_1_attr
    text        img_bark_2_url
    varchar     img_bark_2_attr
    text        img_root_1_url
    varchar     img_root_1_attr
    text        img_root_2_url
    varchar     img_root_2_attr
    text        notes
    timestamptz created_at
    timestamptz updated_at                "auto-stamped by DB trigger on every UPDATE"
    timestamptz deleted_at                "NULL = active, non-null = soft deleted"
  }

  plant_instances {
    uuid        id                    PK
    uuid        species_id            FK  "references plant_species.id"
    integer     internal_id               "Society tree number"
    decimal     lat                       "GPS from photo EXIF or browser"
    decimal     lng
    varchar     custom_location_desc      "e.g. Behind Block E"
    date        date_of_plantation
    boolean     active
    timestamptz created_at
    timestamptz updated_at                "auto-stamped by DB trigger"
    timestamptz deleted_at
  }

  staff_data {
    uuid        id                    PK
    varchar     staff_id              UK  "e.g. S001"
    varchar     name                      "Required"
    varchar     role                      "Head/Assistant Gardener or Maintenance Staff"
    date        date_of_joining           "FE computes tenure as X yrs Y months"
    varchar     speciality
    text        photo_url
    text        tribute_note
    boolean     active
    timestamptz created_at
    timestamptz updated_at                "auto-stamped by DB trigger"
    timestamptz deleted_at
  }

  plant_species_links {
    uuid        id                    PK
    uuid        species_a_id          FK  "references plant_species.id"
    uuid        species_b_id          FK  "references plant_species.id"
    varchar     link_label                "Same family / Common companion / Same use / etc."
    timestamptz created_at
  }

  news_sources {
    uuid        id                    PK
    varchar     domain                UK  "e.g. thebetterindia.com"
    varchar     label                     "e.g. The Better India"
    boolean     enabled                   "false = excluded from feed"
    integer     priority                  "0-10, higher = preferred"
    timestamptz created_at
  }

  app_settings {
    varchar     key                   PK  "e.g. news_max_articles"
    text        value                     "stored as string, parsed in code"
    text        description
    timestamptz updated_at
  }

  news_topic_queries {
    uuid        id                    PK
    text        query_text                "RSS search string e.g. Bengaluru landscaping"
    varchar     chip_label                "e.g. Green Bengaluru"
    varchar     chip_icon                 "emoji e.g. 🌳"
    boolean     enabled
    integer     priority                  "0-10, higher = runs first"
    timestamptz created_at
  }

  plant_species ||--o{ plant_instances : "has locations"
  plant_species ||--o{ plant_species_links : "linked as species_a"
  plant_species ||--o{ plant_species_links : "linked as species_b"
```

---

## Relationships Explained

| Relationship | Type | Meaning |
|---|---|---|
| `plant_species` → `plant_instances` | One-to-Many | One species (e.g. Neem) can exist at many physical locations. Soft-delete only — no cascade. |
| `plant_species` ↔ `plant_species_links` | Many-to-Many (self-join) | A species can be linked to multiple other species. One row covers both directions via `LEAST(species_a_id, species_b_id)` unique index. |
| `news_sources` | Standalone | Domain whitelist — no FK relationships. Compared against RSS-parsed article domains in `newsService.ts`. |
| `app_settings` | Standalone | Key-value store for algorithm tuneable knobs. Read once per `fetchPlantNews()` call. |
| `news_topic_queries` | Standalone | Each row generates one Google News RSS fetch in `newsService.ts`. |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Species and instances in separate tables | Avoids duplicating botanical data and images for every physical plant. 10 Neem trees = 10 instance rows, but images and descriptions stored once. |
| Soft delete via `deleted_at` | Deleted records are hidden from the public app but recoverable from admin. No permanent data loss. |
| `updated_at` via DB trigger | Guaranteed accurate regardless of which tool modifies the row — admin app, Supabase dashboard, or SQL editor. |
| `tentative` boolean | All AI-identified data starts as tentative. Admin removes the flag after manual verification. |
| RLS at DB layer | Public anon key can only read `active = true AND deleted_at IS NULL`. Write access requires service_role key, kept server-side only. |
| `not_applicable_parts` field | Reusable across grasses, some creepers, and other species where certain image categories do not apply. Stored pipe-separated, parsed by the app. |
| `plant_species_links` bidirectional via `LEAST/GREATEST` | Single row covers A→B and B→A. Unique constraint on `(LEAST(a,b), GREATEST(a,b))` prevents duplicate links. Queries must use `OR` on both columns. |
| News configuration in DB (not code) | `news_sources`, `app_settings`, `news_topic_queries` are all admin-editable via the Settings page. No code changes or deployment needed to add a source or tweak a knob. |
| `news_sources` fallback hardcoded in `newsService.ts` | If the table is empty (e.g. migration not yet run), a hardcoded fallback list of 10 trusted domains is used so the feed still works. |

---

## Schema Version History

| Version | Date | Changes |
|---|---|---|
| v1.0.0 | April 2026 | `plant_species`, `plant_instances`, `staff_data` |
| v3.0.0 | May 2026 | Added 6 enrichment columns to `plant_species`. Added `plant_species_links`, `news_sources`, `app_settings`, `news_topic_queries`. |
