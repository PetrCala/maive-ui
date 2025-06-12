import os
import boto3
from botocore.exceptions import ClientError
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


class S3Client:
    def __init__(self):
        self.s3_client = boto3.client(
            "s3",
            # aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            # aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION"),
        )
        self.bucket_name = os.getenv("AWS_BUCKET_NAME")

    def upload_file(self, file: FileStorage, folder: str = "uploads") -> dict:
        """
        Upload a file to S3 bucket

        Args:
            file: FileStorage object from Flask
            folder: Target folder in S3 bucket

        Returns:
            dict: Contains success status and file URL or error message
        """
        try:
            filename = secure_filename(file.filename)
            s3_key = f"{folder}/{filename}"

            self.s3_client.upload_fileobj(
                file,
                self.bucket_name,
                s3_key,
                ExtraArgs={"ContentType": file.content_type},
            )

            url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
            return {"success": True, "url": url, "key": s3_key}

        except ClientError as e:
            return {"success": False, "error": str(e)}
