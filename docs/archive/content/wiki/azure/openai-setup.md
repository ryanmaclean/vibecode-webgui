# Azure OpenAI Setup

This document outlines the Azure OpenAI integration for VibeCode's AI features.

## Prerequisites

- Azure subscription
- Azure CLI installed and configured
- `vibecode-openai` resource group created
- Azure OpenAI service deployed

## Configuration

1. **Environment Variables**
   Update your `.env.local` file with the following:
   ```
   # Azure OpenAI Configuration - DO NOT COMMIT THIS FILE
   AZURE_OPENAI_API_KEY=your-api-key-here
   AZURE_OPENAI_ENDPOINT=your-endpoint-here
   AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-3-small
   AZURE_OPENAI_API_VERSION=2023-05-15
   ```

2. **Deployed Models**
   - `text-embedding-3-small` (1536 dimensions)

## Testing

Run the test script to verify the integration:

```bash
# Source environment variables and run tests
set -a && source .env.local && set +a && npx tsx scripts/test-azure-openai.ts
```

## Troubleshooting

- **Missing environment variables**: Ensure `.env.local` is properly configured
- **Authentication errors**: Verify the API key is correct and has proper permissions
- **Model not found**: Check that the deployment name matches exactly

## Security Notes

- Never commit `.env.local` to version control
- Rotate API keys regularly
- Use Azure Key Vault for production deployments
