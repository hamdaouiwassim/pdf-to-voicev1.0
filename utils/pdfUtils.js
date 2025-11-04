const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

/**
 * Creates a PDF document from text and saves it to the file system.
 * @param {string} filePath - Full path where PDF should be saved
 * @param {string} title - Document title
 * @param {string} text - Document text content
 * @returns {Promise<void>}
 */
function createPDF(filePath, title, text) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(filePath);
        
        doc.pipe(stream);
        doc.fontSize(12).text(title, { align: 'center' }).moveDown(1);
        doc.fontSize(10).text(text);
        
        doc.on('end', () => {
            stream.on('finish', resolve);
        });
        
        doc.on('error', reject);
        stream.on('error', reject);
        
        doc.end();
    });
}

module.exports = {
    createPDF,
};

