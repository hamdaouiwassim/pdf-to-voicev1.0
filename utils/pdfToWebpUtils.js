const sharp = require('sharp');
const fsPromises = require('fs').promises;
const path = require('path');

// Lazy load pdf-poppler to avoid initialization errors on unsupported platforms
let Poppler = null;
function getPoppler() {
    if (!Poppler) {
        try {
            Poppler = require('pdf-poppler');
        } catch (error) {
            throw new Error(`pdf-poppler is not available: ${error.message}`);
        }
    }
    return Poppler;
}

/**
 * Convert PDF pages to WebP images using pdf-poppler
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputDir - Directory to save WebP images
 * @param {number} scale - Scale factor (default: 2000 for high quality - width in pixels)
 * @returns {Promise<Array<string>>} Array of WebP file paths (sorted by page number)
 */
async function convertPdfToWebp(pdfPath, outputDir, scale = 2000) {
    try {
        // Ensure output directory exists
        await fsPromises.mkdir(outputDir, { recursive: true });

        // Get base filename without extension
        const baseName = path.basename(pdfPath, path.extname(pdfPath));

        // Count pages using Poppler.info
        console.log(`[PDF to WebP] Reading PDF info...`);
        const PopplerLib = getPoppler();
        const pdfInfo = await PopplerLib.info(pdfPath);
        const pageCount = pdfInfo.pages;

        if (!pageCount || pageCount === 0) {
            throw new Error('No pages found in PDF');
        }

        console.log(`[PDF to WebP] Converting ${pageCount} pages to WebP (scale: ${scale}px width)...`);

        // Convert one page at a time to JPG (pdf-poppler may not support WebP directly)
        // Then convert JPG to WebP using sharp
        const imageFiles = [];
        for (let i = 1; i <= pageCount; i++) {
            const options = {
                format: 'jpg', // Convert to JPG first (more reliable than WebP)
                out_dir: outputDir,
                out_prefix: `${baseName}_page`,
                page: i,
                scale: scale // Higher resolution (width in pixels, maintains aspect ratio)
            };

            console.log(`[PDF to WebP] Converting page ${i}/${pageCount} to JPG...`);
            const PopplerLib = getPoppler();
            await PopplerLib.convert(pdfPath, options);

            // Wait a bit for file system to sync
            await new Promise(resolve => setTimeout(resolve, 100));

            // List all files in output directory to see what was created
            const allFiles = await fsPromises.readdir(outputDir);
            const imageFilesInDir = allFiles.filter(f => 
                f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')
            );
            
            console.log(`[PDF to WebP] Image files in output directory after page ${i}:`, imageFilesInDir);

            // Find the file that was created (JPG, PNG, or WebP)
            // Try multiple patterns: {prefix}-{page}.jpg, {prefix}{page}.jpg, etc.
            let createdFile = imageFilesInDir.find(f => {
                const ext = path.extname(f).toLowerCase();
                if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png' && ext !== '.webp') return false;
                
                // Pattern 1: {baseName}_page-{i}.jpg or {baseName}_page-{padded}.jpg
                if (f === `${baseName}_page-${i}.${ext.slice(1)}` || 
                    f === `${baseName}_page-${i.toString().padStart(2, '0')}.${ext.slice(1)}`) {
                    return true;
                }
                // Pattern 2: {baseName}_page{i}.jpg (no dash)
                if (f === `${baseName}_page${i}.${ext.slice(1)}` || 
                    f === `${baseName}_page${i.toString().padStart(2, '0')}.${ext.slice(1)}`) {
                    return true;
                }
                // Pattern 3: page-{i}.jpg or page{i}.jpg (just the prefix)
                if (f === `page-${i}.${ext.slice(1)}` || f === `page${i}.${ext.slice(1)}` || 
                    f === `page-${i.toString().padStart(2, '0')}.${ext.slice(1)}` || 
                    f === `page${i.toString().padStart(2, '0')}.${ext.slice(1)}`) {
                    return true;
                }
                // Pattern 4: Extract page number from filename and match
                const pageMatch = f.match(/(?:page|page-)(\d+)\.(jpg|jpeg|png|webp)$/i);
                if (pageMatch && parseInt(pageMatch[1]) === i) {
                    return true;
                }
                return false;
            });

            // If still not found, try to find any new image file that wasn't there before
            if (!createdFile && i === 1) {
                // For first page, any image file is likely ours
                createdFile = imageFilesInDir.find(f => 
                    (f.includes('page') || f.startsWith(baseName)) && 
                    (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp'))
                );
            }

            if (createdFile) {
                const createdFilePath = path.join(outputDir, createdFile);
                const ext = path.extname(createdFile).toLowerCase();
                const webpFilename = `${baseName}_page-${i.toString().padStart(2, '0')}.webp`;
                const webpPath = path.join(outputDir, webpFilename);
                
                // If it's already WebP, just rename if needed
                if (ext === '.webp') {
                    if (createdFile !== webpFilename) {
                        try {
                            await fsPromises.rename(createdFilePath, webpPath);
                            console.log(`[PDF to WebP] Renamed ${createdFile} to ${webpFilename}`);
                        } catch (renameError) {
                            console.warn(`[PDF to WebP] Could not rename ${createdFile}, using original name`);
                            imageFiles.push(createdFilePath);
                            continue;
                        }
                    }
                    imageFiles.push(webpPath);
                } else {
                    // Convert JPG/PNG to WebP using sharp
                    try {
                        console.log(`[PDF to WebP] Converting ${createdFile} to WebP...`);
                        await sharp(createdFilePath)
                            .webp({ 
                                quality: 90, // High quality WebP
                                effort: 6 // Higher effort for better compression
                            })
                            .toFile(webpPath);
                        
                        // Delete the original JPG/PNG file
                        await fsPromises.unlink(createdFilePath);
                        imageFiles.push(webpPath);
                        console.log(`[PDF to WebP] Page ${i} converted successfully: ${webpFilename}`);
                    } catch (convertError) {
                        console.error(`[PDF to WebP] Failed to convert ${createdFile} to WebP:`, convertError.message);
                        // If conversion fails, keep the original file
                        imageFiles.push(createdFilePath);
                    }
                }
            } else {
                console.error(`[PDF to WebP] Page ${i} conversion failed - file not found. Available files:`, imageFilesInDir);
                // Try to continue with other pages
            }
        }
        
        // Update webpFiles reference
        const webpFiles = imageFiles;

        // If we're missing some files, try to find them by scanning all image files (JPG, PNG, WebP)
        if (webpFiles.length < pageCount) {
            console.log(`[PDF to WebP] Only found ${webpFiles.length} of ${pageCount} files, scanning for missing files...`);
            const allFiles = await fsPromises.readdir(outputDir);
            const existingPaths = webpFiles.map(f => path.basename(f));
            
            // Get all image files that weren't already found
            const missingImageFiles = allFiles.filter(f => 
                (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')) &&
                !existingPaths.includes(f)
            );
            
            console.log(`[PDF to WebP] Found ${missingImageFiles.length} image files in directory:`, missingImageFiles);
            
            // Try to extract page numbers from filenames and match them
            const filePageMap = [];
            for (const file of missingImageFiles) {
                // Try multiple patterns to extract page number
                let pageNum = null;
                
                // Pattern 1: Extract number before extension (e.g., "page-1.jpg", "page1.jpg", "1.jpg")
                const patterns = [
                    /(\d+)\.(jpg|jpeg|png|webp)$/i,  // Any number before extension
                    /-(\d+)\.(jpg|jpeg|png|webp)$/i, // Number after dash
                    /page[_-]?(\d+)\.(jpg|jpeg|png|webp)$/i, // page-1, page_1, page1
                ];
                
                for (const pattern of patterns) {
                    const match = file.match(pattern);
                    if (match) {
                        pageNum = parseInt(match[1]);
                        if (pageNum >= 1 && pageNum <= pageCount) {
                            break;
                        }
                    }
                }
                
                if (pageNum && pageNum >= 1 && pageNum <= pageCount) {
                    filePageMap.push({ file, pageNum });
                }
            }
            
            // Sort by page number and convert to WebP
            filePageMap.sort((a, b) => a.pageNum - b.pageNum);
            
            for (const { file, pageNum } of filePageMap) {
                const webpFilename = `${baseName}_page-${pageNum.toString().padStart(2, '0')}.webp`;
                const webpPath = path.join(outputDir, webpFilename);
                const actualPath = path.join(outputDir, file);
                const ext = path.extname(file).toLowerCase();
                
                try {
                    if (ext === '.webp') {
                        // Already WebP, just rename if needed
                        if (file !== webpFilename) {
                            await fsPromises.rename(actualPath, webpPath);
                            console.log(`[PDF to WebP] Found and renamed missing file: ${file} -> ${webpFilename}`);
                        }
                        webpFiles.push(webpPath);
                    } else {
                        // Convert JPG/PNG to WebP
                        await sharp(actualPath)
                            .webp({ quality: 90, effort: 6 })
                            .toFile(webpPath);
                        await fsPromises.unlink(actualPath); // Delete original
                        webpFiles.push(webpPath);
                        console.log(`[PDF to WebP] Found and converted missing file: ${file} -> ${webpFilename}`);
                    }
                } catch (error) {
                    console.warn(`[PDF to WebP] Could not process ${file}:`, error.message);
                    // If it's already WebP, add it anyway
                    if (ext === '.webp') {
                        webpFiles.push(actualPath);
                    }
                }
            }
            
            // If still missing files, just add all remaining image files in order and convert
            if (webpFiles.length < pageCount) {
                const remainingFiles = missingImageFiles.filter(f => 
                    !filePageMap.some(m => m.file === f)
                );
                
                if (remainingFiles.length > 0) {
                    console.log(`[PDF to WebP] Adding ${remainingFiles.length} remaining image files without page number extraction`);
                    remainingFiles.sort().forEach(async (file, index) => {
                        const pageNum = webpFiles.length + index + 1;
                        if (pageNum <= pageCount) {
                            const webpFilename = `${baseName}_page-${pageNum.toString().padStart(2, '0')}.webp`;
                            const webpPath = path.join(outputDir, webpFilename);
                            const actualPath = path.join(outputDir, file);
                            const ext = path.extname(file).toLowerCase();
                            
                            try {
                                if (ext === '.webp') {
                                    if (file !== webpFilename) {
                                        await fsPromises.rename(actualPath, webpPath);
                                    }
                                    webpFiles.push(webpPath);
                                } else {
                                    await sharp(actualPath)
                                        .webp({ quality: 90, effort: 6 })
                                        .toFile(webpPath);
                                    await fsPromises.unlink(actualPath);
                                    webpFiles.push(webpPath);
                                }
                            } catch (error) {
                                console.warn(`[PDF to WebP] Could not process ${file}:`, error.message);
                            }
                        }
                    });
                }
            }
        }

        // Final fallback: if we still have 0 files, just collect all image files in the directory and convert
        if (webpFiles.length === 0) {
            console.log(`[PDF to WebP] No files found with pattern matching, collecting all image files in directory...`);
            const allFiles = await fsPromises.readdir(outputDir);
            const allImageFiles = allFiles.filter(f => 
                f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')
            ).sort();
            
            console.log(`[PDF to WebP] Found ${allImageFiles.length} image files:`, allImageFiles);
            
            for (let i = 0; i < allImageFiles.length && i < pageCount; i++) {
                const file = allImageFiles[i];
                const pageNum = i + 1;
                const webpFilename = `${baseName}_page-${pageNum.toString().padStart(2, '0')}.webp`;
                const webpPath = path.join(outputDir, webpFilename);
                const actualPath = path.join(outputDir, file);
                const ext = path.extname(file).toLowerCase();
                
                try {
                    if (ext === '.webp') {
                        if (file !== webpFilename) {
                            await fsPromises.rename(actualPath, webpPath);
                            console.log(`[PDF to WebP] Renamed ${file} to ${webpFilename}`);
                        }
                        webpFiles.push(webpPath);
                    } else {
                        // Convert to WebP
                        await sharp(actualPath)
                            .webp({ quality: 90, effort: 6 })
                            .toFile(webpPath);
                        await fsPromises.unlink(actualPath); // Delete original
                        webpFiles.push(webpPath);
                        console.log(`[PDF to WebP] Converted ${file} to ${webpFilename}`);
                    }
                } catch (error) {
                    console.warn(`[PDF to WebP] Could not process ${file}, using original:`, error.message);
                    if (ext === '.webp') {
                        webpFiles.push(actualPath);
                    }
                }
            }
        }

        // Sort by page number to ensure correct order
        webpFiles.sort((a, b) => {
            const filenameA = path.basename(a);
            const filenameB = path.basename(b);
            const pageNumA = parseInt(filenameA.match(/(\d+)\.webp$/)?.[1] || '0');
            const pageNumB = parseInt(filenameB.match(/(\d+)\.webp$/)?.[1] || '0');
            return pageNumA - pageNumB;
        });

        console.log(`[PDF to WebP] Successfully converted ${webpFiles.length} of ${pageCount} pages to WebP`);
        
        if (webpFiles.length < pageCount) {
            console.warn(`[PDF to WebP] Warning: Only ${webpFiles.length} of ${pageCount} pages were converted`);
        }
        
        if (webpFiles.length === 0) {
            console.error(`[PDF to WebP] ERROR: No WebP files found in ${outputDir}`);
            // List all files in directory for debugging
            const allFiles = await fsPromises.readdir(outputDir);
            const imageFiles = allFiles.filter(f => 
                f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')
            );
            console.error(`[PDF to WebP] All image files in directory:`, imageFiles);
            console.error(`[PDF to WebP] All files in directory:`, allFiles);
        }
        
        return webpFiles;
    } catch (error) {
        console.error('[PDF to WebP] Conversion error:', error.message);
        throw new Error(`Failed to convert PDF to WebP: ${error.message}`);
    }
}

/**
 * Check if required packages are available
 * @returns {Promise<boolean>}
 */
async function checkPopplerAvailable() {
    try {
        getPoppler();
        return true;
    } catch (error) {
        console.warn('[PDF to WebP] pdf-poppler package not available:', error.message);
        return false;
    }
}

module.exports = {
    convertPdfToWebp,
    checkPopplerAvailable
};
