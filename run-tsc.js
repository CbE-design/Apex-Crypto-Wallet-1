const { execSync } = require('child_process');
const fs = require('fs');

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  fs.writeFileSync('tserr.txt', 'OK');
} catch (e) {
  fs.writeFileSync('tserr.txt', e.stdout ? e.stdout.toString() : e.message);
}