from ai_translation.domain.document import DOCXHandler, PDFHandler

# Documents are processed in chunks the small model can read at once, and
# only the first few chunks are used so a request finishes in reasonable time.
CHUNK_CHARS = 4000
MAX_CHUNKS = 12


async def extract_plain_text(file_content: bytes, document_type: str) -> list[str]:
    """Return the document's paragraphs (DOCX) or lines (PDF), in order."""
    handler = PDFHandler() if document_type == "pdf" else DOCXHandler()
    segments = await handler.extract_text(file_content)
    return [" ".join(texts) for texts in segments.values() if texts]


def chunk_paragraphs(paragraphs: list[str]) -> tuple[list[str], bool]:
    """
    Group paragraphs into chunks of about CHUNK_CHARS characters.

    Returns the chunks and whether the document was cut at MAX_CHUNKS.
    """
    chunks: list[str] = []
    current: list[str] = []
    size = 0

    for paragraph in paragraphs:
        # A single very long paragraph is split on its own.
        pieces = [paragraph[i:i + CHUNK_CHARS] for i in range(0, len(paragraph), CHUNK_CHARS)]
        for piece in pieces:
            if current and size + len(piece) > CHUNK_CHARS:
                chunks.append("\n".join(current))
                current, size = [], 0
            current.append(piece)
            size += len(piece) + 1

    if current:
        chunks.append("\n".join(current))

    return chunks[:MAX_CHUNKS], len(chunks) > MAX_CHUNKS
