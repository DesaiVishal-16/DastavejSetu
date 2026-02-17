# OCR Enhancement Documentation

This document describes the enhanced OCR pipeline for improved accuracy on scanned PDFs and images.

## Overview

The hybrid extraction pipeline combines **OCR (Tesseract)** with **AI (Google Gemini)** to provide:

- ✅ **Automatic scanned PDF detection**
- ✅ **Image preprocessing** (deskew, denoise, contrast enhancement)
- ✅ **Table structure detection** using OpenCV
- ✅ **OCR text extraction** with confidence scoring
- ✅ **AI validation and enhancement** of OCR results
- ✅ **Post-processing validation** to detect and fix missing columns/rows
- ✅ **Intelligent merging** of OCR and AI results

## Architecture

```
Document Upload
    ↓
Scanned PDF Detection (PyMuPDF)
    ↓
PDF → Images (pdf2image @ 300 DPI)
    ↓
Image Preprocessing (OpenCV)
    ├── Auto-deskewing
    ├── Denoising
    ├── Contrast enhancement
    └── Adaptive binarization
    ↓
OCR Extraction (Tesseract)
    ├── Text recognition
    ├── Table structure detection
    └── Confidence scoring
    ↓
AI Enhancement (Gemini)
    ├── Text validation
    ├── Error correction
    └── Translation (if needed)
    ↓
Result Merging & Validation
    ├── Merge OCR structure + AI text
    ├── Detect missing columns/rows
    └── Auto-fix inconsistencies
    ↓
Final Structured Output
```

## Configuration

### Environment Variables

Add these to your `.env` file in `api-service/.env`:

```env
# OCR Settings
OCR_DPI=300                          # DPI for PDF conversion (300-600 recommended)
OCR_DESKEW=true                      # Enable automatic deskewing
OCR_DENOISE=true                     # Enable noise removal
OCR_CONTRAST_ENHANCE=true            # Enable contrast enhancement
OCR_LANGUAGE=eng                     # Tesseract language code
OCR_PSM_MODE=6                       # Page segmentation mode
OCR_MIN_CONFIDENCE=60.0              # Minimum OCR confidence threshold
ENABLE_HYBRID_EXTRACTION=true        # Use OCR + Gemini hybrid approach
ENABLE_VALIDATION=true               # Enable post-processing validation
MAX_RETRY_ATTEMPTS=2                 # Number of retry attempts for low confidence
```

### Settings Explained

- **OCR_DPI**: Higher DPI = better accuracy but slower processing. 300 is good for most documents, use 400-600 for very poor quality scans.

- **OCR_DESKEW**: Automatically corrects rotated/scanned documents. Recommended: `true`

- **OCR_DENOISE**: Removes scanning artifacts and noise. Recommended: `true`

- **OCR_CONTRAST_ENHANCE**: Improves text visibility. Recommended: `true`

- **OCR_PSM_MODE**: Tesseract page segmentation mode:
  - `6` = Assume uniform block of text (best for tables)
  - `3` = Fully automatic page segmentation
  - `4` = Assume single column of variable text

## Installation

### Automatic Setup (Recommended)

```bash
cd api-service
chmod +x scripts/setup_ocr.sh
./scripts/setup_ocr.sh
```

### Manual Setup

1. **Install system dependencies:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng poppler-utils

# macOS (using Homebrew)
brew install tesseract poppler

# Windows
# Download and install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki
# Add Tesseract to your PATH
```

2. **Install Python packages:**

```bash
cd api-service
pip install -r requirements.txt
```

3. **Verify installation:**

```bash
python -c "import pytesseract; print(pytesseract.get_tesseract_version())"
```

## Usage

### API Endpoint

The extraction endpoint automatically uses the hybrid pipeline for scanned PDFs:

```bash
POST /api/v1/ai/file-extractor/extract
Content-Type: multipart/form-data

