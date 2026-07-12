const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('npm run build 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync('build_result.txt', output);
  console.log('Build succeeded');
} catch (error) {
  fs.writeFileSync('build_result.txt', error.stdout || '' + '\n' + (error.stderr || ''));
  console.log('Build failed');
}