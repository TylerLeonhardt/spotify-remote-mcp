targetScope = 'resourceGroup'

@description('Name of the environment (used to generate a short unique hash used in all resources)')
param environmentName string

@description('Primary location for all resources')
param location string = 'canadacentral'

// Generate a unique resource token
var resourceToken = uniqueString(subscription().id, resourceGroup().id, location, environmentName)
var resourcePrefix = 'sm'  // spotify-mcp

// Existing resource references (these should already exist)
var existingAppServiceName = 'spotify-mcp-unofficial'
var existingAppServicePlanName = 'ASP-spotifymcpunofficialgroup-a70a'

// Reference the existing App Service Plan
resource existingAppServicePlan 'Microsoft.Web/serverfarms@2023-12-01' existing = {
  name: existingAppServicePlanName
}

// Create Log Analytics Workspace for monitoring
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'az-${resourcePrefix}-logs-${resourceToken}'
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Create Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'az-${resourcePrefix}-ai-${resourceToken}'
  location: location
  kind: 'web'
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
}

// Create User-Assigned Managed Identity
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'az-${resourcePrefix}-id-${resourceToken}'
  location: location
  tags: {
    'azd-env-name': environmentName
  }
}

// Create or update the App Service
resource appService 'Microsoft.Web/sites@2024-04-01' = {
  name: existingAppServiceName
  location: location
  tags: {
    'azd-env-name': environmentName
    'azd-service-name': 'spotify-mcp-server'
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: existingAppServicePlan.id
    httpsOnly: true
    siteConfig: {
      nodeVersion: '~20'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsights.properties.InstrumentationKey
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
      cors: {
        allowedOrigins: ['*']
        supportCredentials: false
      }
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      use32BitWorkerProcess: false
    }
  }
}

// Create diagnostic settings for the App Service
resource appServiceDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'appservice-diagnostics'
  scope: appService
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// Output values required by azd
output RESOURCE_GROUP_ID string = resourceGroup().id
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = subscription().tenantId
output SERVICE_SPOTIFY_MCP_SERVER_RESOURCE_EXISTS string = 'true'
output SERVICE_SPOTIFY_MCP_SERVER_NAME string = existingAppServiceName
output APPLICATIONINSIGHTS_CONNECTION_STRING string = applicationInsights.properties.ConnectionString
