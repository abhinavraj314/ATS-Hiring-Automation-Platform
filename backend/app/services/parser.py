import fitz  # PyMuPDF
import docx
import re
from typing import Dict, Any, List

class ResumeParser:
    SKILL_ALIASES = {
        "js": "JavaScript",
        "react.js": "React",
        "reactjs": "React",
        "node": "Node.js",
        "nodejs": "Node.js",
        "ts": "TypeScript",
        "k8s": "Kubernetes",
        "aws": "AWS",
        "amazon web services": "AWS",
        "gcp": "GCP",
        "google cloud": "GCP",
        "postgres": "PostgreSQL",
        "mongo": "MongoDB",
        "vuejs": "Vue",
        "vue.js": "Vue",
        "nextjs": "Next.js",
        "expressjs": "Express",
        "golang": "Go",
        "powerapps": "Power Apps",
        "power apps": "Power Apps",
        "powerautomate": "Power Automate",
        "power automate": "Power Automate",
        "powerbi": "Power BI",
        "power bi": "Power BI",
        "api": "APIs",
        "apis": "APIs",
        "cicd": "CI/CD",
        "pbcs": "Oracle PBCS",
        "epbcs": "Oracle EPBCS",
        "essbase": "Essbase",
        "fccs": "Oracle FCCS",
        "pcmcs": "Oracle PCMCS",
        "tagetik": "CCH Tagetik",
        "cch tagetik": "CCH Tagetik"
    }

    COMMON_SKILLS = [
        "Python", "React", "TypeScript", "Node.js", "SQL", "Docker", "AWS", "FastAPI", "Java", "Go",
        "C++", "C#", "JavaScript", "HTML", "CSS", "Kubernetes", "Azure", "GCP", "Linux", "Git",
        "CI/CD", "Machine Learning", "AI", "Data Science", "PostgreSQL", "MongoDB", "Redis",
        "GraphQL", "REST", "Angular", "Vue", "Spring Boot", "Django", "Flask", "Ruby", "PHP",
        "Swift", "Kotlin", "Rust", "Scala", "Hadoop", "Spark", "Kafka", "Elasticsearch",
        "Tailwind", "Next.js", "Express", "Microservices", "Terraform", "Ansible", "Jenkins",
        "PyTorch", "TensorFlow", "Pandas", "NumPy", "C", "R", "Dart", "Flutter", "React Native",
        "Solidity", "Blockchain", "SASS", "LESS", "Webpack", "Vite", "Apollo", "RabbitMQ",
        # Power Platform Niche
        "Power Apps", "Power Automate", "Power BI", "Dataverse", "Power Platform",
        # Oracle & Finance Transformation Niches
        "Oracle PBCS", "Oracle EPBCS", "Essbase", "Oracle FCCS", "Oracle PCMCS", "CCH Tagetik",
        # General Tech & Consulting Niches
        "APIs", "ALM", "RBAC", "Governance", "Compliance", "Integration Architecture", "Security", "DevOps",
        "Finance Transformation", "ERP", "SAP", "Workday"
    ]

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
    def parse_resume(file_path: str) -> Dict[str, Any]:
        if file_path.endswith(".pdf"):
            text = ResumeParser.extract_text_from_pdf(file_path)
        elif file_path.endswith(".docx"):
            text = ResumeParser.extract_text_from_docx(file_path)
        else:
            raise ValueError("Unsupported file format")
            
        # Sanitize text to prevent database truncation on null bytes
        text = text.replace('\x00', ' ')

        # Simple Regex Extraction (Phase 1 Reliability)
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
        
        # Name is usually at the top, let's take the first line that isn't empty
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        name = lines[0] if lines else "Unknown"

        # Skills extraction (basic keyword matching + aliases)
        found_skills = set()
        
        # Check aliases first
        for alias, normalized in ResumeParser.SKILL_ALIASES.items():
            if re.search(rf'\b{re.escape(alias)}\b', text, re.IGNORECASE):
                found_skills.add(normalized)
                
        # Check common skills
        for skill in ResumeParser.COMMON_SKILLS:
            if re.search(rf'\b{re.escape(skill)}\b', text, re.IGNORECASE):
                found_skills.add(skill)

        return {
            "full_name": name,
            "email": email_match.group(0) if email_match else None,
            "phone": phone_match.group(0) if phone_match else None,
            "skills": ", ".join(list(found_skills)),
            "education": ResumeParser.extract_education(text),
            "raw_text": text.strip(),
            "experience_years": ResumeParser.estimate_experience(text)
        }

    @staticmethod
    def extract_education(text: str) -> str:
        match = re.search(r'(?i)\b(education|academic background)\b(.*?)(?=\b(experience|skills|projects|certifications|languages|summary)\b|$)', text, re.DOTALL)
        if match:
            return match.group(2).strip()[:500]
        return ""

    @staticmethod
    def estimate_experience(text: str) -> int:
        # Very simple logic for Phase 1
        # Look for "year" or "yr" near numbers
        matches = re.findall(r'(\d+)\+?\s*(?:year|yr)', text, re.IGNORECASE)
        if matches:
            return max([int(m) for m in matches])
        return 0
