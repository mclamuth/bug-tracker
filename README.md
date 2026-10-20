# ISSD Bug Tracker

Tracks defects and enhancement requests for the applications CTA's Information Systems & Services Division supports. Used by ISSD's developers, ICAs and the ISSD Supervisor.

- **Design doc:** data model, workflow, API and screens (shared separately)
- **Run it locally:** [docs/local-setup.md](docs/local-setup.md)
- **What IT needs to set up:** [docs/entra-setup-request.md](docs/entra-setup-request.md)

## Stack

| Part | Technology |
| --- | --- |
| API | ASP.NET Core 10 (minimal APIs), Entity Framework Core 10 |
| Database | SQL Server (LocalDB on developer machines, Azure SQL in Azure) |
| Web app | React 19, TypeScript, Vite, Fluent UI React v9, TanStack Query, React Router |
| Sign-in | Microsoft Entra ID (MSAL), or development sign-in on a developer's machine |
| Hosting | Azure App Service, Azure SQL, Blob Storage, Key Vault, Application Insights ([infra/](infra)) |
| CI | GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) |

## Repository layout

```
src/
  BugTracker.Api/             endpoints, sign-in, startup; serves the React build in Azure
  BugTracker.Application/     services, DTOs, interfaces
  BugTracker.Domain/          entities, enums, status ids
  BugTracker.Infrastructure/  EF Core DbContext, migrations, seed data
tests/
  BugTracker.UnitTests/         workflow and seed rules, user provisioning
  BugTracker.IntegrationTests/  the real API over HTTP with an in-memory database
web/                          React app (screens in web/src/tickets, shared pieces in web/src/components)
infra/                        Bicep templates for test and prod
docs/                         setup guides
```

## API

All endpoints are under `/api/v1` and need sign-in. In development, send the header `X-Dev-User-Id: <user id>`. Errors use RFC 9457 Problem Details: 400 means a validation problem, 403 not allowed, 404 not found, and 409 means the workflow doesn't allow it or someone else changed the ticket first.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/me`, `/users`, `/applications`, `/lookups` | Signed-in user, team, applications, statuses and workflow |
| POST, PUT | `/applications`, `/applications/{id}` | Add or edit an application (name, description, default developer, launcher link, active) |
| GET | `/tickets` | List: `view` (open, unassigned, assigned-to-me, reported-by-me, closed, all), filters, `search`, `sort`, `direction`, `page`, `pageSize` |
| GET | `/tickets/counts` | How many tickets each quick view holds |
| POST | `/tickets` | Create (New, or Assigned if a developer is chosen) |
| GET, PATCH | `/tickets/{number}` | Read; edit fields (send `rowVersion`) |
| POST | `/tickets/{number}/transitions` | Change status with the comment, resolution or developer the move needs |
| PUT | `/tickets/{number}/assignee` | Assign or reassign |
| GET | `/tickets/{number}/history` | Field-by-field changes, newest first |
| GET, POST | `/tickets/{number}/comments` | Comments, newest first; `@Full Name` mentions email that person |
| PUT, DELETE | `/comments/{id}` | Author only |
| POST | `/tickets/{number}/attachments` | Upload (multipart `file`, up to 25 MB) |
| GET, DELETE | `/attachments/{id}` | Download; remove (uploader only) |

To try it from VS Code, open [src/BugTracker.Api/BugTracker.Api.http](src/BugTracker.Api/BugTracker.Api.http) with the REST Client extension: it walks a ticket from report to closed. The full description is at `/openapi/v1.json` while the API runs in development.

Emails are rendered from the template in `src/BugTracker.Application/Notifications/EmailTemplate.cs` and queued in the `EmailOutbox` table with the change that caused them. A background sender delivers them, with `Email:Mode` deciding how:

| Mode | Where | What happens |
| --- | --- | --- |
| `Pickup` | Developer machines | Each email is written to `.local/emails` as a page you can open in a browser |
| `Graph` | Test and Production | Sent through Microsoft 365 from bugtracker@cta.org, using the app's managed identity |
| `None` | Automated tests | Queued only |

A failed send is retried after 1, 5, 15, 60 and 240 minutes, then marked `Failed` with the reason in `LastError`. Emails still queued after 48 hours are dropped rather than sent late. Setting `Email:RedirectAllTo` sends every email to one address instead (for the Test environment).

## Everyday commands

```bash
dotnet build                      # build the API
dotnet test                       # .NET tests
dotnet format                     # fix C# formatting
cd web && npm run dev             # React app on http://localhost:5173 (needs the API running)
cd web && npm test                # React tests
cd web && npm run lint && npm run format:check
```

### Database changes

The schema is code-first. After changing an entity or `BugTrackerDbContext`:

```bash
dotnet ef migrations add <DescriptiveName> --project src/BugTracker.Infrastructure --startup-project src/BugTracker.Api --output-dir Data/Migrations
```

On a developer machine, the API applies new migrations when it starts. In Azure, the deployment pipeline applies them; the app never does.

## Conventions

- **C#:** nullable reference types on, warnings are errors, analyzers at *latest-recommended*, formatting from `.editorconfig` (CI runs `dotnet format --verify-no-changes`). Package versions live in `Directory.Packages.props`.
- **React:** TypeScript strict mode, oxlint, Prettier, Vitest + Testing Library. Server data goes through TanStack Query hooks in `web/src/api/queries.ts`.
- **SQL:** plural PascalCase table names, `Id` primary keys, `<Entity>Id` foreign keys, UTC `datetime2`. Schema changes only through reviewed migrations.
- **Git:** work on `feature/...` branches; merge to `main` by pull request with one review and green CI.

## Milestones

1. **Foundation:** solution, database with the team and applications, development and Entra sign-in, app shell with the app launcher, CI, Azure templates. ✅
2. **Data and core API:** tickets, comments with @mentions, attachments, status changes and assignment, history, queued emails. ✅
3. **Core screens:** ticket list, new ticket form, ticket detail. ✅
4. **Workflow and collaboration:** status dialogs, assignment, @mentions, attachments, Applications admin. ✅
5. **Email:** outbox, Microsoft Graph sending, templates. ✅
6. **Dashboard and go-live:** role-based My Work, polish, testing with the ICAs, production.
