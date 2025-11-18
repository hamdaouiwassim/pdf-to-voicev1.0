const markdownpdf = require("markdown-pdf");
const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "TECHNICAL_BENEFITS_AND_PERFORMANCE_REPORT.md");
const outputFile = path.join(__dirname, "TECHNICAL_BENEFITS_AND_PERFORMANCE_REPORT.pdf");

const options = {
    paperFormat: "A4",
    paperOrientation: "portrait",
    paperBorder: "2cm",
    renderDelay: 1000,
    cssPath: path.join(__dirname, "pdf-styles.css")
};

console.log("Converting markdown to PDF...");
console.log(`Input: ${inputFile}`);
console.log(`Output: ${outputFile}`);

markdownpdf(options)
    .from(inputFile)
    .to(outputFile, function () {
        console.log("PDF generated successfully!");
        console.log(`Output file: ${outputFile}`);
    });

