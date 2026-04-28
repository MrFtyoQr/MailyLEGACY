"""
MailySoft webhook signature verification.

MailySoft signs every request with HMAC-SHA256 using the shared secret
MAILYSOFT_WEBHOOK_SECRET.  The signature is sent in the header:
  X-MailySoft-Signature: sha256=<hex-digest>

Verification follows the same pattern as the Stripe webhook handler.
"""
import hashlib
import hmac
from django.conf import settings


class WebhookSignatureError(Exception):
    pass


def verify_mailysoft_signature(body: bytes, header: str) -> None:
    """
    Raises WebhookSignatureError if the signature does not match.
    Call this before processing any webhook payload.

    Args:
        body:   Raw request body bytes.
        header: Value of the X-MailySoft-Signature header.
    """
    secret = getattr(settings, 'MAILYSOFT_WEBHOOK_SECRET', '')
    if not secret:
        # Secret not configured — allow in development, reject in production
        import os
        if os.environ.get('DJANGO_ENV', 'development') != 'development':
            raise WebhookSignatureError(
                'MAILYSOFT_WEBHOOK_SECRET is not configured.'
            )
        return  # dev mode: skip verification

    if not header:
        raise WebhookSignatureError('Missing X-MailySoft-Signature header.')

    # Expected format: "sha256=<hex>"
    try:
        scheme, provided_sig = header.split('=', 1)
    except ValueError:
        raise WebhookSignatureError('Malformed X-MailySoft-Signature header.')

    if scheme != 'sha256':
        raise WebhookSignatureError(f'Unsupported signature scheme: {scheme}')

    expected_sig = hmac.new(
        secret.encode('utf-8'), body, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, provided_sig):
        raise WebhookSignatureError('Signature mismatch — payload may have been tampered.')