file: <your-scanned-pdf-or-image>
target_language: en
preserve_names: true
```

### Detection Logic

The system automatically detects scanned PDFs and applies OCR when:

1. File is a PDF with very little extractable text (< 100 characters)
2. File is an image (PNG, JPG, etc.)
3. Force OCR is enabled (future feature)

For text-based PDFs and clean images, it uses AI-only extraction for faster processing.

## Performance

### Processing Time

- **Text-based PDFs**: 2-5 seconds (AI-only)
- **Scanned PDFs (1 page)**: 10-20 seconds (hybrid pipeline)
- **Scanned PDFs (multi-page)**: +5-10 seconds per page

### Accuracy Improvements

Based on the existing OCR_COMPARISON.md:

| Method                | Accuracy | Best For                          |
| --------------------- | -------- | --------------------------------- |
| **Hybrid (OCR + AI)** | 96-99%   | Scanned documents, complex tables |
| Gemini AI Only        | 95-98%   | Clean digital documents           |
| Tesseract OCR Only    | 70-85%   | Simple text, budget constraint    |

### Memory Usage

- Base: ~200MB
- With hybrid extraction: +300-500MB per concurrent job
- Recommend: 2GB+ RAM for production use

## Troubleshooting

### Common Issues

**1. "Tesseract not found" error**

```bash
# Solution: Install Tesseract
sudo apt-get install -y tesseract-ocr

# Verify:
tesseract --version
```

**2. "poppler not found" error**

```bash
# Solution: Install Poppler
sudo apt-get install -y poppler-utils
```

**3. Low OCR confidence scores**

- Increase `OCR_DPI` to 400 or 600
- Ensure document is scanned at 300+ DPI originally
- Check if `OCR_DESKEW` and `OCR_DENOISE` are enabled

**4. Missing columns in output**

- The validation service will detect and attempt to fix this automatically
- Check logs for validation warnings
- Increase `OCR_PSM_MODE` to 3 for complex layouts

### Debug Mode

Enable detailed logging:

```python
# In your .env or config
DEBUG=true
LOG_LEVEL=DEBUG
```

This will show:

- OCR confidence scores per page
- Table detection results
- Validation issues found
- Merge decisions between OCR and AI

## Advanced Usage

### Custom Preprocessing

You can customize preprocessing by modifying `preprocessing_service.py`:

```python
# Add custom preprocessing steps
def preprocess_image(self, image: np.ndarray) -> np.ndarray:
    # Your custom logic here
    processed = self._your_custom_step(image)
    return processed
```

### Force OCR Mode

To force OCR on all documents (not just scanned):

```python
# In extraction.py, modify process_extraction:
extraction_result = extraction_service.extract_tables(
    file_path,
    target_language=target_language,
    preserve_names=preserve_names,
    force_ocr=True  # Add this parameter
)
```

### Validation Callback

Add custom validation rules:

```python
# In validation_service.py
def validate_custom_rules(self, table: TableData) -> List[ValidationIssue]:
    # Your custom validation logic
    issues = []
    # ... check your specific requirements
    return issues
```

## Migration Guide

### From AI-Only Extraction

No changes needed! The hybrid pipeline:

1. Automatically detects when OCR is needed
2. Uses AI-only for compatible documents
3. Falls back to AI-only if OCR fails

### Configuration Changes

Old `.env` (still works):

```env
GEMINI_API_KEY=your_key
```

New `.env` (recommended):

```env
GEMINI_API_KEY=your_key
ENABLE_HYBRID_EXTRACTION=true
OCR_DPI=300
OCR_DESKEW=true
OCR_DENOISE=true
```

## Future Enhancements

Planned improvements:

- [ ] Multi-language OCR support (Hindi, Tamil, etc.)
- [ ] Handwritten text recognition
- [ ] GPU acceleration for image preprocessing
- [ ] Parallel page processing for multi-page PDFs
- [ ] Confidence-based retry with different parameters
- [ ] Export to multiple formats (Excel, CSV, JSON)

## Support

For issues or questions:

1. Check the logs in `api-service/api.log`
2. Review validation warnings in the extraction response
3. Enable debug mode for detailed diagnostics

## License

This OCR enhancement uses:

- **Tesseract OCR**: Apache 2.0 License
- **OpenCV**: Apache 2.0 License
- **PyMuPDF**: GNU AGPL v3 (commercial license available)
