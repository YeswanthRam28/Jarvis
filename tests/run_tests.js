const { spawn } = require('child_process');
const http = require('http');

const servers = [];
const tests = [];

function startServer(name, port, script) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ${name}...`);
    const proc = spawn('node', [script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });

    servers.push({ name, proc });

    // Wait for the server to be ready by polling health endpoint
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds

    const checkReady = () => {
      http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log(`  ${name} started on port ${port}`);
          resolve();
        } else {
          // Not ready yet, retry
          if (Date.now() - startTime > timeout) {
            reject(new Error(`${name} did not become ready in time`));
          } else {
            setTimeout(checkReady, 500);
          }
        }
      }).on('error', (err) => {
        // Connection refused, not ready yet
        if (Date.now() - startTime > timeout) {
          reject(new Error(`${name} failed to start: ${err.message}`));
        } else {
          setTimeout(checkReady, 500);
        }
      });
    };

    // Start checking after a short delay
    setTimeout(checkReady, 500);

    proc.stdout.on('data', (data) => {
      // Optionally log output
      // const output = data.toString().trim();
      // if (output) console.log(`  ${name} stdout: ${output}`);
    });

    proc.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.error(`  ${name} stderr: ${output}`);
      }
    });
  });
}

function runTest(name, testFn) {
  return async () => {
    try {
      console.log(`\n${name}...`);
      await testFn();
      console.log(`  ✅ ${name} PASSED`);
      tests.push({ name, passed: true });
    } catch (error) {
      console.error(`  ❌ ${name} FAILED: ${error.message}`);
      tests.push({ name, passed: false, error: error.message });
    }
  };
}

const checkHealth = (port) => new Promise((resolve, reject) => {
  http.get(`http://localhost:${port}/health`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Invalid JSON response: ${e.message}`));
      }
    });
  }).on('error', reject);
});

const postRequest = (port, data) => new Promise((resolve, reject) => {
  const body = JSON.stringify(data);
  const req = http.request({
    hostname: 'localhost',
    port,
    path: '/mcp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Invalid JSON response: ${e.message}`));
      }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           JARVIS CLI Test Suite                           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    console.log('Testing CLI commands...\n');

    runTest('CLI version', async () => {
      const { execSync } = require('child_process');
      const output = execSync('node dist/main/cli.js --version', { encoding: 'utf8' });
      if (!output.trim().startsWith('0.1')) throw new Error('Version mismatch');
    })();

    runTest('CLI init', async () => {
      const { execSync } = require('child_process');
      execSync('node dist/main/cli.js init', { encoding: 'utf8' });
    })();

    runTest('CLI config', async () => {
      const { execSync } = require('child_process');
      const output = execSync('node dist/main/cli.js config', { encoding: 'utf8' });
      if (!output.includes('nvidia/llama')) throw new Error('Config missing models');
    })();

    runTest('CLI profile', async () => {
      const { execSync } = require('child_process');
      const output = execSync('node dist/main/cli.js profile --get', { encoding: 'utf8' });
      if (!output.includes('identity')) throw new Error('Profile missing identity');
    })();

    console.log('\n\nStarting MCP Servers for integration tests...\n');
    await startServer('Memory Server', 9310, 'dist/mcps/memory/server.js');
    await startServer('Filesystem Server', 9322, 'dist/mcps/filesystem/server.js');

    runTest('Memory Server - health check', async () => {
      const health = await checkHealth(9310);
      if (health.status !== 'ok') throw new Error('Memory server not healthy');
    })();

    runTest('Memory Server - initialize', async () => {
      const result = await postRequest(9310, {
        jsonrpc: '2.0', id: 1, method: 'initialize'
      });
      if (!result.result?.serverInfo?.name === 'mcp-memory') throw new Error('Init failed');
    })();

    runTest('Memory Server - set value', async () => {
      const result = await postRequest(9310, {
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'set', arguments: { key: 'test', value: 'works!' } }
      });
      if (!result.result?.success) throw new Error('Set failed');
    })();

    runTest('Memory Server - get value', async () => {
      const result = await postRequest(9310, {
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: { name: 'get', arguments: { key: 'test' } }
      });
      if (!result.result?.found || result.result?.value !== 'works!') throw new Error('Get failed');
    })();

    runTest('Filesystem Server - health check', async () => {
      const health = await checkHealth(9322);
      if (health.status !== 'ok') throw new Error('Filesystem server not healthy');
    })();

    runTest('Filesystem Server - list tools', async () => {
      const result = await postRequest(9322, {
        jsonrpc: '2.0', id: 1, method: 'tools/list'
      });
      if (!result.result?.tools?.length) throw new Error('No tools listed');
    })();

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  } finally {
    console.log('\n\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    Test Summary                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    const passed = tests.filter(t => t.passed).length;
    const failed = tests.filter(t => !t.passed).length;

    console.log(`\nPassed: ${passed}/${tests.length}`);
    console.log(`Failed: ${failed}/${tests.length}`);

    if (failed > 0) {
      console.log('\nFailed tests:');
      tests.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.name}: ${t.error}`);
      });
    }

    console.log('\nCleaning up servers...');
    for (const { name, proc } of servers) {
      try {
        // Kill the process group (negative pid) to kill the server and any child processes
        if (proc.pid) {
          try {
            process.kill(-proc.pid);
          } catch {
            try {
              process.kill(proc.pid, 'SIGKILL');
            } catch {
              // Ignore
            }
          }
        }
        console.log(`  Stopped ${name}`);
      } catch (e) {
        console.log(`  Could not stop ${name}: ${e.message}`);
      }
    }

    console.log('\n' + (failed === 0 ? '✅ All tests passed!' : '❌ Some tests failed'));
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAllTests();
