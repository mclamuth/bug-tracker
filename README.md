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
web/                          React app
infra/                        Bicep templates for test and prod
docs/                         setup guides
```

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

1. **Foundation** (this): solution, database with the team and applications, development and Entra sign-in, app shell with the app launcher, CI, Azure templates. ✅
2. **Data and core API:** tickets, comments, attachments, transitions, history.
3. **Core screens:** ticket list, new ticket form, ticket detail.
4. **Workflow and collaboration:** status dialogs, assignment, @mentions, attachments, Applications admin.
5. **Email:** outbox, Microsoft Graph sending, templates.
6. **Dashboard and go-live:** role-based My Work, polish, testing with the ICAs, production.
