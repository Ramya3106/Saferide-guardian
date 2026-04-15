# Prototype Notice

SafeRide Guardian is currently running in prototype mode with dummy/sample data for demonstration purposes only.

## What Is Mocked Right Now
- Officer profiles and duty rosters (TTR/TTE/RPF/Police)
- Staff support records
- Vehicle records
- Complaint alert routing data
- Handover records and activity timelines

## Important
- No real government or confidential railway data is used.
- All values in prototype datasets are non-official placeholder data.
- The current workflow is designed to behave like a production system while staying demo-safe.

## Future Integration Plan
- Keep mock datasets isolated behind dedicated prototype endpoints.
- Replace prototype data sources with verified official APIs/DB tables later.
- Preserve current route contracts and UI structure for smooth migration.

## Prototype Toggle
Server supports a prototype-mode toggle via environment variable:

```env
USE_PROTOTYPE_DATA=true
```

Set `USE_PROTOTYPE_DATA=false` when moving to real integration.
