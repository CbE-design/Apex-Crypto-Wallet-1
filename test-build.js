const { execSync } = require('child_process');
try {
  const output = execSync('npm run build', { encoding: 'utf-8' });
  console.log('SUCCESS');
  console.log(output);
} catch (error) {
  console.log('ERROR');
  console.log(error.stdout);
  console.log(error.stderr);
}