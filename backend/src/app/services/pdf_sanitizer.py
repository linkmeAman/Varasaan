from __future__ import annotations

import re

PDF_METADATA_LITERAL_PATTERNS = tuple(
    re.compile(pattern, re.DOTALL)
    for pattern in (
        rb"(/Title\s*\()(?P<value>.*?)(\))",
        rb"(/Author\s*\()(?P<value>.*?)(\))",
        rb"(/Subject\s*\()(?P<value>.*?)(\))",
        rb"(/Keywords\s*\()(?P<value>.*?)(\))",
        rb"(/Creator\s*\()(?P<value>.*?)(\))",
        rb"(/Producer\s*\()(?P<value>.*?)(\))",
        rb"(/CreationDate\s*\()(?P<value>.*?)(\))",
        rb"(/ModDate\s*\()(?P<value>.*?)(\))",
    )
)

PDF_METADATA_HEX_PATTERNS = tuple(
    re.compile(pattern, re.DOTALL)
    for pattern in (
        rb"(/Title\s*<)(?P<value>.*?)(>)",
        rb"(/Author\s*<)(?P<value>.*?)(>)",
        rb"(/Subject\s*<)(?P<value>.*?)(>)",
        rb"(/Keywords\s*<)(?P<value>.*?)(>)",
        rb"(/Creator\s*<)(?P<value>.*?)(>)",
        rb"(/Producer\s*<)(?P<value>.*?)(>)",
        rb"(/CreationDate\s*<)(?P<value>.*?)(>)",
        rb"(/ModDate\s*<)(?P<value>.*?)(>)",
    )
)

PDF_XMP_PATTERNS = tuple(
    re.compile(pattern, re.DOTALL | re.IGNORECASE)
    for pattern in (
        rb"(<dc:title[^>]*>)(?P<value>.*?)(</dc:title>)",
        rb"(<dc:creator[^>]*>)(?P<value>.*?)(</dc:creator>)",
        rb"(<dc:description[^>]*>)(?P<value>.*?)(</dc:description>)",
        rb"(<pdf:keywords[^>]*>)(?P<value>.*?)(</pdf:keywords>)",
        rb"(<xmp:creatortool[^>]*>)(?P<value>.*?)(</xmp:creatortool>)",
        rb"(<xmp:modifydate[^>]*>)(?P<value>.*?)(</xmp:modifydate>)",
        rb"(<xmp:createdate[^>]*>)(?P<value>.*?)(</xmp:createdate>)",
        rb"(<pdf:producer[^>]*>)(?P<value>.*?)(</pdf:producer>)",
    )
)


def _blank(value: bytes) -> bytes:
    return b" " * len(value)


def _apply_patterns(payload: bytes, patterns: tuple[re.Pattern[bytes], ...]) -> tuple[bytes, bool]:
    updated = payload
    stripped = False

    for pattern in patterns:
        def _replace(match: re.Match[bytes]) -> bytes:
            nonlocal stripped
            stripped = True
            return match.group(0).replace(match.group("value"), _blank(match.group("value")), 1)

        updated = pattern.sub(_replace, updated)

    return updated, stripped


def sanitize_pdf_metadata(payload: bytes) -> tuple[bytes, bool]:
    if not payload.lstrip().startswith(b"%PDF-"):
        return payload, False

    sanitized = payload
    stripped_any = False
    for patterns in (PDF_METADATA_LITERAL_PATTERNS, PDF_METADATA_HEX_PATTERNS, PDF_XMP_PATTERNS):
        sanitized, stripped = _apply_patterns(sanitized, patterns)
        stripped_any = stripped_any or stripped

    return sanitized, stripped_any
