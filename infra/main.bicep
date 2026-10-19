// Azure resources for one Bug Tracker environment (test or prod).
// Deploy into an existing resource group, e.g. rg-bugtracker-test:
//   az deployment group create -g rg-bugtracker-test -f infra/main.bicep -p infra/test.bicepparam
// Not deployed yet: waiting on the Entra app registration (see docs/entra-setup-request.md).

targetScope = 'resourceGroup'

@description('Short environment name used in resource names.')
@allowed(['test', 'prod'])
param environmentName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Display name of the Entra group that administers the SQL server (e.g. "BugTracker SQL Admins").')
param sqlAdminGroupName string

@description('Object id of that Entra group.')
param sqlAdminGroupObjectId string

@description('Entra tenant id.')
param tenantId string = subscription().tenantId

@description('Client id of the API app registration (AzureAd:ClientId). Leave empty until IT has registered the app.')
param apiClientId string = ''

@description('Client id of the SPA app registration. Leave empty until IT has registered the app.')
param spaClientId string = ''

@description('Scope the SPA requests, e.g. api://<api-client-id>/access_as_user.')
param apiScope string = ''

@description('Mailbox notifications are sent from.')
param notificationMailbox string = 'bugtracker@cta.org'

var isProd = environmentName == 'prod'
var suffix = '${environmentName}-${uniqueString(resourceGroup().id)}'
var tags = {
  application: 'bug-tracker'
  environment: environmentName
}

// ---------- Monitoring ----------

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-bugtracker-${suffix}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-bugtracker-${suffix}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// ---------- Identity used by the app for SQL, Blob Storage, Key Vault and Graph ----------

resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-bugtracker-${environmentName}'
  location: location
  tags: tags
}

// ---------- Key Vault ----------

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('kv-bt-${replace(suffix, '-', '')}', 24)
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: isProd ? true : null
    publicNetworkAccess: 'Enabled'
  }
}

var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'

resource vaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, appIdentity.id, keyVaultSecretsUser)
  scope: vault
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
  }
}

// ---------- Attachments ----------

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('stbt${replace(suffix, '-', '')}', 24)
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false // Managed identity only.
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 14 }
    containerDeleteRetentionPolicy: { enabled: true, days: 14 }
  }
}

resource attachments 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'attachments'
  properties: { publicAccess: 'None' }
}

var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
// Needed to issue short-lived user-delegation download links.
var storageBlobDelegator = 'db58b8e5-c6ad-4a2a-8342-4190687cbf4a'

resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, appIdentity.id, storageBlobDataContributor)
  scope: storage
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
  }
}

resource blobDelegation 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, appIdentity.id, storageBlobDelegator)
  scope: storage
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDelegator)
  }
}

// ---------- Database (Entra authentication only, no SQL passwords) ----------

resource sqlServer 'Microsoft.Sql/servers@2021-11-01' = {
  name: 'sql-bugtracker-${suffix}'
  location: location
  tags: tags
  properties: {
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      login: sqlAdminGroupName
      sid: sqlAdminGroupObjectId
      principalType: 'Group'
      tenantId: tenantId
    }
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2021-11-01' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.Sql/servers/databases@2021-11-01' = {
  parent: sqlServer
  name: 'BugTracker'
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5_1' // General Purpose serverless, 1 vCore max.
    tier: 'GeneralPurpose'
  }
  properties: {
    autoPauseDelay: isProd ? -1 : 60 // Test pauses after an idle hour; Production stays warm.
    minCapacity: json('0.5')
    requestedBackupStorageRedundancy: 'Local'
  }
}

resource backupRetention 'Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies@2021-11-01' = {
  parent: database
  name: 'default'
  properties: {
    retentionDays: isProd ? 35 : 7
  }
}

// ---------- Web app (API + React build + email worker) ----------

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'asp-bugtracker-${suffix}'
  location: location
  tags: tags
  kind: 'linux'
  sku: isProd ? { name: 'P0v3', tier: 'PremiumV3' } : { name: 'B1', tier: 'Basic' }
  properties: { reserved: true }
}

resource web 'Microsoft.Web/sites@2024-04-01' = {
  name: 'app-bugtracker-${suffix}'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    keyVaultReferenceIdentity: appIdentity.id
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: isProd
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      appSettings: [
        { name: 'ASPNETCORE_ENVIRONMENT', value: isProd ? 'Production' : 'Test' }
        { name: 'AZURE_CLIENT_ID', value: appIdentity.properties.clientId }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'Auth__Mode', value: 'Entra' }
        { name: 'Auth__SpaClientId', value: spaClientId }
        { name: 'Auth__ApiScope', value: apiScope }
        { name: 'AzureAd__TenantId', value: tenantId }
        { name: 'AzureAd__ClientId', value: apiClientId }
        { name: 'AzureAd__Audience', value: empty(apiClientId) ? '' : 'api://${apiClientId}' }
        { name: 'Storage__BlobEndpoint', value: storage.properties.primaryEndpoints.blob }
        { name: 'Storage__Container', value: attachments.name }
        { name: 'Email__Mode', value: 'Graph' }
        { name: 'Email__FromMailbox', value: notificationMailbox }
        { name: 'KeyVault__Uri', value: vault.properties.vaultUri }
      ]
      connectionStrings: [
        {
          name: 'BugTracker'
          type: 'SQLAzure'
          connectionString: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${database.name};Authentication=Active Directory Managed Identity;User Id=${appIdentity.properties.clientId};Encrypt=True;TrustServerCertificate=False'
        }
      ]
    }
  }
}

output webAppName string = web.name
output webAppUrl string = 'https://${web.properties.defaultHostName}'
output sqlServerName string = sqlServer.name
output appIdentityName string = appIdentity.name
output appIdentityClientId string = appIdentity.properties.clientId
output appIdentityPrincipalId string = appIdentity.properties.principalId
