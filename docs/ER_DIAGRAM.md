# Entity Relationship Diagram
## Elan Greens — Database Schema v1.0.0

> Rendered automatically by GitHub. Uses [Mermaid](https://mermaid.js.org/) syntax.

```mermaid
erDiagram

  plant_species {
    uuid        id                    PK
    varchar10   plant_id              UK  "e.g. P001"
    varchar100  common_name           NN
    varchar150  botanical_name
    varchar100  hindi_name
    varchar100  kannada_name
    varchar100  tamil_name
    varchar20   category              NN  "Tree/Palm/Shrub/Herb/Creeper/Climber/Hedge/Grass"
    varchar10   height_category           "Short/Medium/Tall"
    varchar20   flowering_type            "Flowering/Non-Flowering"
    varchar50   flowering_season
    text        description
    text        medicinal_properties      "pipe-separated"
    varchar100  plant_family
    varchar50   toxicity
    text        edible_parts
    varchar150  native_region
    varchar30   sunlight_needs
    varchar20   watering_needs
    text        interesting_fact
    varchar100  life_span_description     "e.g. 150-200 years"
    text        not_applicable_parts      "pipe-separated: fruit|bark|root"
    boolean     tentative             NN  "true = AI-suggested, unverified"
    boolean     active                NN
    text        img_main_url
    varchar255  img_main_attr
    text        img_flower_1_url
    varchar255  img_flower_1_attr
    text        img_flower_2_url
    varchar255  img_flower_2_attr
    text        img_fruit_1_url
    varchar255  img_fruit_1_attr
    text        img_fruit_2_url
    varchar255  img_fruit_2_attr
    text        img_leaf_1_url
    varchar255  img_leaf_1_attr
    text        img_leaf_2_url
    varchar255  img_leaf_2_attr
    text        img_bark_1_url
    varchar255  img_bark_1_attr
    text        img_bark_2_url
    varchar255  img_bark_2_attr
    text        img_root_1_url
    varchar255  img_root_1_attr
    text        img_root_2_url
    varchar255  img_root_2_attr
    text        notes
    timestamptz created_at            NN
    timestamptz updated_at            NN  "auto-stamped by DB trigger"
    timestamptz deleted_at                "NULL = active; non-null = soft deleted"
  }

  plant_instances {
    uuid        id                         PK
    uuid        species_id                 FK  "→ plant_species.id"
    integer     internal_identification_no     "Society's tree number"
    decimal107  lat                            "From photo EXIF or browser GPS"
    decimal107  lng
    varchar100  custom_location_desc           "e.g. Behind Block E"
    date        date_of_plantation
    boolean     active                     NN
    timestamptz created_at                 NN
    timestamptz updated_at                 NN  "auto-stamped by DB trigger"
    timestamptz deleted_at
  }

  staff_data {
    uuid        id               PK
    varchar10   staff_id         UK  "e.g. S001"
    varchar100  name             NN
    varchar50   role             NN  "Head Gardener / Assistant Gardener / Maintenance Staff"
    date        date_of_joining      "FE computes tenure: X yrs Y months"
    varchar150  speciality
    text        photo_url
    text        tribute_note
    boolean     active           NN
    timestamptz created_at       NN
    timestamptz updated_at       NN  "auto-stamped by DB trigger"
    timestamptz deleted_at
  }

  plant_species ||--o{ plant_instances : "has locations"
```

---

## Relationship Explained

| Relationship | Type | Meaning |
|---|---|---|
| `plant_species` → `plant_instances` | One-to-Many | One species (e.g. Neem) can exist at many physical locations in the society. Deleting a species is blocked if instances exist (`ON DELETE RESTRICT`). |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Species and instances split into two tables | Avoids duplicating botanical data and images for every physical plant. A society with 10 Neem trees stores images once, not 10 times. |
| Soft delete via `deleted_at` | Deleted plants are hidden from the public app but recoverable from the admin. No data is permanently lost in v1. |
| `updated_at` via DB trigger | Guarantees the timestamp is always accurate regardless of which tool (admin app, Supabase dashboard, SQL editor) modifies the row. |
| `tentative` boolean | All AI-identified data is marked tentative. Admin removes the flag after manual verification. |
| RLS at DB layer | Public (anon) Supabase key can only read `active=true AND deleted_at IS NULL` rows. Write access requires service_role key, which lives only in server-side env vars. |
