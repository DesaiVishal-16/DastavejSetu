"""
OCR Preprocessing Service for PDF and image processing
Converts PDFs to images and preprocesses them for better extraction accuracy
"""

import io
import base64
import logging
from pathlib import Path
from typing import List, Optional

import numpy as np
from PIL import Image

try:
    from pdf2image import convert_from_path

    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    logging.warning("pdf2image not available. PDF processing will be limited.")

CV2_AVAILABLE = False
try:
    import cv2

    CV2_AVAILABLE = True
except (ImportError, AttributeError) as e:
    logging.warning(f"OpenCV not available. Image preprocessing disabled. Error: {e}")

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class OCRPreprocessingService:
    """Service for preprocessing documents before AI extraction"""

    def __init__(self):
        self.settings = get_settings()
        self.dpi = getattr(self.settings, "OCR_DPI", 300)
        self.enable_deskew = getattr(self.settings, "OCR_DESKEW", True)
        self.enable_denoise = getattr(self.settings, "OCR_DENOISE", True)
        self.enable_contrast = getattr(self.settings, "OCR_CONTRAST_ENHANCE", True)

    def is_pdf(self, file_path: str) -> bool:
        """Check if file is a PDF"""
        return Path(file_path).suffix.lower() == ".pdf"

    def convert_pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        """
        Convert PDF to list of PIL Images at 300 DPI

        Args:
            pdf_path: Path to PDF file

        Returns:
            List of PIL Images (one per page)
        """
        if not PDF2IMAGE_AVAILABLE:
            raise ImportError(
                "pdf2image is required for PDF processing. "
                "Install it with: pip install pdf2image"
            )

        logger.info(f"Converting PDF to images at {self.dpi} DPI: {pdf_path}")

        try:
            images = convert_from_path(
                pdf_path,
                dpi=self.dpi,
                fmt="png",
                transparent=False,
            )
            logger.info(f"Converted PDF to {len(images)} images")
            return images
        except Exception as e:
            logger.error(f"Failed to convert PDF to images: {e}")
            raise

    def preprocess_image(self, image: Image.Image) -> Image.Image:
        """
        Apply preprocessing to image for better OCR accuracy

        Args:
            image: PIL Image

        Returns:
            Preprocessed PIL Image
        """
        if not CV2_AVAILABLE:
            logger.warning("OpenCV not available, skipping preprocessing")
            return image

        # Convert PIL to OpenCV format (numpy array)
        img_array = np.array(image)

        # Convert RGB to BGR for OpenCV
        if len(img_array.shape) == 3:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        # Apply preprocessing steps
        if self.enable_deskew:
            img_array = self._deskew_image(img_array)

        if self.enable_denoise:
            img_array = self._denoise_image(img_array)

        if self.enable_contrast:
            img_array = self._enhance_contrast(img_array)

        # Convert back to RGB for PIL
        if len(img_array.shape) == 3:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)

        return Image.fromarray(img_array)

    def _deskew_image(self, image: np.ndarray) -> np.ndarray:
        """Automatically deskew (straighten) an image"""
        try:
            # Convert to grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image

            # Invert and threshold
            gray = cv2.bitwise_not(gray)
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

            # Get coordinates of non-zero pixels
            coords = np.column_stack(np.where(thresh > 0))

            if len(coords) == 0:
                return image

            # Calculate angle
            angle = cv2.minAreaRect(coords)[-1]

            # Adjust angle
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle

            # Only rotate if angle is significant
            if abs(angle) < 0.5:
                return image

            # Rotate image
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
            )

            logger.debug(f"Deskewed image by {angle:.2f} degrees")
            return rotated
        except Exception as e:
            logger.warning(f"Deskewing failed: {e}")
            return image

    def _denoise_image(self, image: np.ndarray) -> np.ndarray:
        """Remove noise from image"""
        try:
            # Use non-local means denoising
            if len(image.shape) == 3:
                denoised = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
            else:
                denoised = cv2.fastNlMeansDenoising(image, None, 10, 7, 21)
            return denoised
        except Exception as e:
            logger.warning(f"Denoising failed: {e}")
            return image

    def _enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """Enhance image contrast using CLAHE"""
        try:
            # Convert to LAB color space
            if len(image.shape) == 3:
                lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)

                # Apply CLAHE to L channel
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                l = clahe.apply(l)

                # Merge channels back
                enhanced = cv2.merge([l, a, b])
                enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
            else:
                # Grayscale
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(image)

            return enhanced
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {e}")
            return image

    def process_file(self, file_path: str) -> List[str]:
        """
        Process a file (PDF or image) and return list of base64 encoded images

        Args:
            file_path: Path to file (PDF or image)

        Returns:
            List of base64 encoded image strings
        """
        base64_images = []

        if self.is_pdf(file_path):
            # Convert PDF to images
            images = self.convert_pdf_to_images(file_path)

            for i, image in enumerate(images):
                # Preprocess each page
                processed_image = self.preprocess_image(image)

                # Convert to base64
                buffered = io.BytesIO()
                processed_image.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue()).decode()
                base64_images.append(img_str)

                logger.debug(f"Processed PDF page {i + 1}/{len(images)}")
        else:
            # Process single image
            image = Image.open(file_path)
            processed_image = self.preprocess_image(image)

            # Convert to base64
            buffered = io.BytesIO()
            processed_image.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            base64_images.append(img_str)

        return base64_images

    def get_mime_type(self) -> str:
        """Get MIME type for processed images"""
        return "image/png"


# Singleton instance
_ocr_service: Optional[OCRPreprocessingService] = None


def get_ocr_preprocessing_service() -> OCRPreprocessingService:
    """Get or create OCR preprocessing service singleton"""
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OCRPreprocessingService()
    return _ocr_service
