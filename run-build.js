import { execSync } from 'child_process';
import * as fs from 'fs';

try {
  const out = execSync('npm run build', { encoding: 'utf8' });
  fs.writeFileSync('build-out.txt', out);
} catch (e) {
  fs.writeFileSync('build-out.txt', e.stdout + '\n' + e.stderr + '\n' + e.message);
}