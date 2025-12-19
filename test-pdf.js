const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Update this path to your actual chapter text PDF
const pdfPath = path.join(__dirname, 'uploads', 'courses', '6cc41c69-b56f-45a4-9a1b-ad2c8276b251', 'ce1d5528-7bba-42d1-ac34-2b57bbbc69a8', 'ce1d5528-7bba-42d1-ac34-2b57bbbc69a8_text.pdf');

console.log('Testing PDF:', pdfPath);
console.log('=====================================\n');

fs.readFile(pdfPath, async (err, dataBuffer) => {
    if (err) {
        console.error('❌ File read error:', err.message);
        console.log('\nPossible reasons:');
        console.log('  - File does not exist at this path');
        console.log('  - Insufficient permissions to read the file');
        return;
    }

    console.log('✅ File found and readable');
    console.log('File size:', dataBuffer.length, 'bytes');

    // Check if file is empty
    if (dataBuffer.length === 0) {
        console.error('❌ File is empty (0 bytes)');
        return;
    }

    // Check PDF header
    const header = dataBuffer.slice(0, 20).toString('utf-8', 0, 20);
    console.log('File header:', header);

    if (!header.startsWith('%PDF-')) {
        console.error('❌ Not a valid PDF file (missing %PDF- header)');
        console.log('Expected: %PDF-1.4 or %PDF-1.5 or %PDF-1.7');
        console.log('Got:', header.substring(0, 10));
        return;
    }

    console.log('✅ Valid PDF header detected');

    // Try to parse the PDF
    console.log('\nAttempting to parse PDF...');
    try {
        const data = await pdfParse(dataBuffer);
        console.log('\n✅ PDF PARSED SUCCESSFULLY!');
        console.log('=====================================');
        console.log('Number of pages:', data.numpages);
        console.log('Text length:', data.text.length, 'characters');
        console.log('\nFirst 200 characters of extracted text:');
        console.log('---');
        console.log(data.text.substring(0, 200));
        console.log('---');

        if (data.text.length === 0) {
            console.warn('\n⚠️  Warning: PDF parsed but contains no text');
            console.log('This might be a scanned/image-only PDF');
        }
    } catch (error) {
        console.error('\n❌ PDF PARSING FAILED!');
        console.error('=====================================');
        console.error('Error:', error.message);
        console.error('\nPossible reasons:');
        console.error('  - PDF is encrypted/password-protected');
        console.error('  - PDF is corrupted');
        console.error('  - PDF uses unsupported features');
        console.error('  - PDF version is too new (PDF 2.0+)');
        console.error('\nFull error stack:');
        console.error(error.stack);
    }
});
