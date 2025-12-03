const sharp = require('sharp');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Lazy load pdf-poppler to avoid initialization errors on unsupported platforms
let Poppler = null;
let useCommandLine = false;
let popplerChecked = false;

// Check if we're on Linux - pdf-poppler has issues on Linux, so use command-line tools directly
const isLinux = process.platform === 'linux';

function getPoppler() {
    if (popplerChecked) {
        return useCommandLine ? null : Poppler;
    }
    
    popplerChecked = true;
    
    // On Linux, skip pdf-poppler entirely and use command-line tools directly
    // This prevents the "linux is NOT supported" error message
    if (isLinux) {
        console.log('[PDF to WebP] Linux detected, using command-line Poppler tools');
        useCommandLine = true;
        return null;
    }
    
    // On other platforms, try to use pdf-poppler
    try {
        Poppler = require('pdf-poppler');
        console.log('[PDF to WebP] Using pdf-poppler package');
        return Poppler;
    } catch (error) {
        // If pdf-poppler fails, fall back to command-line Poppler tools
        console.warn('[PDF to WebP] pdf-poppler package not available, using command-line Poppler tools:', error.message);
        useCommandLine = true;
        return null;
    }
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

        // Check if we should use command-line tools
        getPoppler(); // This will set useCommandLine = true on Linux
        
        let pageCount;
        if (useCommandLine) {
            // Use pdfinfo command-line tool
            console.log(`[PDF to WebP] Reading PDF info using pdfinfo...`);
            try {
                const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
                const pageMatch = stdout.match(/Pages:\s*(\d+)/i);
                pageCount = pageMatch ? parseInt(pageMatch[1], 10) : 0;
            } catch (error) {
                // Fallback: try to count pages by attempting conversion
                console.warn('[PDF to WebP] pdfinfo failed, will determine page count during conversion');
                pageCount = null; // Will be determined during conversion
            }
        } else {
            // Use pdf-poppler package
            console.log(`[PDF to WebP] Reading PDF info...`);
            const PopplerLib = getPoppler();
            if (!PopplerLib) {
                // Fallback to command line if pdf-poppler is not available
                useCommandLine = true;
                const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
                const pageMatch = stdout.match(/Pages:\s*(\d+)/i);
                pageCount = pageMatch ? parseInt(pageMatch[1], 10) : 0;
            } else {
                const pdfInfo = await PopplerLib.info(pdfPath);
                pageCount = pdfInfo.pages;
            }
        }

        if (pageCount !== null && (!pageCount || pageCount === 0)) {
            throw new Error('No pages found in PDF');
        }

        console.log(`[PDF to WebP] Converting ${pageCount || '?'} pages to WebP (scale: ${scale}px width)...`);

        // Convert one page at a time to JPG, then to WebP using sharp
        const imageFiles = [];
        const maxPages = pageCount || 1000; // Safety limit if pageCount is unknown
        
        for (let i = 1; i <= maxPages; i++) {
            let jpgPath = null;
            
            if (useCommandLine || !Poppler) {
                // Use pdftoppm command-line tool
                console.log(`[PDF to WebP] Converting page ${i} to JPG using pdftoppm...`);
                const outputPrefix = path.join(outputDir, `${baseName}_page-${i.toString().padStart(2, '0')}`);
                
                try {
                    // pdftoppm -jpeg -r 2000 -f 1 -l 1 input.pdf output
                    // -r is resolution in DPI, we approximate scale/10 as DPI
                    const dpi = Math.round(scale / 10);
                    await execAsync(`pdftoppm -jpeg -r ${dpi} -f ${i} -l ${i} "${pdfPath}" "${outputPrefix}"`);
                    
                    // Find the created file
                    const files = await fsPromises.readdir(outputDir);
                    const createdFile = files.find(f => 
                        f.startsWith(`${baseName}_page-${i.toString().padStart(2, '0')}`) && 
                        (f.endsWith('.jpg') || f.endsWith('.jpeg'))
                    );
                    
                    if (createdFile) {
                        jpgPath = path.join(outputDir, createdFile);
                    } else {
                        // If no file found and we don't know page count, we might have reached the end
                        if (pageCount === null) {
                            break;
                        }
                        throw new Error(`Page ${i} conversion failed - file not found`);
                    }
                } catch (error) {
                    // If pageCount is unknown and we get an error, we've likely reached the end
                    if (pageCount === null && i > 1) {
                        break;
                    }
                    throw error;
                }
            } else {
                // Use pdf-poppler package
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
            }

            // Find the created JPG file if not already found (for pdf-poppler)
            if (!jpgPath) {
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
                    jpgPath = path.join(outputDir, createdFile);
                }
            }

            if (jpgPath) {
                const ext = path.extname(jpgPath).toLowerCase();
                const webpFilename = `${baseName}_page-${i.toString().padStart(2, '0')}.webp`;
                const webpPath = path.join(outputDir, webpFilename);
                
                // If it's already WebP, just rename if needed
                if (ext === '.webp') {
                    if (path.basename(jpgPath) !== webpFilename) {
                        try {
                            await fsPromises.rename(jpgPath, webpPath);
                            console.log(`[PDF to WebP] Renamed ${path.basename(jpgPath)} to ${webpFilename}`);
                        } catch (renameError) {
                            console.warn(`[PDF to WebP] Could not rename ${path.basename(jpgPath)}, using original name`);
                            imageFiles.push(jpgPath);
                            continue;
                        }
                    }
                    imageFiles.push(webpPath);
                } else {
                    // Convert JPG/PNG to WebP using sharp
                    try {
                        console.log(`[PDF to WebP] Converting ${path.basename(jpgPath)} to WebP...`);
                        await sharp(jpgPath)
                            .webp({ 
                                quality: 90, // High quality WebP
                                effort: 6 // Higher effort for better compression
                            })
                            .toFile(webpPath);
                        
                        // Delete the original JPG/PNG file
                        await fsPromises.unlink(jpgPath);
                        imageFiles.push(webpPath);
                        console.log(`[PDF to WebP] Page ${i} converted successfully: ${webpFilename}`);
                    } catch (convertError) {
                        console.error(`[PDF to WebP] Failed to convert ${path.basename(jpgPath)} to WebP:`, convertError.message);
                        // If conversion fails, keep the original file
                        imageFiles.push(jpgPath);
                    }
                }
            } else {
                // If pageCount was unknown and we can't find a file, we've reached the end
                if (pageCount === null) {
                    break;
                }
                console.error(`[PDF to WebP] Page ${i} conversion failed - file not found`);
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

        const actualPageCount = pageCount || webpFiles.length;
        console.log(`[PDF to WebP] Successfully converted ${webpFiles.length} of ${actualPageCount} pages to WebP`);
        
        if (pageCount !== null && webpFiles.length < pageCount) {
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
