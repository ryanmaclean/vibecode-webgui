const https = require('https');

const subscriptionId = 'ec851931-6b47-47a3-8605-820e1162cf12'; // Default subscription ID
const resourceGroup = 'vibecode-openai-rg';
const accountName = 'vibecode-openai';
const token = process.argv[2];

const options = {
  hostname: 'management.azure.com',
  path: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${accountName}/deployments?api-version=2023-05-01`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.error) {
        console.error('Error:', result.error);
      } else {
        const deployments = result.value || [];
        console.log('Deployments:');
        deployments.forEach(d => {
          console.log(`- Name: ${d.name}`);
          console.log(`  Model: ${d.properties?.model?.name || 'N/A'}`);
          console.log(`  Version: ${d.properties?.model?.version || 'N/A'}`);
          console.log(`  Status: ${d.properties?.provisioningState || 'N/A'}`);
          console.log('---');
        });
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
