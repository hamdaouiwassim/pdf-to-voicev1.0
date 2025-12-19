const http = require('http');

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({
            hostname: 'localhost',
            port: 3000,
            path: path,
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, data: data });
            });
        });

        req.on('error', (err) => reject(err));
    });
}

async function run() {
    try {
        console.log('1. Checking health...');
        const health = await makeRequest('/api/health');
        console.log('   Status:', health.statusCode);

        console.log('\n2. Listing documents...');
        const docs = await makeRequest('/api/documents');
        console.log('   Status:', docs.statusCode);

        if (docs.statusCode !== 200) {
            console.error('   Failed to list docs. Response:', docs.data.substring(0, 200));
            return;
        }

        let documents;
        try {
            documents = JSON.parse(docs.data);
        } catch (e) {
            console.error('   Failed to parse JSON:', e.message);
            console.error('   Data:', docs.data.substring(0, 200));
            return;
        }

        if (!Array.isArray(documents) || documents.length === 0) {
            console.log('   No documents found. Cannot test timings.');
            return;
        }

        const docId = documents[0].id;
        console.log(`   Found ${documents.length} documents. Using first ID: ${docId}`);

        console.log(`\n3. Testing timings for docId: ${docId}`);
        const timings = await makeRequest(`/api/documents/${docId}/page-timings`);
        console.log('   Status:', timings.statusCode);

        if (timings.statusCode === 200) {
            console.log('   Success! Response data:');
            console.log(timings.data.substring(0, 1000)); // Show first 1000 chars
        } else {
            console.error('   Failed. Response:', timings.data);
        }

    } catch (err) {
        console.error('Error executing test:', err);
    }
}

run();
