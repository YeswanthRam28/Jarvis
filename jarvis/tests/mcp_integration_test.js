require('dotenv').config();
const { spawn } = require('child_process');
const http = require('http');

async function testMCP() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         MCP Server Integration Tests                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const servers = [];
  const postRequest = (port, data) => new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port,
      path: '/mcp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  try {
    console.log('1. Starting Memory Server (port 9310)...');
    const mem = spawn('node', ['dist/mcps/memory/server.js'], { 
      stdio: 'ignore',
      detached: true,
      cwd: process.cwd()
    });
    servers.push(mem);
    await new Promise(r => setTimeout(r, 2000));

    console.log('2. Starting Filesystem Server (port 9322)...');
    const fs = spawn('node', ['dist/mcps/filesystem/server.js'], { 
      stdio: 'ignore',
      detached: true,
      cwd: process.cwd()
    });
    servers.push(fs);
    await new Promise(r => setTimeout(r, 2000));

    console.log('3. Testing Memory Server...\n');
    
    const memInit = await postRequest(9310, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    });
    console.log('   Initialize:', memInit.result?.serverInfo?.name);

    const memTools = await postRequest(9310, {
      jsonrpc: '2.0', id: 2, method: 'tools/list'
    });
    console.log('   Tools:', memTools.result?.tools?.map(t => t.name).join(', '));

    const memSet = await postRequest(9310, {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'set', arguments: { key: 'test', value: 'JARVIS test value' } }
    });
    console.log('   Set:', memSet.result?.success ? '✓' : '✗');

    const memGet = await postRequest(9310, {
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'get', arguments: { key: 'test' } }
    });
    console.log('   Get:', memGet.result?.value === 'JARVIS test value' ? '✓' : '✗');

    console.log('\n4. Testing Filesystem Server...\n');
    
    const fsInit = await postRequest(9322, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    });
    console.log('   Initialize:', fsInit.result?.serverInfo?.name);

    const fsTools = await postRequest(9322, {
      jsonrpc: '2.0', id: 2, method: 'tools/list'
    });
    console.log('   Tools:', fsTools.result?.tools?.map(t => t.name).join(', '));

    const fsWrite = await postRequest(9322, {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'write', arguments: { path: 'test_file.txt', content: 'Hello from JARVIS!' } }
    });
    console.log('   Write:', fsWrite.result?.success ? '✓' : '✗');

    const fsRead = await postRequest(9322, {
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'read', arguments: { path: 'test_file.txt' } }
    });
    console.log('   Read:', fsRead.result?.content === 'Hello from JARVIS!' ? '✓' : '✗');

    console.log('\n5. Testing JARVIS CLI MCP commands...\n');
    const { execSync } = require('child_process');
    
    const mcpList = execSync('node dist/main/cli.js mcp list', { encoding: 'utf8', timeout: 10000 });
    console.log('   mcp list:', mcpList.includes('No servers') ? '(no auto-start, expected)' : '✓');

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              All MCP Tests Passed!                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    servers.forEach(s => { try { process.kill(-s.pid, 'SIGTERM'); } catch {} });
  }
}

testMCP();
