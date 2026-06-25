import { promises as fs } from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_PATH = path.join(__dirname, '..', 'firestore.rules');

async function deployRules() {
  // Load credentials: prefer FIREBASE_ADMIN_SDK_CONFIG env var, fall back to file
  let serviceAccount;
  const configJson = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  if (configJson) {
    console.log('Loading service account from FIREBASE_ADMIN_SDK_CONFIG...');
    serviceAccount = JSON.parse(configJson);
  } else {
    const filePath = path.join(__dirname, '..', 'firebase-service-account.json');
    console.log(`Loading service account from file: ${filePath}`);
    const content = await fs.readFile(filePath, 'utf8');
    serviceAccount = JSON.parse(content);
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const PROJECT_ID = serviceAccount.project_id;
  if (!PROJECT_ID) throw new Error('project_id missing from service account credentials.');
  console.log(`Project ID: ${PROJECT_ID}`);

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
  const rulesContent = await fs.readFile(RULES_PATH, 'utf8');

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
