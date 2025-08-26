#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const net = require('net');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

// Check if a port is in use
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
}

// Wait for a service to be ready
async function waitForService(url, maxRetries = 30, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch (e) {
      // Service not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return false;
}

// Kill process on a specific port
async function killPort(port) {
  return new Promise((resolve) => {
    exec(`lsof -ti :${port} | xargs kill -9`, (error) => {
      // Ignore errors (port might not be in use)
      resolve();
    });
  });
}

// Start a service
function startService(name, command, cwd, readyCheck) {
  console.log(`${colors.blue}Starting ${name}...${colors.reset}`);
  
  const [cmd, ...args] = command.split(' ');
  const service = spawn(cmd, args, {
    cwd,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  // Log output with service name prefix
  service.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colors.blue}[${name}]${colors.reset} ${line}`);
    });
  });

  service.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.error(`${colors.red}[${name}]${colors.reset} ${line}`);
    });
  });

  service.on('error', (error) => {
    console.error(`${colors.red}Failed to start ${name}: ${error.message}${colors.reset}`);
  });

  return { service, readyCheck };
}

async function main() {
  console.log(`${colors.green}🚀 Starting Development Environment${colors.reset}`);
  console.log('');

  const services = [];
  
  // Check and start Ponder indexer
  const indexerPort = 42069;
  const indexerInUse = await isPortInUse(indexerPort);
  
  if (indexerInUse) {
    console.log(`${colors.yellow}✓ Ponder indexer already running on port ${indexerPort}${colors.reset}`);
  } else {
    const indexerPath = path.join(__dirname, '../../indexing');
    services.push(
      startService(
        'Ponder',
        'npm run dev',
        indexerPath,
        () => waitForService(`http://localhost:${indexerPort}/status`)
      )
    );
  }

  // Check and start Next.js frontend
  const frontendPort = 3001;
  const frontendInUse = await isPortInUse(frontendPort);
  
  if (frontendInUse) {
    console.log(`${colors.yellow}✓ Frontend already running on port ${frontendPort}${colors.reset}`);
  } else {
    const frontendPath = path.join(__dirname, '..');
    services.push(
      startService(
        'Frontend',
        'npm run dev',
        frontendPath,
        () => waitForService(`http://localhost:${frontendPort}`)
      )
    );
  }

  // Wait for all services to be ready
  if (services.length > 0) {
    console.log('');
    console.log(`${colors.blue}Waiting for services to be ready...${colors.reset}`);
    
    const readyChecks = await Promise.all(
      services.map(async ({ readyCheck }) => {
        const ready = await readyCheck();
        return ready;
      })
    );
    
    const allReady = readyChecks.every(ready => ready);
    
    if (allReady) {
      console.log('');
      console.log(`${colors.green}✅ All services are ready!${colors.reset}`);
      console.log('');
      console.log(`Frontend: http://localhost:${frontendPort}`);
      console.log(`Indexer: http://localhost:${indexerPort}`);
    } else {
      console.log(`${colors.red}⚠️  Some services failed to start${colors.reset}`);
    }
  } else {
    console.log('');
    console.log(`${colors.green}✅ All services were already running!${colors.reset}`);
    console.log('');
    console.log(`Frontend: http://localhost:${frontendPort}`);
    console.log(`Indexer: http://localhost:${indexerPort}`);
  }

  // Handle cleanup on exit
  const cleanup = () => {
    console.log('');
    console.log(`${colors.yellow}Shutting down services...${colors.reset}`);
    services.forEach(({ service }) => {
      service.kill();
    });
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep the script running
  if (services.length > 0) {
    console.log('');
    console.log(`${colors.yellow}Press Ctrl+C to stop all services${colors.reset}`);
    
    // Keep process alive
    setInterval(() => {}, 1000);
  }
}

main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});