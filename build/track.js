const https = require('https');
const { execSync } = require('child_process');

const version = process.env.TCBUILD_ASSET_FULL_NAME;
const entityGuid = process.argv[2];
const NR_API_KEY = process.env.NR_API_KEY;
const ERR_EXIT_CODE = 0; // For now non-fatal exit code

if (!version || !entityGuid || !NR_API_KEY) {
  console.error('Missing arguments or environment variables');
  process.exit(ERR_EXIT_CODE);
}

let commit;
try {
  commit = execSync('git rev-parse HEAD').toString().trim();
} catch (error) {
  console.error('Error getting commit from git');
  process.exit(ERR_EXIT_CODE);
}

const DATA = `{"query": "mutation { changeTrackingCreateDeployment( deployment: { version: \\"${version}\\", entityGuid: \\"${entityGuid}\\", commit: \\"${commit}\\" } ) { deploymentId entityGuid } }"}`;

const options = {
  hostname: 'staging-api.newrelic.com',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Api-Key': NR_API_KEY,
    'NewRelic-Requesting-Services': 'CodeStream'
  }
};

const req = https.request(options, res => {
  let data = '';

  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode < 200 || res.statusCode >= 400) {
      console.error('Error sending deployment event to New Relic');
      console.error(`HTTP Status: ${res.statusCode}`);
      console.error(`Response: ${data}`);
      process.exit(ERR_EXIT_CODE);
    } else {
      console.log('Deployment event sent to New Relic');
    }
  });
});
