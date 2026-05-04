# Frontend Structure

This folder is a separated frontend scaffold for the TTR/RPF/Police dashboard flow.

## Layout
- `src/api` - API clients and request helpers
- `src/components` - Shared UI components
- `src/screens/auth` - Login and verification screens
- `src/screens/dashboards/ttr-rpf-police` - Officer dashboard screens for TTR, RPF, and Police
- `src/screens/complaints` - Complaint list/detail screens
- `src/screens/messages` - Passenger-officer communication screens
- `src/screens/attendance` - Duty check-in/check-out screens
- `src/navigation` - Navigation stacks and tabs
- `src/store` - Redux Toolkit store and slices
- `src/hooks` - Shared React hooks
- `src/utils` - Helpers and formatters
- `src/constants` - Reusable app constants
- `src/types` - Shared type definitions

## Current Project Mapping
The existing React Native app can be migrated into this structure incrementally. Officer dashboard features should move into `src/screens/dashboards/ttr-rpf-police`.
