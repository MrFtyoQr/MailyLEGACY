"""
Utilities for generating pre-signed upload URLs for Cloudflare R2 / S3.
The client uploads directly to the storage provider; we only store the
resulting URL.  No file bytes ever pass through the Django server.
"""
import uuid
import boto3
from django.conf import settings


def _s3_client():
    return boto3.client(
        's3',
        aws_access_key_id     = settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key = settings.AWS_SECRET_ACCESS_KEY,
        endpoint_url          = settings.AWS_S3_ENDPOINT_URL or None,
        region_name           = getattr(settings, 'AWS_S3_REGION_NAME', 'auto'),
    )


def generate_presigned_upload(patient_id: str, file_name: str,
                               mime_type: str = 'application/octet-stream',
                               expires: int = 300) -> dict:
    """
    Returns a presigned POST URL the client uses to upload directly to R2.

    Response shape:
        {
            'upload_url': str,   # PUT to this URL
            'file_url':   str,   # public/CDN URL to store in MedicalDocument.file_url
            'key':        str,   # S3 object key
        }
    """
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    ext    = file_name.rsplit('.', 1)[-1] if '.' in file_name else 'bin'
    key    = f'patients/{patient_id}/docs/{uuid.uuid4()}.{ext}'

    client = _s3_client()
    presigned = client.generate_presigned_url(
        'put_object',
        Params={'Bucket': bucket, 'Key': key, 'ContentType': mime_type},
        ExpiresIn=expires,
    )

    # Build public URL
    # Si hay un dominio público configurado (r2.dev o custom domain), usarlo.
    # Si no, usar presigned GET URL para acceso privado.
    custom_domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', '')
    if custom_domain:
        file_url = f'https://{custom_domain}/{key}'
    else:
        # Fallback: presigned GET URL válida por 7 días
        get_url = client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=7 * 24 * 3600,
        )
        file_url = get_url

    return {'upload_url': presigned, 'file_url': file_url, 'key': key}
