# API endpoint for file extraction
import shutil
import uuid
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, Form, HTTPException

logger = logging.getLogger(__name__)

from app.core.config import get_settings
from app.models.schemas import ExtractionResult
from app.services.gemini_service import get_gemini_service
from app.services.validation_service import get_validation_service
from app.utils.helpers import ensure_directories
from app.jobs import create_job, get_job, JobStatus


router = APIRouter()


@router.post("/extract", response_model=ExtractionResult)
async def extract_tables_from_file(
    file: UploadFile = File(...),
    target_language: Optional[str] = Form("en"),
    preserve_names: Optional[bool] = Form(True),
):
    """
    Extract tables from uploaded file (PDF, image, etc.)
    Processes synchronously and returns extraction result directly.
    No S3 operations - file is processed in memory only.
    """
    settings = get_settings()
    job_id = create_job()

    # Validate file extension
    file_ext = Path(file.filename).suffix.lower().lstrip(".")
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}",
        )

    # Ensure directories exist
    ensure_directories()

    # Generate unique filename
    file_id = str(uuid.uuid4())
    input_filename = f"{file_id}_{file.filename}"
    input_path = Path(settings.UPLOAD_DIR) / input_filename

    try:
        # Save uploaded file locally
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Check file size
        file_size = input_path.stat().st_size

        if file_size > settings.MAX_FILE_SIZE:
            input_path.unlink()
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_FILE_SIZE / (1024 * 1024):.1f}MB",
            )

        logger.info(
            f"Starting extraction for job {job_id}. File: {file.filename}, "
            f"Size: {file_size / (1024 * 1024):.1f}MB"
        )

        # Extract using Gemini AI
        gemini_service = get_gemini_service()
        extraction_result = gemini_service.extract_tables(
            str(input_path),
            target_language=target_language or "en",
            preserve_names=preserve_names if preserve_names is not None else True,
        )

        logger.info(
            f"Extraction completed for job {job_id} - Found {len(extraction_result.tables)} tables"
        )

        # Validate results if enabled
        if settings.ENABLE_VALIDATION and extraction_result.tables:
            validation_service = get_validation_service()
            validation = validation_service.validate_extraction(extraction_result)

            if not validation.is_valid:
                logger.warning(
                    f"Validation found {len(validation.issues)} issues for job {job_id}"
                )
                # Fix issues if possible
                fixed_tables = []
                for i, table in enumerate(extraction_result.tables):
                    table_issues = [
                        issue for issue in validation.issues if issue.table_index == i
                    ]
                    if table_issues:
                        fixed_table = validation_service.fix_table_issues(
                            table, table_issues
                        )
                        fixed_tables.append(fixed_table)
                    else:
                        fixed_tables.append(table)
                extraction_result.tables = fixed_tables

        # Clean up temp file
        if input_path.exists():
            input_path.unlink()

        logger.info(f"Job {job_id} completed successfully")

        # Return extraction result directly (no job_id, no S3)
        return extraction_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction failed for job {job_id}: {e}", exc_info=True)
        if input_path.exists():
            input_path.unlink()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.get("/status/{job_id}")
async def get_extraction_status(job_id: str):
    """
    Get extraction job status.
    Note: With synchronous processing, jobs complete immediately.
    This endpoint is kept for backward compatibility.
    """
    try:
        job = get_job(job_id)

        if not job:
            # For backward compatibility, return not found
            raise HTTPException(status_code=404, detail="Job not found")

        response = {
            "job_id": job.job_id,
            "status": job.status.value,
        }

        if job.status == JobStatus.COMPLETED and job.result:
            response["data"] = job.result

        if job.status == JobStatus.FAILED:
            response["error"] = job.error

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status for {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "udayam-ai-file-extractor"}


@router.get("/job/{job_id}")
async def get_job_by_id(job_id: str):
    """Get job by ID - mirrors frontend's expected endpoint"""
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": job.job_id,
        "fileName": job.file_name or "Uploaded File",
        "fileUrl": job.original_file_url or "",
        "status": job.status.value,
        "createdAt": job.created_at,
        "updatedAt": job.created_at,
        "error": job.error,
        "result": job.result,
    }


@router.get("/jobs")
async def get_jobs(limit: int = 10):
    """Get list of jobs"""
    from app.jobs import _jobs

    job_list = list(_jobs.values())[-limit:] if _jobs else []

    return {
        "jobs": [
            {
                "id": job.job_id,
                "fileName": "Uploaded File",
                "fileUrl": "",
                "status": job.status.value,
                "createdAt": job.created_at,
                "updatedAt": job.created_at,
                "error": job.error,
                "result": job.result,
            }
            for job in job_list
        ],
        "stats": {
            "totalDocuments": len(_jobs) if _jobs else 0,
            "processedThisMonth": len(
                [j for j in _jobs.values() if j.status == JobStatus.COMPLETED]
            )
            if _jobs
            else 0,
            "successRate": 100.0 if _jobs else 0.0,
            "processingTime": "N/A",
        },
    }


@router.get("/stats")
async def get_stats():
    """Get extraction stats"""
    from app.jobs import _jobs

    total = len(_jobs) if _jobs else 0
    completed = (
        len([j for j in _jobs.values() if j.status == JobStatus.COMPLETED])
        if _jobs
        else 0
    )

    return {
        "documentsProcessed": completed,
        "documentsLimit": 100,
        "storageUsed": 0,
        "storageLimit": 1000,
        "apiCalls": total,
        "apiCallsLimit": 1000,
    }


@router.get("/usage")
async def get_usage():
    """Get usage stats"""
    from app.jobs import _jobs

    total = len(_jobs) if _jobs else 0
    completed = (
        len([j for j in _jobs.values() if j.status == JobStatus.COMPLETED])
        if _jobs
        else 0
    )

    return {
        "documentsProcessed": completed,
        "documentsLimit": 100,
        "storageUsed": 0,
        "storageLimit": 1000,
        "apiCalls": total,
        "apiCallsLimit": 1000,
    }


@router.get("/debug/pdf-test")
async def debug_pdf_test():
    """Debug endpoint to test PDF processing capabilities"""
    import subprocess
    import sys

    results = {
        "poppler": {"available": False, "version": None},
        "pdf2image": {"available": False, "version": None},
        "opencv": {"available": False, "version": None},
        "pillow": {"available": False, "version": None},
    }

    # Check poppler
    try:
        result = subprocess.run(
            ["pdftoppm", "-v"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            results["poppler"]["available"] = True
            results["poppler"]["version"] = result.stdout.strip()
    except Exception as e:
        results["poppler"]["error"] = str(e)

    # Check pdf2image
    try:
        import pdf2image

        results["pdf2image"]["available"] = True
        results["pdf2image"]["version"] = getattr(pdf2image, "__version__", "unknown")
    except ImportError as e:
        results["pdf2image"]["error"] = str(e)

    # Check opencv
    try:
        import cv2

        results["opencv"]["available"] = True
        results["opencv"]["version"] = getattr(cv2, "__version__", "unknown")
    except ImportError as e:
        results["opencv"]["error"] = str(e)

    # Check pillow
    try:
        import PIL

        results["pillow"]["available"] = True
        results["pillow"]["version"] = PIL.__version__
    except ImportError as e:
        results["pillow"]["error"] = str(e)

    return results
