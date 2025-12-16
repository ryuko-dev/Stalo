const { spawn } = require('child_process');
const path = require('path');

// Azure startup script
// This ensures the app starts correctly on Azure App Service

const serverPath = path.join(__dirname, 'backend', 'dist', 'server.js');

console.log('Starting Stalo server from:', serverPath);

const server = spawn('node', [serverPath], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  env: { ...process.env }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log('Server exited with code:', code);
  process.exit(code || 0);
});
