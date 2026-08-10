# V3 Source-of-Truth Policy v1.0

## 1. Purpose

This package intentionally separates:

1. **Normative design** — what V3 means.
2. **Research execution** — how candidate items are tested.
3. **Generated runtime code** — what the miniapp executes.
4. **Reference/history** — useful context, never an implementation authority.

An implementation agent MUST NOT reconcile conflicting historical documents by guessing.

---

## 2. Authority order

If two files conflict, use this priority order:

```text
AGENT_IMPLEMENTATION_MASTER.md
↓
normative/NORMATIVE_MANIFEST.yaml
↓
normative/questionnaire_candidate_freeze.yaml
normative/construct_registry.yaml
normative/response_formats.yaml
normative/dimension_combine_conclusion.yaml
normative/user_report_authoring_library.yaml
normative/report_runtime_schema.yaml
normative/data_dictionary.yaml
normative/pilot_pruning_calibration.yaml
↓
research/P1_form_manifest.yaml
research/P0_questionnaire_spec.yaml
↓
examples/*
↓
reference/*
starter_dropin/*
```

`reference/*` and `starter_dropin/*` are never allowed to override a normative file.

---

## 2.1 Product v0 overlay authority

After the normative semantic files, the Product v0 overlay is the authority for the first public, theory-driven implementation:

```text
product-v0/PRODUCT_V0_MANIFEST.yaml
product-v0/product_questionnaire_v0.yaml
product-v0/provisional_scoring_v0.yaml
product-v0/decision_map_v0.yaml
```

Normative files define what each construct and combine grammar means. Product v0 files define which REPORT_CORE subset is used now and how the provisional implementation operationalizes it. Product v0 must not redefine a construct for implementation convenience. P0/P1 research forms remain research-only and cannot override the Product v0 questionnaire.

## 3. Three different questionnaire objects

These MUST remain separate.

### MASTER CANDIDATE BANK

```text
411 parent candidate tasks
```

Source:

```text
normative/questionnaire_candidate_freeze.yaml
```

Purpose:

- exhaustive candidate inventory;
- construct development;
- validation/reserve tasks;
- future pruning.

It is NOT the default questionnaire shown to one participant.

### REPORT_CORE CANDIDATE

```text
266 parent tasks
~307 independent response fields/child responses
```

Source:

```text
normative/report_core_candidate.yaml
```

Purpose:

- candidate full-coverage questionnaire;
- guarantees input coverage for all C1–C6 dimensions and the L3/L4/L5 decision map;
- basis for later evidence-based short-form construction.

It is NOT an approved production short form.

### P1 RESEARCH FORMS

Source:

```text
research/P1_form_manifest.yaml
```

Purpose:

- planned-missing research design;
- common spine + randomized A/B/C research form + valid branches;
- item/construct development.

It is NOT the full-report production questionnaire.

---

## 4. User-facing product architecture is frozen

```text
Chapter
→ Dimension
→ Multiple answers
→ Construct-specific combine
→ Dimension conclusion
→ Chapter synthesis
→ Cross-chapter profile
```

C1–C6 contain 14 core user-facing dimensions.

The internal measurement model may change after Pilot, but an agent must not replace this architecture with:

- one global personality score;
- one relationship type;
- one compatibility percentage;
- a simple universal average across all items.

---

## 5. Scoring boundary

The normative package deliberately does NOT contain an empirically calibrated mapping:

```text
raw answers → final dimension state
```

Therefore:

- runtime collection CAN be implemented now;
- item-to-construct metadata CAN be implemented now;
- symbolic/synthetic report rendering CAN be implemented now;
- production/calibrated scoring thresholds and weights MUST NOT be presented as validated;
- research P0/P1 runtime remains no-production-scoring.

### Product v0 scoring overlay

The separate `research/v3/product-v0/` overlay is explicitly allowed to provide a complete local product:

```text
raw answers
-> versioned theory-driven provisional rules
-> Product v0 DerivedV3Profile
-> V3 report
```

Product v0 scoring is deterministic and auditable, but it is not empirically calibrated. It is derived from the frozen V3 construct and combine architecture and cannot redefine scientific meaning. Future research may change item selection, weights, thresholds, state rules, and confidence rules without rewriting historical raw answer events. Public copy must disclose this provisional status.

```text
THEORY_DRIVEN_PROVISIONAL != EMPIRICALLY_CALIBRATED
```

---

## 6. Versioning

Every persisted V3 assessment must be able to recover:

```text
instrumentVersion
constructRegistryVersion
itemRegistry/freezeVersion
responseFormatVersion
formManifestVersion
runtimeVersion
scoringModelVersion
authoringLibraryVersion
reportVersion
appVersion
```

`scoringModelVersion` may be `NOT_CALIBRATED` during P0/P1 technical research.

Raw answers are immutable evidence. A new scoring model creates a new derived result; it does not rewrite historical answers.
