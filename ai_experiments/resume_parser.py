import os
import fitz  # PyMuPDF
import re

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF file."""
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return text

def extract_text_from_docx(docx_path: str) -> str:
    """Extract all text from a DOCX file."""
    text = ""
    try:
        import docx
        doc = docx.Document(docx_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except ImportError:
        print(f"Error: python-docx is not installed. Run 'pip install python-docx' to support .docx files.")
    except Exception as e:
        print(f"Error reading {docx_path}: {e}")
    return text

def chunk_resume_text(text: str) -> dict:
    """
    Very basic heuristic to chunk a resume into sections.
    In a real system, this would be done by a robust NLP parser or LLM.
    """
    sections = {
        "Summary": "",
        "Experience": "",
        "Education": "",
        "Skills": "",
        "Projects": "",
        "Other": ""
    }
    
    current_section = "Summary"
    
    # Common section headers
    section_headers = {
        "experience": ["experience", "work history", "employment", "professional experience"],
        "education": ["education", "academic background", "qualifications"],
        "skills": ["skills", "technologies", "technical skills", "core competencies"],
        "projects": ["projects", "personal projects", "academic projects"]
    }
    
    lines = text.split('\n')
    for line in lines:
        cleaned_line = line.strip().lower()
        
        # Check if line looks like a header (short, capitalized or matches keywords)
        if len(cleaned_line) > 0 and len(cleaned_line) < 40:
            found_header = False
            for section_key, keywords in section_headers.items():
                if any(keyword in cleaned_line for keyword in keywords):
                    current_section = section_key.capitalize()
                    found_header = True
                    break
            
            if found_header:
                continue # Skip adding the header itself to the section content
                
        # Append line to current section
        if line.strip():
            sections[current_section] += line.strip() + "\n"
            
    # Filter out empty sections
    return {k: v.strip() for k, v in sections.items() if v.strip()}

def load_resumes(directory: str) -> list[dict]:
    """Loads all PDF and DOCX resumes from a directory and parses them."""
    resumes = []
    if not os.path.exists(directory):
        print(f"Directory not found: {directory}")
        return resumes
        
    for filename in os.listdir(directory):
        lower_filename = filename.lower()
        if lower_filename.endswith('.pdf') or lower_filename.endswith('.docx'):
            path = os.path.join(directory, filename)
            
            if lower_filename.endswith('.pdf'):
                text = extract_text_from_pdf(path)
            elif lower_filename.endswith('.docx'):
                text = extract_text_from_docx(path)
                
            chunks = chunk_resume_text(text)
            resumes.append({
                "id": filename,
                "name": os.path.splitext(filename)[0],
                "full_text": text,
                "chunks": chunks
            })
            
    return resumes
