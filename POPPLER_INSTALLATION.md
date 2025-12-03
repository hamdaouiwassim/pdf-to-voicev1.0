# Poppler Installation Guide

This project uses Poppler utilities to convert PDF pages to WebP images for chapters. Poppler provides command-line tools for PDF manipulation.

## Installation

### Windows

1. **Using Chocolatey (Recommended)**
   ```bash
   choco install poppler
   ```

2. **Manual Installation**
   - Download Poppler for Windows from: https://github.com/oschwartz10612/poppler-windows/releases/
   - Extract the archive
   - Add the `bin` directory to your system PATH
   - Restart your terminal/command prompt

### macOS

1. **Using Homebrew (Recommended)**
   ```bash
   brew install poppler
   ```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install poppler-utils
```

### Linux (CentOS/RHEL)

```bash
sudo yum install poppler-utils
```

## Required Tools

The following Poppler tools are used:
- **pdftocairo** (preferred) - Directly converts PDF to WebP
- **pdftoppm** (fallback) - Converts PDF to PNG, then ImageMagick converts to WebP

## ImageMagick (Optional, for fallback)

If `pdftocairo` is not available, the system will fall back to `pdftoppm` + ImageMagick.

### Windows
```bash
choco install imagemagick
```

### macOS
```bash
brew install imagemagick
```

### Linux
```bash
sudo apt-get install imagemagick
```

## Verification

After installation, verify that the tools are available:

```bash
# Check pdftocairo
pdftocairo -v

# Check pdftoppm (if pdftocairo is not available)
pdftoppm -v

# Check ImageMagick (for fallback)
magick -version
```

## Troubleshooting

### "Command not found" errors

- Ensure Poppler is installed and added to your system PATH
- Restart your terminal/IDE after installation
- On Windows, you may need to restart your computer for PATH changes to take effect

### WebP conversion fails

- Ensure you have either `pdftocairo` or both `pdftoppm` and `magick` installed
- Check that the PDF file is not corrupted
- Verify you have write permissions in the output directory

## Notes

- The system will automatically use `pdftocairo` if available (preferred method)
- If `pdftocairo` is not available, it will fall back to `pdftoppm` + ImageMagick
- WebP images are generated at scale 2000 (high quality) as specified
- All WebP images are stored in the chapter's `webp` subdirectory

