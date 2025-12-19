const http = require('http');

// Store session cookie
let sessionCookie = null;

function makeRequest(path, method = 'GET', postData = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Include session cookie if we have one
        if (sessionCookie) {
            options.headers['Cookie'] = sessionCookie;
        }

        const req = http.request(options, (res) => {
            let data = '';

            // Capture Set-Cookie header for session
            if (res.headers['set-cookie']) {
                sessionCookie = res.headers['set-cookie'][0].split(';')[0];
            }

            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    data: data,
                    headers: res.headers
                });
            });
        });

        req.on('error', (err) => reject(err));

        if (postData) {
            req.write(JSON.stringify(postData));
        }

        req.end();
    });
}

async function run() {
    try {
        console.log('=== Testing Chapter Page Timings Endpoint ===\n');

        // Step 1: Login (you'll need valid credentials)
        console.log('1. Attempting login...');
        const loginResponse = await makeRequest('/api/auth/login', 'POST', {
            username: 'admin',  // Change these to valid credentials
            password: 'admin123'
        });

        console.log('   Status:', loginResponse.statusCode);
        if (loginResponse.statusCode === 200) {
            console.log('   ✓ Login successful');
        } else {
            console.log('   ✗ Login failed:', loginResponse.data.substring(0, 200));
            console.log('\n   Please update credentials in test_chapter_timings.js');
            return;
        }

        // Step 2: Test the chapter page-timings endpoint
        const courseId = '6cc41c69-b56f-45a4-9a1b-ad2c8276b251';
        const chapterId = 'ce1d5528-7bba-42d1-ac34-2b57bbbc69a8';
        const endpoint = `/api/courses/${courseId}/chapters/${chapterId}/page-timings`;

        console.log(`\n2. Testing page-timings endpoint:`);
        console.log(`   ${endpoint}`);

        const timingsResponse = await makeRequest(endpoint);
        console.log('   Status:', timingsResponse.statusCode);

        if (timingsResponse.statusCode === 200) {
            console.log('   ✓ Success! Response:');
            const timings = JSON.parse(timingsResponse.data);
            console.log(`\n   Found ${timings.length} pages:`);
            timings.forEach((t, i) => {
                if (i < 5) { // Show first 5 pages
                    console.log(`   - Page ${t.page}: starts at ${t.time}s (${t.wordCount} words)`);
                }
            });
            if (timings.length > 5) {
                console.log(`   ... and ${timings.length - 5} more pages`);
            }
        } else if (timingsResponse.statusCode === 302) {
            console.log('   ✗ Still getting 302 redirect (authentication issue)');
            console.log('   Location:', timingsResponse.headers.location);
        } else if (timingsResponse.statusCode === 404) {
            console.log('   ✗ Chapter not found');
            console.log('   Response:', timingsResponse.data);
        } else {
            console.log('   ✗ Error:', timingsResponse.data.substring(0, 300));
        }

    } catch (err) {
        console.error('Error executing test:', err);
    }
}

run();
