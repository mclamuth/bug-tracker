# Going live

How the ISSD Bug Tracker gets from a developer's machine to Azure, in order. Steps 1–3 are one-time setup. After that, every merge to `main` deploys to Test automatically, and Production is deployed by running one workflow and approving it.

## 1. IT's setup

Send IT [entra-setup-request.md](entra-setup-request.md). When they're done you'll have:

| From IT | Goes into |
| --- | --- |
| Tenant ID | GitHub variable `AZURE_TENANT_ID` |
| API app client ID | `apiClientId` in both `infra/*.bicepparam`, and `apiScope` = `api://<API client ID>/access_as_user` |
| Web app (SPA) client ID | `spaClientId` in both `infra/*.bicepparam` |
| Object ID of *BugTracker SQL Admins* | `sqlAdminGroupObjectId` in both `infra/*.bicepparam` |
| Client ID of *BugTracker GitHub Deploy* | GitHub variable `AZURE_CLIENT_ID` |
| Subscription ID | GitHub variable `AZURE_SUBSCRIPTION_ID` |

Commit the two parameter files on a branch and merge them by pull request as usual. None of these values are secrets.

## 2. GitHub environments

In the repository: **Settings → Environments**.

1. Create **test**. Add these variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_RESOURCE_GROUP` = `rg-bugtracker-test`.
2. Create **production** with the same variables, but `AZURE_RESOURCE_GROUP` = `rg-bugtracker-prod`. Under **Deployment protection rules**, tick **Required reviewers** and add yourself, so nothing reaches Production without your approval.
3. In **Settings → Secrets and variables → Actions → Variables**, add the repository variable `DEPLOY_ENABLED` = `true`. Until it's set, the Deploy workflow does nothing, so merges keep working before Azure is ready.

## 3. First deployment to Test

Go to **Actions → Deploy → Run workflow**, keep **test**, and run it. It:

1. builds the React app and the API into one package, plus a database-migration bundle;
2. creates or updates the Azure resources from `infra/main.bicep`;
3. opens the SQL firewall to the runner for a moment, applies the migrations, gives the app's identity read/write access (`infra/grant-app-access.sql`), and closes the firewall again;
4. deploys the app and waits until `/health` reports healthy.

Then send IT two things from the run's **Create or update the Azure resources** step:

- the **webAppUrl**, to add as a redirect URI on the web app registration (section 1b of the request);
- the **appIdentityClientId** and **appIdentityPrincipalId**, for the mailbox permission (section 4).

Until the mailbox permission is in place, emails are retried for a few hours and then marked *Failed*; nothing else is affected.

## 4. Check Test

- Open the web app URL, sign in with your CTA account, and check My Work loads.
- Report a test ticket. Ken should get the "needs triage" email from bugtracker@cta.org. While only developers are trying Test, you can set `emailRedirectTo` in `infra/test.bicepparam` to your own address, so every email comes to you instead.
- Open **Applications** and check the launcher links.

## 5. ICA testing

Clear `emailRedirectTo` (if you set it), so everyone gets their own emails, and ask the ICAs to work through [uat-test-plan.md](uat-test-plan.md) in Test. Fix what they find, merging each fix to `main`; Test updates itself.

Test's database is separate from Production's, so test tickets never reach Production.

## 6. Production

1. **Actions → Deploy → Run workflow**, choose **production**, and run it. It deploys to Test first, then waits for your approval.
2. Approve the **production** step when GitHub asks.
3. As in step 3, send IT the production **webAppUrl** and the identity IDs, if you haven't already.
4. Sign in, report a real first ticket, and check the email arrives.
5. Tell the team the address, and ask them to bookmark it.

## After go-live

| Need | Where |
| --- | --- |
| Errors and slow requests | Application Insights `appi-bugtracker-prod` in the Azure portal: **Failures** and **Performance** |
| Emails that didn't send | `SELECT TOP 50 * FROM EmailOutbox WHERE Status = 3 ORDER BY Id DESC` (3 = Failed). `LastError` says why. |
| Restore the database to an earlier time | Azure SQL keeps 7 days of point-in-time backups: **SQL database → Restore** |
| Roll back the app | Re-run an earlier successful **Deploy** run. Database migrations only go forward, so roll back by fixing forward if a migration was involved. |
| A friendlier address (bugtracker.cta.org) | Optional: a custom domain on the App Service plus a DNS record from IT, then update `App__BaseUrl` and the redirect URIs. |
