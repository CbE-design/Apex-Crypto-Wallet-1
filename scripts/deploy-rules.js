const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'firebase-service-account.json');
const RULES_PATH = path.join(__dirname, '..', 'firestore.rules');
const PROJECT_ID = 'studio-8025635453-a4860';

async function deployRules() {
  console.log('Loading service account...');
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

  console.log('Authenticating...');
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase'
    ]
  });

  const firebaserules = google.firebaserules({ version: 'v1', auth });

  console.log('Reading firestore.rules...');
  const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');

  console.log('Creating ruleset...');
  const rulesetRes = await firebaserules.projects.rulesets.create({
    name: `projects/${PROJECT_ID}`,
    requestBody: {
      source: {
        files: [{ name: 'firestore.rules', content: rulesContent }]
      }
    }
  });

  const rulesetName = rulesetRes.data.name;
  console.log(`Ruleset created: ${rulesetName}`);

  console.log('Updating release...');
  const releaseRes = await firebaserules.projects.releases.patch({
    name: `projects/${PROJECT_ID}/releases/cloud.firestore`,
    requestBody: {
      release: {
        name: `projects/${PROJECT_ID}/releases/cloud.firestore`,
        rulesetName
      }
    }
  });

  console.log('✅ Firestore rules deployed successfully!');
  console.log(`   Ruleset: ${releaseRes.data.rulesetName}`);
  console.log(`   Updated: ${releaseRes.data.updateTime}`);
}

deployRules().catch(err => {
  console.error('❌ Deploy failed:', err.message);
  if (err.response) console.error('   Details:', JSON.stringify(err.response.data));
  process.exit(1);
});
