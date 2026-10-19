using 'main.bicep'

param environmentName = 'test'

// Fill in once IT has created the group and app registrations (docs/entra-setup-request.md).
param sqlAdminGroupName = 'BugTracker SQL Admins'
param sqlAdminGroupObjectId = '00000000-0000-0000-0000-000000000000'
param apiClientId = ''
param spaClientId = ''
param apiScope = ''
