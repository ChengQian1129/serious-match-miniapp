# Public Language Gate — Test Spec v1.0

## Purpose

Prevent any unreviewed or internal/research/developer language from reaching normal users.

## Required script

Create:

```text
scripts/check-public-language.js
```

and include it in the normal regression suite.

## Surfaces that must be scanned

```text
app.json
pages/**/*.json
pages/**/*.wxml
registered pages/**/*.js user-facing string literals
shared/content/**/*.js
shared/assessment/schema.js
reviewed V2 public copy registry
V3 questionnaire generated public prompt/options
V3 public narrative registry
```

Also inspect JS callsites capable of displaying arbitrary strings:

```text
wx.showToast
wx.showModal
setData({ error })
setData({ message })
setData({ notice })
```

Report and chapter engines are source-locked: they may only return registry copy
and must contain no inline Chinese string literals. Page-script literals are
included in the reviewed snapshot so a new or changed string cannot bypass review.

Raw runtime/server errors must never be displayed.

## Hard block

Read patterns from:

```text
PUBLIC_FORBIDDEN_LANGUAGE.yaml
```

Any hard-block token in a normal public surface => test FAIL.

## New public string snapshot

The checker should emit a deterministic normalized snapshot:

```text
tests/fixtures/public-language.snapshot.json
```

Each entry should contain:

```json
{
  "surface": "pages/...",
  "key": "...",
  "text": "..."
}
```

If a PR introduces a new public string not present in the reviewed snapshot, regression must fail until that string is explicitly reviewed.

## Allowed internal locations

Do NOT lint scientific/internal identifiers simply because they exist in:

```text
research/
tests/
telemetry
database field names
developer logs
```

Lint what can actually be rendered to a participant.

## Error policy

A raw error object must be converted to one of a small set of reviewed public messages.

Never:

```js
wx.showToast({ title: error.message })
```

Use:

```js
logTechnicalError(error)
showPublicError('saveFailed')
```

## Acceptance

- hard-block scan: 0 findings
- unreviewed public strings: 0
- raw error display sites: 0
- all existing V2/V3 regression tests pass
