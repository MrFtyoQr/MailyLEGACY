"""
SanitizedOutputMixin — DRF serializer mixin.

Strips dangerous control characters from all string fields in the
serializer output (JSON response). Does NOT use bleach here — output
is JSON, not HTML. Cleans:
  - Null bytes (\\x00)
  - C0/C1 control characters except tab (\\x09), newline (\\x0a), CR (\\x0d)

Usage:
    from core.serializers.sanitize import SanitizedOutputMixin

    class MySerializer(SanitizedOutputMixin, serializers.ModelSerializer):
        ...

MRO note: place SanitizedOutputMixin BEFORE serializers.ModelSerializer
so to_representation is resolved correctly via MRO.
"""
import re

# Characters to strip: control chars except \\t, \\n, \\r
_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


def _clean(value: str) -> str:
    return _CONTROL_CHARS.sub('', value)


class SanitizedOutputMixin:
    """Strip dangerous control characters from serializer output."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _sanitize(data)


def _sanitize(data):
    if isinstance(data, dict):
        return {k: _sanitize(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_sanitize(item) for item in data]
    if isinstance(data, str):
        return _clean(data)
    return data
