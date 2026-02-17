# Tigris S3 Storage Service
import boto3
from botocore.config import Config
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)


class StorageService:
    """S3-compatible storage service using Tigris"""

    def __init__(self):
        settings = get_settings()

        self.endpoint = settings.TIGRIS_ENDPOINT.rstrip("/")
        self.region = settings.TIGRIS_REGION
        self.access_key = settings.TIGRIS_ACCESS_KEY_ID
        self.secret_key = settings.TIGRIS_SECRET_ACCESS_KEY
        self.bucket = settings.TIGRIS_BUCKET

        # Check if endpoint is virtual-hosted-style (bucket in subdomain)
        # e.g., https://bucket.t3.storage.dev/ vs https://t3.storage.dev/
        if f".t3.storage.dev" in self.endpoint or self.bucket in self.endpoint:
            # Virtual-hosted-style: bucket is in subdomain
            # base_url is just the endpoint
            self.base_url = self.endpoint
        else:
            # Path-style: bucket needs to be in path
            self.base_url = f"{self.endpoint}/{self.bucket}"

        # Configure S3 client with timeout
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(
                signature_version="s3v4",
                connect_timeout=60,
                read_timeout=60,
            ),
        )

        # Ensure bucket exists
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
        except Exception as e:
            logger.info(f"Bucket {self.bucket} may not exist or not accessible: {e}")

    def upload_file(self, file_path: str, s3_key: str) -> str:
        """Upload a file to S3 and return the S3 URL"""
        try:
            # Determine content type based on file extension
            ext = file_path.split(".")[-1].lower() if "." in file_path else ""
            content_type_map = {
                "pdf": "application/pdf",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "gif": "image/gif",
                "webp": "image/webp",
                "tiff": "image/tiff",
                "tif": "image/tiff",
                "bmp": "image/bmp",
            }
            content_type = content_type_map.get(ext, "application/octet-stream")

            self.s3_client.upload_file(
                file_path,
                self.bucket,
                s3_key,
                ExtraArgs={"ContentType": content_type},
            )
            # Use base_url which handles bucket in endpoint correctly
            s3_url = f"{self.base_url}/{s3_key}"
            logger.info(f"Uploaded file to S3: {s3_url}")
            return s3_url
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}")
            raise

    def upload_json(self, data: dict, s3_key: str) -> str:
        """Upload JSON data to S3"""
        try:
            import json

            json_str = json.dumps(data, indent=2)

            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=json_str.encode("utf-8"),
                ContentType="application/json",
            )

            s3_url = f"{self.base_url}/{s3_key}"
            logger.info(f"Uploaded JSON to S3: {s3_url}")
            return s3_url
        except Exception as e:
            logger.error(f"Failed to upload JSON to S3: {e}")
            raise

    def download_json(self, s3_key: str) -> dict:
        """Download JSON data from S3"""
        try:
            import json

            response = self.s3_client.get_object(Bucket=self.bucket, Key=s3_key)
            json_str = response["Body"].read().decode("utf-8")
            return json.loads(json_str)
        except Exception as e:
            logger.error(f"Failed to download JSON from S3: {e}")
            raise

    def file_exists(self, s3_key: str) -> bool:
        """Check if file exists in S3"""
        try:
            self.s3_client.head_object(Bucket=self.bucket, Key=s3_key)
            return True
        except:
            return False

    def delete_file(self, s3_key: str) -> bool:
        """Delete a file from S3"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=s3_key)
            logger.info(f"Deleted file from S3: {s3_key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from S3: {e}")
            return False

    def download_file(self, s3_key: str, local_path: str) -> str:
        """Download a file from S3 to local path"""
        try:
            # Ensure directory exists
            import os

            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            self.s3_client.download_file(self.bucket, s3_key, local_path)
            logger.info(f"Downloaded file from S3: {s3_key} to {local_path}")
            return local_path
        except Exception as e:
            logger.error(f"Failed to download file from S3: {e}")
            raise

    def get_signed_url(
        self, s3_key: str, expiration: int = 3600, inline: bool = True
    ) -> str:
        """Get a signed URL for downloading or viewing a file"""
        try:
            # Get content type based on file extension
            ext = s3_key.split(".")[-1].lower() if "." in s3_key else ""
            content_type_map = {
                "pdf": "application/pdf",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "gif": "image/gif",
                "webp": "image/webp",
                "tiff": "image/tiff",
                "bmp": "image/bmp",
            }
            content_type = content_type_map.get(ext, "application/octet-stream")

            params = {"Bucket": self.bucket, "Key": s3_key}
            if inline:
                params["ResponseContentDisposition"] = "inline"
            params["ResponseContentType"] = content_type

            signed_url = self.s3_client.generate_presigned_url(
                "get_object",
                Params=params,
                ExpiresIn=expiration,
            )
            return signed_url
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}")
            raise


# Singleton instance
_storage_service: StorageService | None = None


def get_storage_service() -> StorageService:
    """Get or create storage service singleton"""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
