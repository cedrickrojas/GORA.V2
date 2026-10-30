# Super admin dashboard

The dashboard lives at `/admin`, outside the social app tabs, and is also linked from **Profile → Settings → Super Admin Dashboard** for super admins. It uses real API data; it has no sample metrics or default administrator password.

Super admins go directly to `/admin` after login and session restoration. Social-app routes, including `/home`, redirect their accounts into the admin workspace. They can log out directly from the dashboard. Regular users retain the existing social-app navigation.

## First account setup

1. Configure `server/.env` as described in the main README, including PostgreSQL and a valid JWT secret. Install the server and mobile dependencies.
2. From `server`, run `npx prisma migrate deploy` and `npx prisma generate`. The migration `20261026100000_super_admin` adds `SUPER_ADMIN` and the audit table without modifying existing account roles.
3. Register your own account through the normal app registration screen.
4. From `server`, run `npm run admin:bootstrap -- your-account@example.com` using that account's email.
5. Sign in again and open `/admin` (for local Vite development, `http://localhost:5173/admin`). Run the app and API with `npm run mobile` and `npm run server` from the repository root.

The bootstrap command grants access only to an existing active account and refuses to run while an active super admin exists. Additional super admins are granted from the Users screen. No account is promoted automatically during registration, migrations, or seeding. A server operator with database access can rerun the bootstrap command for recovery when no active super admin remains.

## Features

- **Overview:** total and active accounts, games, clubs, posts, reels, pending reports, reports in review, and daily registrations for the last seven UTC days. Totals include historical/inactive content, rather than claiming to measure current engagement.
- **Users:** search names, usernames, and emails; filter roles and account status; paginate; assign User, Admin, or Super Admin; suspend and reactivate accounts. `ADMIN` is reserved for future delegated admin tools; only `SUPER_ADMIN` can use this dashboard. Club membership roles remain independent.
- **Reports:** filter by status, inspect the reporter, reported account, report description, target identifier, and available text evidence. Move reports between Pending, Reviewing, Resolved, and Dismissed. The resolver and resolution time are stored for closed reports and cleared when reopened. Stale status changes return 409. Resolving records a decision; it does not automatically delete content or suspend accounts. Media attachments are not previewed, and only the reported message text is retrieved from private chat.
- **Sports:** view player/game counts and activate or retire existing seeded sports. Retirement prevents new selections and preserves history.
- **Audit log:** paginated, most recent first; actor, target, timestamp, action, and before/after changes. There is no dashboard API to alter or delete audit records.

Every admin endpoint requires JWT authentication followed by the super admin guard. JWT verification reloads the account and role from PostgreSQL on every request, rejecting suspended accounts and revoked access immediately. User changes are serialized using a transaction-scoped PostgreSQL advisory lock. Mutations recheck the actor inside that lock, preserve at least one active super admin, prohibit self-demotion/self-suspension, and write their audit record in the same transaction. The first-account command uses the same lock.

## API

All paths below are relative to `/api/v1/admin` and require an active super admin's Bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/overview` | Counts and seven-day registrations |
| GET | `/users?page=1&search=&role=&status=` | Accounts; status is `active` or `suspended` |
| PATCH | `/users/:id` | `{ "role": "ADMIN", "isActive": true }`; either field may be supplied |
| GET | `/reports?page=1&status=PENDING` | Reports and available text evidence |
| PATCH | `/reports/:id` | `{ "status": "RESOLVED", "expectedStatus": "REVIEWING" }` |
| GET | `/sports` | Sports and usage counts |
| PATCH | `/sports/:id` | `{ "isActive": false }` |
| GET | `/audit?page=1` | Administrator activity |

Lists use 20 rows per page. Invalid values, null mutation fields, unknown body properties, and invalid UUIDs are rejected. Password hashes and auth tokens are never selected by admin queries.

## Verification

From `server`, run `npm test -- --runInBand admin` and `npm run build`. From `mobile`, run `npm run test:unit -- tests/unit/admin.spec.ts` and `npm run build`. Permission tests cover anonymous requests, regular users, admins, suspended super admins, role revocation with an existing JWT, input validation, self-protection, last-super-admin protection, and stale report decisions.

Against a migrated **test database**, run `npm run test:e2e -- --runInBand admin.e2e-spec.ts` from `server`. This verifies real overview queries, user search, persisted role/status and audit changes, concurrent permission revocation, report resolution, and sport retirement. The suite creates uniquely named fixtures and removes only those fixtures and their audit records afterward. Do not point test commands at production.
