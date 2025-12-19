const fs = require('fs');
const path = require('path');

const chapterDir = path.join(__dirname, 'uploads', 'courses', '6cc41c69-b56f-45a4-9a1b-ad2c8276b251', 'ce1d5528-7bba-42d1-ac34-2b57bbbc69a8');

console.log('Checking chapter directory:', chapterDir);
console.log('=====================================\n');

// List all files in the chapter directory
fs.readdir(chapterDir, (err, files) => {
    if (err) {
        console.error('❌ Cannot read directory:', err.message);
        return;
    }

    console.log('Files in chapter directory:');
    files.forEach(file => {
        const filePath = path.join(chapterDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  - ${file} (${stats.size} bytes)`);
    });

    console.log('\n=====================================');
    console.log('Recommendation:');
    console.log('If the visual PDF is valid, you can copy it to replace the text PDF:');
    console.log('\nRun this command in PowerShell:');
    console.log(`Copy-Item "${path.join(chapterDir, 'ce1d5528-7bba-42d1-ac34-2b57bbbc69a8_visual.pdf')}" -Destination "${path.join(chapterDir, 'ce1d5528-7bba-42d1-ac34-2b57bbbc69a8_text.pdf')}"`);
});
