# Running the Bug Tracker on your computer

This gets the app running locally with **development sign-in**: you pick which team member to be, so you can test as a developer, an ICA or the supervisor without an Entra app registration. Plan on about 30 minutes the first time.

## 1. Install the tools (Windows)

Open **PowerShell** and run:

```powershell
winget install Microsoft.DotNet.SDK.10
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Close and reopen PowerShell afterwards so the new commands are on your PATH. Check them:

```powershell
dotnet --version   # 10.0.x
node --version     # v22 or later
```

## 2. Install SQL Server Express LocalDB

LocalDB is a free, lightweight SQL Server for developers. It starts on demand, so there's no service to manage.

1. Go to <https://www.microsoft.com/sql-server/sql-server-downloads> and click **Download now** under **Express**. You get `SQL2025-SSEI-Expr.exe`.
2. Run it and choose **Download Media**, then pick the **LocalDB** package and download it. (If you don't see that option, choose **Custom** instead and tick **LocalDB** on the Feature Selection page.)
3. Run the downloaded `SqlLocalDB.msi` and accept the defaults.
4. Check it works:

   ```powershell
   sqllocaldb info               # should list MSSQLLocalDB
   sqllocaldb start MSSQLLocalDB
   ```

The app's development settings already point at `(localdb)\MSSQLLocalDB`. The **BugTracker** database is created automatically, with the team and the 22 applications loaded, the first time the API starts.

To browse the data in VS Code, install the **SQL Server (mssql)** extension and connect to `(localdb)\MSSQLLocalDB` with Windows authentication.

## 3. Get the code

```powershell
git clone https://github.com/mclamuth/bug-tracker.git
cd bug-tracker
dotnet tool restore
cd web
npm ci
cd ..
code .
```

When VS Code asks to install the recommended extensions, say yes.

## 4. Run it

In VS Code: **Terminal → Run Task… → Run Bug Tracker**. This starts both halves:

| Part | Address |
| --- | --- |
| React app (open this one) | <http://localhost:5173> |
| API | <http://localhost:5011> (API docs at `/openapi/v1.json`) |

Open <http://localhost:5173>, pick a person, and you're in. Use **Switch user** in the top-right menu to test as someone else.

Prefer two terminals? Run `dotnet run --project src/BugTracker.Api --launch-profile http` in one and `npm run dev` inside `web` in the other.

To debug the API with breakpoints, stop the API task and press **F5** (**Debug API**).

## Emails on your computer

On a developer's machine nothing is sent. Each notification email is written as a web page in the **`.local/emails`** folder at the top of the repository (Git ignores it), named with the time, the recipient and the subject. Open one in VS Code with **Open with Live Preview**, or double-click it in File Explorer, to see exactly what the person would get.

Emails go out a few seconds after the action that caused them, and nobody gets an email about something they did themselves. So to see Ken's "needs triage" email, create a ticket as anyone else.

Emails that were queued before Milestone 5 used placeholder text, so they're marked as not sent and won't appear in the folder.

## 5. Run the tests

```powershell
dotnet test
cd web
npm test
```

Or **Terminal → Run Task… → test: all**.

## Using a different SQL Server (optional)

LocalDB only runs on Windows. To use another SQL Server (a full SQL Server Express or Developer install, or a Docker container on a Mac), store its connection string as a user secret so it never ends up in Git:

```powershell
dotnet user-secrets set "ConnectionStrings:BugTracker" "Server=localhost,1433;Database=BugTracker;User Id=sa;Password=<your password>;TrustServerCertificate=True" --project src/BugTracker.Api
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| API stops with "A network-related or instance-specific error" | LocalDB isn't running: `sqllocaldb start MSSQLLocalDB`. |
| Sign-in page says it can't load the team | The API isn't running, or it's on a different port. Start the **api: run** task. |
| "Port 5011 / 5173 is already in use" | Another copy is still running. Close the old terminal or stop the task. |
| You want a clean database | Stop the API, then run `sqllocaldb stop MSSQLLocalDB` and delete the database with the mssql extension, or run `dotnet ef database drop --project src/BugTracker.Infrastructure --startup-project src/BugTracker.Api`. It's recreated on the next start. |
| The CTA logo doesn't show | Check that `web/public/assets/cta-logo-blue.png` exists (it's in the repository) and refresh the page. |

## How development sign-in stays safe

Development sign-in only switches on when `Auth:Mode` is `Development` **and** the app runs in the Development environment. If someone sets that mode on Test or Production by mistake, the app refuses to start. Once IT has registered the app, Test and Production use Microsoft sign-in (see [entra-setup-request.md](entra-setup-request.md)).
