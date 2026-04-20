# Entity Relationship Diagram
## Elan Greens — Database Schema v1.0.0

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
    text        not_applicable_parts      "pipe-separated e.g. fruit-bark-root"
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

  plant_species ||--o{ plant_instances : "has locations"
```

---

## Relationship Explained

| Relationship | Type | Meaning |
|---|---|---|
| `plant_species` to `plant_instances` | One-to-Many | One species (e.g. Neem) can exist at many physical locations in the society. Deleting a species is blocked (`ON DELETE RESTRICT`) if instances exist. |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Species and instances in separate tables | Avoids duplicating botanical data and images for every physical plant. 10 Neem trees = 10 instance rows, but images and descriptions stored once. |
| Soft delete via `deleted_at` | Deleted records are hidden from the public app but recoverable from admin. No permanent data loss in v1. |
| `updated_at` via DB trigger | Guaranteed accurate regardless of which tool modifies the row — admin app, Supabase dashboard, or SQL editor. |
| `tentative` boolean | All AI-identified data starts as tentative. Admin removes the flag after manual verification. |
| RLS at DB layer | Public anon key can only read `active = true AND deleted_at IS NULL`. Write access requires service_role key, kept server-side only. |
| `not_applicable_parts` field | Reusable across grasses, some creepers, and other species where certain image categories do not apply. Stored pipe-separated, parsed by the app. |
