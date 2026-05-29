import fitz  # PyMuPDF
import docx
import re
from typing import Dict, Any, List
from app.services.parser import ResumeParser

class JDParser:
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        text = ""
        with fitz.open(file_path) as doc:
            for page in doc:
                blocks = page.get_text("blocks")
                blocks.sort(key=lambda b: (b[1], b[0]))
                for b in blocks:
                    if b[6] == 0: # text block
                        text += b[4] + "\n"
        return text

    @staticmethod
    def extract_text_from_docx(file_path: str) -> str:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])

    @staticmethod
    def parse_jd(file_path: str) -> Dict[str, Any]:
        if file_path.endswith(".pdf"):
            text = JDParser.extract_text_from_pdf(file_path)
        elif file_path.endswith(".docx"):
            text = JDParser.extract_text_from_docx(file_path)
        elif file_path.endswith(".txt"):
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            raise ValueError("Unsupported file format")
            
        # Sanitize text
        text = text.replace('\x00', ' ')

        # Basic Title Extraction
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        title = ""
        for i, line in enumerate(lines):
            title_match = re.match(r'(?i)^(?:job\s*)?title:\s*(.*)$', line)
            if title_match:
                if title_match.group(1).strip():
                    title = title_match.group(1).strip()
                elif i + 1 < len(lines):
                    title = lines[i + 1]
                break
                
        if not title and lines:
            title = lines[0]
            
        if len(title) > 100:  # Unlikely to be a title if very long
            title = "Parsed Job Role"

        # Skills extraction
        found_skills = set()
        
        # 1. Keyword-based lookup (aliases & common list)
        for alias, normalized in ResumeParser.SKILL_ALIASES.items():
            if re.search(rf'\b{re.escape(alias)}\b', text, re.IGNORECASE):
                found_skills.add(normalized)
                
        for skill in ResumeParser.COMMON_SKILLS:
            if re.search(rf'\b{re.escape(skill)}\b', text, re.IGNORECASE):
                found_skills.add(skill)

        # 2. Section-based lookup (parses everything listed under Skills section)
        skills_match = re.search(r'(?i)(?:required\s+skills|\bskills\b):?(.*?)(?=\n\s*(?:experience|education|responsibilities|requirements|preferred\s+skills|about the role|description)\b:?|$)', text, re.DOTALL)
        if skills_match:
            skills_text = skills_match.group(1).strip()
            
            # Standardize bullet markers and separators
            bullets_replaced = re.sub(r'[\u2022\u25e6\u25aa\u25ab\u2043\xb7\-\*]', '\n', skills_text)
            raw_parts = re.split(r'[\n,;\t]', bullets_replaced)
            
            for part in raw_parts:
                part = part.strip()
                # Remove leading numbers like '1.', '2)', etc.
                part = re.sub(r'^(?:\d+[\.\)]\s*)+', '', part)
                part = part.strip(' .•-*')
                
                # Filter out long sentences, empty values, and trailing/leading "and"
                if part and len(part) < 60:
                    part = re.sub(r'(?i)^and\s+', '', part).strip()
                    part = re.sub(r'(?i)\s+and$', '', part).strip()
                    if part:
                        # Check for matching standard name in COMMON_SKILLS first to avoid duplicates
                        matched_std = False
                        for cs in ResumeParser.COMMON_SKILLS:
                            if cs.lower() == part.lower():
                                found_skills.add(cs)
                                matched_std = True
                                break
                        if not matched_std:
                            # Capitalize nicely
                            title_part = " ".join([w.capitalize() if w.lower() not in ['and', 'or', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'an', 'a', 'the'] else w.lower() for w in part.split()])
                            if title_part:
                                found_skills.add(title_part)

        # Min Experience extraction
        exp_matches = re.findall(r'(\d+)\s*(?:-|–|to)?\s*(?:\d+)?\+?\s*(?:year|yr)', text, re.IGNORECASE)
        min_experience = 0
        if exp_matches:
            ints = [int(m) for m in exp_matches if int(m) < 20]
            if ints:
                min_experience = min(ints)
                
        # Description Extraction
        desc_match = re.search(r'(?i)(?:description|about the role|role overview):?(.*?)(?=\n\s*(?:responsibilities|requirements|required\s+skills|preferred\s+skills|skills|experience|education)\b:?|$)', text, re.DOTALL)
        if desc_match:
            description = desc_match.group(1).strip()
        else:
            fallback_match = re.search(r'(?i)(.*?)(?=\n\s*(?:responsibilities|requirements|required\s+skills|preferred\s+skills|skills|experience|education)\b:?|$)', text, re.DOTALL)
            description = fallback_match.group(1).strip() if fallback_match else text.strip()
            
            # Very basic cleanup if fallback includes title headers
            if description.lower().startswith("title:") or description.lower().startswith("job title:"):
                desc_lines = description.split('\n')
                description = "\n".join(desc_lines[2:]).strip() if len(desc_lines) > 2 else description
        
        # Preferred Skills (Optional)
        pref_match = re.search(r'(?i)preferred skills:?(.*?)(?=\n\s*(?:experience|education|responsibilities|requirements|required\s+skills|skills)\b:?|$)', text, re.DOTALL)
        preferred_skills = ""
        if pref_match:
            pref_text = pref_match.group(1)
            pref_found = set()
            for alias, normalized in ResumeParser.SKILL_ALIASES.items():
                if re.search(rf'\b{re.escape(alias)}\b', pref_text, re.IGNORECASE):
                    pref_found.add(normalized)
            for skill in ResumeParser.COMMON_SKILLS:
                if re.search(rf'\b{re.escape(skill)}\b', pref_text, re.IGNORECASE):
                    pref_found.add(skill)
            preferred_skills = ", ".join(list(pref_found))
        
        return {
            "title": title,
            "description": description,
            "required_skills": ", ".join(list(found_skills)),
            "min_experience": min_experience,
            "preferred_skills": preferred_skills,
            "raw_jd_text": text.strip()
        }
