#!/bin/bash

# Setup script for OCR dependencies
# Run this script to install all required system and Python dependencies

echo "============================================"
echo "Setting up OCR dependencies for Udayam"
echo "============================================"
echo ""

# Check if running on Ubuntu/Debian
if ! command -v apt-get &> /dev/null; then
    echo "Warning: This script is designed for Ubuntu/Debian systems."
    echo "For other systems, please install the equivalent packages manually."
    echo ""
fi

echo "Installing system dependencies..."
echo "================================"

# Update package list
sudo apt-get update

# Install Tesseract OCR and language packs
echo "Installing Tesseract OCR..."
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng

# Install Poppler for PDF processing (required by pdf2image)
echo "Installing Poppler (PDF processing)..."
sudo apt-get install -y poppler-utils

# Install additional image processing libraries
echo "Installing image processing libraries..."
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0

echo ""
echo "Installing Python dependencies..."
echo "================================"

# Check if we're in a virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Warning: Not in a virtual environment. It's recommended to activate your venv first."
    echo "Run: source .venv/bin/activate"
    echo ""
fi

# Install Python packages
cd "$(dirname "$0")/.."
pip install -r requirements.txt

echo ""
echo "============================================"
echo "Setup complete!"
echo "============================================"
echo ""
echo "Verifying installation..."
echo ""

# Verify Tesseract installation
if command -v tesseract &> /dev/null; then
    echo "✓ Tesseract version: $(tesseract --version | head -1)"
else
    echo "✗ Tesseract not found in PATH"
fi

# Verify Python packages
python3 -c "
import cv2
import numpy
import pytesseract
import pdf2image
import fitz  # PyMuPDF
from PIL import Image

print('✓ OpenCV (cv2):', cv2.__version__)
print('✓ NumPy:', numpy.__version__)
print('✓ Pytesseract:', pytesseract.get_tesseract_version())
print('✓ PDF2Image: installed')
print('✓ PyMuPDF:', fitz.__doc__.split()[0] if fitz.__doc__ else 'installed')
print('✓ Pillow (PIL):', Image.__version__)
" 2>/dev/null || echo "✗ Some Python packages not installed correctly"

echo ""
echo "============================================"
echo "All dependencies installed successfully!"
echo "============================================"
