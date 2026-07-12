at you doingconst { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('npx', ['next', 'build']);
let output = '';

child.stdout.on('data', (data) => {
  output += data.toString();
});

child.stderr.on('data', (data) => {
  output += data.toString();
});

child.on('close', (code) => {
  fs.writeFileSync('my_build_output.txt', output);
  console.log(`child process exited with code ${code}`);
});