const { execSync } = require('child_process');
const fs = require('fs');
fs.writeFileSync('pwd.txt', execSync('pwd', { encoding: 'utf8' }));