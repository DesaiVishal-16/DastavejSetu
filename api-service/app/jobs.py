# Async job storage
import uuid
import time
import json
import os
from pathlib import Path
from enum import Enum
from typing import Optional, Dict
from pydantic import BaseModel


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ExtractionJob(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.PENDING
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: float = 0
    original_file_url: Optional[str] = None
    file_name: Optional[str] = None


# File-based job storage for persistence across restarts
JOBS_DIR = Path("data/jobs")
JOBS_DIR.mkdir(parents=True, exist_ok=True)


def _get_job_file(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def _save_job_to_file(job: ExtractionJob):
    """Save job to file for persistence"""
    job_file = _get_job_file(job.job_id)
    with open(job_file, "w") as f:
        json.dump(job.model_dump(), f)


def _load_job_from_file(job_id: str) -> Optional[ExtractionJob]:
    """Load job from file"""
    job_file = _get_job_file(job_id)
    if job_file.exists():
        try:
            with open(job_file, "r") as f:
                data = json.load(f)
                return ExtractionJob(**data)
        except Exception:
            return None
    return None


def create_job() -> str:
    job_id = str(uuid.uuid4())
    job = ExtractionJob(job_id=job_id, created_at=time.time())
    _save_job_to_file(job)
    return job_id


def get_job(job_id: str) -> Optional[ExtractionJob]:
    # First check memory cache (for performance)
    if job_id in _jobs:
        return _jobs[job_id]
    # Then check file storage
    job = _load_job_from_file(job_id)
    if job:
        _jobs[job_id] = job  # Cache in memory
        return job
    return None


def update_job_status(
    job_id: str,
    status: JobStatus,
    result: Optional[dict] = None,
    error: Optional[str] = None,
):
    job = get_job(job_id)
    if job:
        job.status = status
        job.result = result
        job.error = error
        _jobs[job_id] = job
        _save_job_to_file(job)


def update_job_file_info(job_id: str, original_file_url: str, file_name: str):
    """Update job with original file info"""
    job = get_job(job_id)
    if job:
        job.original_file_url = original_file_url
        job.file_name = file_name
        _jobs[job_id] = job
        _save_job_to_file(job)


# In-memory cache (for performance, backed by file storage)
_jobs: Dict[str, ExtractionJob] = {}
