/**
 * Script to generate PDF invoice from HTML
 * 
 * Usage: node generate-invoice-pdf.js
 * 
 * Requirements:
 * - Install puppeteer: npm install puppeteer
 * OR
 * - Open INVOICE_DEVELOPERS.html in browser and print to PDF
 */

const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'INVOICE_DEVELOPERS.html');
const pdfFile = path.join(__dirname, 'INVOICE_DEVELOPERS.pdf');

// Check if puppeteer is available
let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.log('Puppeteer not installed. Using alternative method...');
    console.log('\nTo generate PDF:');
    console.log('1. Open INVOICE_DEVELOPERS.html in your browser');
    console.log('2. Press Ctrl+P (or Cmd+P on Mac)');
    console.log('3. Select "Save as PDF" as destination');
    console.log('4. Click Save');
    console.log('\nOR install puppeteer: npm install puppeteer');
    process.exit(0);
}

async function generatePDF() {
    try {
        console.log('Generating PDF invoice...');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Read HTML file
        const html = fs.readFileSync(htmlFile, 'utf8');
        
        // Set content
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });
        
        // Generate PDF
        await page.pdf({
            path: pdfFile,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });
        
        await browser.close();
        
        console.log('✅ PDF invoice generated successfully!');
        console.log(`📄 File: ${pdfFile}`);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        console.log('\nAlternative method:');
        console.log('1. Open INVOICE_DEVELOPERS.html in your browser');
        console.log('2. Press Ctrl+P (or Cmd+P on Mac)');
        console.log('3. Select "Save as PDF"');
        console.log('4. Click Save');
    }
}

// Run if puppeteer is available
if (puppeteer) {
    generatePDF();
}

