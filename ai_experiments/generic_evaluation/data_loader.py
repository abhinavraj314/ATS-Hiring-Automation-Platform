import kagglehub
import pandas as pd
import os
from datasets import load_dataset

def load_jobs(limit=50):
    """
    Loads the jobs dataset from Kaggle and normalizes it.
    Returns a list of dicts: [{'id', 'title', 'description', 'chunks': {'Description': ...}}]
    """
    print(f"Loading up to {limit} jobs from kagglehub...")
    path = kagglehub.dataset_download("kshitizregmi/jobs-and-job-description")
    
    csv_file = [f for f in os.listdir(path) if f.endswith('.csv')][0]
    
    df = pd.read_csv(os.path.join(path, csv_file))
    
    # Drop rows with NaN in critical columns
    df = df.dropna(subset=['Job Title', 'Job Description'])
    
    if limit:
        df = df.head(limit)
        
    jobs = []
    for idx, row in df.iterrows():
        job_id = f"job_gen_{idx}"
        title = str(row['Job Title'])
        description = str(row['Job Description'])
        
        jobs.append({
            "id": job_id,
            "title": title,
            "description": description,
            "chunks": {
                "Description": description
            }
        })
    return jobs


def parse_resume_record(record, idx):
    """Helper to convert HuggingFace dataset format to our chunk format."""
    chunks = {}
    full_text_parts = []
    
    # Summary
    if 'personal_info' in record and isinstance(record['personal_info'], dict):
        summary = record['personal_info'].get('summary', '')
        if summary and summary != 'Unknown':
            chunks['Summary'] = summary
            full_text_parts.append(f"Summary:\n{summary}")
            
    # Experience
    if 'experience' in record and isinstance(record['experience'], list):
        exp_texts = []
        for exp in record['experience']:
            title = exp.get('title', '')
            company = exp.get('company', '')
            resp = "\n".join(exp.get('responsibilities', []))
            if title != 'Unknown':
                exp_texts.append(f"{title} at {company}\n{resp}")
        if exp_texts:
            exp_str = "\n\n".join(exp_texts)
            chunks['Experience'] = exp_str
            full_text_parts.append(f"Experience:\n{exp_str}")
            
    # Education
    if 'education' in record and isinstance(record['education'], list):
        edu_texts = []
        for edu in record['education']:
            if isinstance(edu, dict):
                degree_info = edu.get('degree', {})
                inst_info = edu.get('institution', {})
                level = degree_info.get('level', '') if isinstance(degree_info, dict) else ''
                field = degree_info.get('field', '') if isinstance(degree_info, dict) else ''
                school = inst_info.get('name', '') if isinstance(inst_info, dict) else ''
                if level != 'Unknown' and field != 'Unknown':
                    edu_texts.append(f"{level} in {field} from {school}")
        if edu_texts:
            edu_str = "\n".join(edu_texts)
            chunks['Education'] = edu_str
            full_text_parts.append(f"Education:\n{edu_str}")
            
    # Skills
    if 'skills' in record and isinstance(record['skills'], dict):
        tech_skills = record['skills'].get('technical', {})
        if isinstance(tech_skills, dict):
            langs = [s.get('name') for s in tech_skills.get('programming_languages', []) if isinstance(s, dict)]
            frameworks = [s.get('name') for s in tech_skills.get('frameworks', []) if isinstance(s, dict)]
            db = [s.get('name') for s in tech_skills.get('databases', []) if isinstance(s, dict)]
            
            all_skills = [s for s in langs + frameworks + db if s and s != 'Unknown']
            if all_skills:
                skills_str = ", ".join(all_skills)
                chunks['Skills'] = skills_str
                full_text_parts.append(f"Skills:\n{skills_str}")
                
    full_text = "\n\n".join(full_text_parts)
    # Fallback if parsing fails to extract anything meaningful
    if not full_text.strip():
        full_text = str(record)
        chunks['Raw'] = full_text

    # Extract name or make one up
    name = "Unknown Candidate"
    if 'personal_info' in record and isinstance(record['personal_info'], dict):
        parsed_name = record['personal_info'].get('name', 'Unknown')
        if parsed_name and parsed_name != 'Unknown':
            name = parsed_name

    if name == "Unknown Candidate" or name == "Unknown":
        name = f"Candidate #{idx}"

    return {
        "id": f"res_gen_{idx}",
        "name": name,
        "full_text": full_text,
        "chunks": chunks
    }

def load_resumes(limit=100):
    """
    Loads resumes from HuggingFace dataset and normalizes them.
    Returns a list of dicts matching our matcher format.
    """
    print(f"Loading up to {limit} resumes from huggingface datasets...")
    dataset = load_dataset("datasetmaster/resumes", split="train")
    
    if limit:
        dataset = dataset.select(range(min(limit, len(dataset))))
        
    resumes = []
    for idx, record in enumerate(dataset):
        parsed = parse_resume_record(record, idx)
        resumes.append(parsed)
        
    return resumes
