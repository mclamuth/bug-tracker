# Request to IT: Entra ID, Azure and mailbox setup for the ISSD Bug Tracker

**From:** Michael Lamuth, ISSD
**What it is:** an internal web app where ISSD's developers, ICAs and the ISSD Supervisor log and track defects and enhancement requests for the applications ISSD supports. 11 users. Hosted in Azure (App Service + Azure SQL).
**What we need:** the items below. Everything else (code, Azure resource templates, deployment pipeline) is ready in <https://github.com/mclamuth/bug-tracker>.

## 1. App registrations in Entra ID

Please create two app registrations in the CTA tenant.

### a. API: "ISSD Bug Tracker API"

- Supported account types: **this organizational directory only**.
- **Expose an API**:
  - Application ID URI: `api://<this app's client id>`
  - Add a scope named `access_as_user`, consentable by **admins and users**, with the description "Access the ISSD Bug Tracker as the signed-in user".
- No client secret or certificate is needed. The API only validates tokens.

### b. Web app: "ISSD Bug Tracker"

- Supported account types: **this organizational directory only**.
- Platform: **Single-page application (SPA)** with these redirect URIs:
  - `http://localhost:5173` (developers' machines)
  - `https://<test web app>.azurewebsites.net` (we'll send the exact URL after the first deployment)
  - `https://<production web app>.azurewebsites.net`
- **API permissions**: add *ISSD Bug Tracker API → access_as_user* (delegated) and **grant admin consent**. Keep the default Microsoft Graph *User.Read*.
- In **Enterprise applications → ISSD Bug Tracker → Properties**, set **Assignment required** to **Yes**.

## 2. Security groups

| Group | Members | Used for |
| --- | --- | --- |
| **BugTracker Users** | Max Caber, Bobby McDonald, Hue Chi, Shyamal Gurazada, Michael Lamuth, Elyse Orris, Josh Ralls, Val Guzman, Jeff Hugo, Greg Gee, Ken Fukumoto | Assign to the *ISSD Bug Tracker* enterprise app. Only members can sign in. |
| **BugTracker SQL Admins** | Michael Lamuth, whoever in IT manages Azure SQL, and the **BugTracker GitHub Deploy** identity (section 3) | Entra administrator of the Azure SQL server. The server uses Entra authentication only, so there are no SQL passwords. The deploy identity applies database changes and gives the app's own identity read/write access (`infra/grant-app-access.sql`). |

## 3. Azure subscription access

- Two resource groups in the CTA subscription and region of your choice: `rg-bugtracker-test` and `rg-bugtracker-prod`.
- For deployments from GitHub Actions: an app registration (or user-assigned identity) named **"BugTracker GitHub Deploy"** with:
  - **Contributor** and **Role Based Access Control Administrator** (limited to assigning the Storage Blob Data, Key Vault Secrets User roles) on both resource groups. The templates give the app's own managed identity access to its storage and key vault.
  - Federated credentials for GitHub repository `mclamuth/bug-tracker`, entity type **Environment**, for environments `test` and `production`. This means no secrets are stored in GitHub.
- Read access for Michael Lamuth on both resource groups.

## 4. Notification mailbox

- A shared mailbox: **bugtracker@cta.org** (display name "ISSD Bug Tracker"). Shared mailboxes need no license.
- After the first deployment we'll send the **client ID and object ID of the app's managed identity** (`id-bugtracker-test` / `id-bugtracker-prod`). Please let that identity send mail as bugtracker@cta.org **and no other mailbox**, using Exchange Online RBAC for Applications:
  - a management scope that matches only bugtracker@cta.org,
  - the *Application Mail.Send* role assigned to the identity's service principal with that scope.

  Please **don't** grant Mail.Send to the identity in Entra; that would let it send as anyone in the tenant.

  The Exchange Online PowerShell for this, once per environment (test, then production):

  ```powershell
  Connect-ExchangeOnline

  # The managed identity, as Exchange sees it (client ID = AppId, plus its object ID).
  New-ServicePrincipal -AppId <client id> -ObjectId <object id> -DisplayName "ISSD Bug Tracker (test)"

  # Only this mailbox (created once, shared by test and production).
  New-ManagementScope -Name "BugTracker mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'bugtracker@cta.org'"

  New-ManagementRoleAssignment -App <client id> -Role "Application Mail.Send" -CustomResourceScope "BugTracker mailbox"

  # Check: InScope should be True for bugtracker@cta.org, and False for anyone else's mailbox.
  Test-ServicePrincipalAuthorization -Identity <client id> -Resource bugtracker@cta.org
  Test-ServicePrincipalAuthorization -Identity <client id> -Resource mlamuth@cta.org
  ```

  The app sends with Microsoft Graph (`POST /users/bugtracker@cta.org/sendMail`) and keeps a copy of every email in the mailbox's Sent Items.

## What we need back

| Item | Example |
| --- | --- |
| Tenant ID | `xxxxxxxx-xxxx-…` |
| API app client ID | `xxxxxxxx-xxxx-…` |
| Web app (SPA) client ID | `xxxxxxxx-xxxx-…` |
| Object ID of *BugTracker SQL Admins* | `xxxxxxxx-xxxx-…` |
| Client ID of *BugTracker GitHub Deploy* and the subscription ID | `xxxxxxxx-xxxx-…` |

Questions: Michael Lamuth (mlamuth@cta.org).
