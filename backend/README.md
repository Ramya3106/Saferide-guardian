# Backend Structure

This folder is a separated backend scaffold for the TTR/RPF/Police dashboard workflow.

## Layout
- `src/config` - Database and service configuration
- `src/modules/auth` - Authentication flows
- `src/modules/users` - User profiles and claims
- `src/modules/officers` - Officer-specific logic
- `src/modules/complaints` - Complaint lifecycle and routing
- `src/modules/attendance` - Duty attendance and roster
- `src/modules/assignments` - Officer assignments and dispatch
- `src/modules/notifications` - Notification delivery
- `src/modules/locations` - Live location tracking
- `src/modules/messages` - Complaint messaging
- `src/middleware` - Request guards and validation
- `src/socket` - Socket.io wiring
- `src/utils` - Shared helpers
- `src/seed` - Demo seed data
- `src/app.ts` - Express app composition
- `src/server.ts` - Server bootstrap

## Current Project Mapping
The existing Express app can be migrated into this structure module by module. Officer dashboard endpoints should live under `src/modules/officers` and `src/modules/complaints`.
