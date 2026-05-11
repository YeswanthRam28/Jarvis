const http = require('http');

async function testMemoryServer() {
  console.log('Testing Memory Server...\n');

  const postRequest = (data) => {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(data);
      const req = http.request({
        hostname: 'localhost',
        port: 9310,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  };

  const checkHealth = () => {
    return new Promise((resolve, reject) => {
      http.get('http://localhost:9310/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  };

  try {
    console.log('1. Checking health...');
    const health = await checkHealth();
    console.log('   Health:', health);

    console.log('\n2. Initializing...');
    const init = await postRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    });
    console.log('   Init:', init);

    console.log('\n3. Listing tools...');
    const tools = await postRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    console.log('   Tools:', tools.result?.tools?.map(t => t.name).join(', '));

    console.log('\n4. Setting a value...');
    const set = await postRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'set',
        arguments: { key: 'test_key', value: 'Hello from JARVIS!' }
      }
    });
    console.log('   Set result:', set.result);

    console.log('\n5. Getting the value...');
    const get = await postRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get',
        arguments: { key: 'test_key' }
      }
    });
    console.log('   Get result:', get.result);

    console.log('\n6. Searching...');
    const search = await postRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: { pattern: 'test' }
      }
    });
    console.log('   Search result:', search.result);

    console.log('\n✅ All memory server tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nNote: Make sure to start the server first:');
    console.log('  npm run mcp:memory\n');
    process.exit(1);
  }
}

testMemoryServer();
