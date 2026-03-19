import io


def parse_document(file_data: bytes, file_type: str) -> list[dict]:
    """Parse a document and return a list of text chunks.

    Args:
        file_data: Raw bytes of the uploaded file.
        file_type: One of "pdf", "pptx", or "docx".

    Returns:
        List of chunk dicts with keys:
            chunk_index, content, heading, chunk_type
    """
    parsers = {
        "pdf": _parse_pdf,
        "pptx": _parse_pptx,
        "docx": _parse_docx,
    }
    parser = parsers.get(file_type)
    if parser is None:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser(file_data)


def _parse_pdf(file_data: bytes) -> list[dict]:
    from PyPDF2 import PdfReader

    reader = PdfReader(io.BytesIO(file_data))
    chunks: list[dict] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            chunks.append(
                {
                    "chunk_index": i,
                    "content": text,
                    "heading": f"Page {i + 1}",
                    "chunk_type": "page",
                }
            )
    return chunks


def _parse_pptx(file_data: bytes) -> list[dict]:
    from pptx import Presentation

    prs = Presentation(io.BytesIO(file_data))
    chunks: list[dict] = []
    for i, slide in enumerate(prs.slides):
        texts: list[str] = []
        heading: str | None = None
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    para_text = paragraph.text.strip()
                    if para_text:
                        if heading is None:
                            heading = para_text
                        texts.append(para_text)
        content = "\n".join(texts)
        if content.strip():
            chunks.append(
                {
                    "chunk_index": i,
                    "content": content,
                    "heading": heading,
                    "chunk_type": "slide",
                }
            )
    return chunks


def _parse_docx(file_data: bytes) -> list[dict]:
    from docx import Document

    doc = Document(io.BytesIO(file_data))
    chunks: list[dict] = []
    current_heading: str | None = None
    current_texts: list[str] = []
    chunk_index = 0

    def _flush() -> None:
        nonlocal chunk_index, current_heading, current_texts
        content = "\n".join(current_texts).strip()
        if content:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "content": content,
                    "heading": current_heading,
                    "chunk_type": "section",
                }
            )
            chunk_index += 1
        current_heading = None
        current_texts = []

    for paragraph in doc.paragraphs:
        if paragraph.style and paragraph.style.name.startswith("Heading"):
            _flush()
            current_heading = paragraph.text.strip() or None
        else:
            text = paragraph.text.strip()
            if text:
                current_texts.append(text)

    _flush()
    return chunks
