import os
import sys
import logging

# Ensure python can find both 'backend' and 'ai_experiments' packages
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_EXP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", "backend"))
RESUMES_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", "resumes"))

import dotenv
dotenv.load_dotenv(os.path.join(BACKEND_DIR, ".env"))

if AI_EXP_DIR not in sys.path:
    sys.path.append(AI_EXP_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.append(BACKEND_DIR)

from resume_parser import load_resumes as parse_local_resumes

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("domain_data_loader")

# Fallback Mock Niche JDs if the DB is empty
MOCK_NICHE_JOBS = [
    {
        "id": "job_mock_pp",
        "title": "Power Platform Consultant",
        "description": """
        We are seeking a Power Platform Consultant to design and implement premium enterprise solutions.
        
        Required Skills:
        - Extensive hands-on experience with Microsoft Power Apps (Canvas & Model-Driven), Power Automate (Flow), and Dataverse (CDS).
        - Deep understanding of environment strategies, security roles, and ALM (Application Lifecycle Management) processes.
        - Experience writing custom plugins, PCF controls, or integrating with Azure services (Azure Functions, Logic Apps).
        - Strong communication skills to engage with corporate stakeholders and run design workshops.
        
        Responsibilities:
        - Design custom business applications and automate complex multi-stage workflows.
        - Configure scalable Dataverse data models, business rules, and security profiles.
        - Collaborate with enterprise architects to align on integration standards.
        """,
        "chunks": {
            "Description": "Power Platform Consultant - Design and implement premium enterprise solutions using Canvas/Model-Driven Apps, Power Automate, and Dataverse.",
            "RequiredSkills": "Power Apps, Power Automate, Dataverse, ALM, PCF controls, Azure integrations"
        }
    },
    {
        "id": "job_mock_oracle",
        "title": "Oracle EPM/PBCS Consultant",
        "description": """
        We are looking for a senior Oracle EPM / PBCS Consultant with a strong finance background.
        
        Required Skills:
        - Implementation experience in Oracle Planning and Budgeting Cloud Service (PBCS / EPBCS).
        - Mastery of Essbase scripting, business rules, Calc Scripts, and Groovy scripting.
        - Familiarity with Financial Consolidation and Close (FCCS) or Profitability and Cost Management (PCMCS) is highly desirable.
        - Ability to design complex financial forecasting models, balance sheets, and cash flow reports.
        
        Responsibilities:
        - Gather finance requirements and design multi-dimensional cubes in Essbase.
        - Write efficient Calc Scripts, business rules, and data integration maps (FDMEE/Data Management).
        - Support corporate finance teams through annual budgeting and forecasting cycles.
        """,
        "chunks": {
            "Description": "Oracle EPM/PBCS Consultant - Implement Oracle Planning and Budgeting Cloud Service (PBCS/EPBCS) and design multi-dimensional cubes.",
            "RequiredSkills": "Oracle PBCS, EPBCS, Essbase, Calc Scripts, Groovy, FCCS, FDMEE, financial forecasting"
        }
    },
    {
        "id": "job_mock_tagetik",
        "title": "CCH Tagetik CPM Consultant",
        "description": """
        We are looking for a CCH Tagetik Consultant to join our Finance Transformation practice.
        
        Required Skills:
        - Solid experience implementing CCH Tagetik for Financial Consolidation, Budgeting, and Planning.
        - Expertise in Tagetik data modeling, ETL processes, and custom calculations (Analytical Workspace).
        - In-depth understanding of corporate consolidation concepts (IFRS, US GAAP, intercompany eliminations).
        - Background in finance, accounting, or business systems analysis.
        
        Responsibilities:
        - Configure CCH Tagetik environments, including dimension hierarchies, data forms, and consolidation logic.
        - Manage financial data integrations and map ledger systems to Tagetik.
        - Guide CFO-level clients through modernizing their close and consolidation workflows.
        """,
        "chunks": {
            "Description": "CCH Tagetik CPM Consultant - Implement CCH Tagetik for Financial Consolidation, Budgeting, and Planning in Finance Transformation practice.",
            "RequiredSkills": "CCH Tagetik, CPM, Financial Consolidation, ETL, analytical workspace, IFRS, GAAP"
        }
    },
    {
        "id": "job_mock_consulting",
        "title": "Enterprise Finance Transformation Director",
        "description": """
        We are seeking a Director of Enterprise Consulting & Finance Transformation.
        
        Required Skills:
        - Over 10 years of experience in enterprise systems advisory, operating model design, and corporate finance strategy.
        - Track record of leading large-scale ERP/EPM transformation programs (Oracle, SAP, Workday, Tagetik).
        - Expert understanding of modern Target Operating Models (TOM), shared services, and digital finance capabilities.
        - Exceptional advisory skills, executive presence, and business development track record.
        
        Responsibilities:
        - Act as a trusted strategic advisor to CFOs and finance executives.
        - Lead complex finance transformation assessments, design future-state processes, and oversee technology selection.
        - Manage multi-disciplinary project teams and ensure delivery excellence.
        """,
        "chunks": {
            "Description": "Enterprise Finance Transformation Director - Lead large-scale ERP/EPM transformation programs, advise CFOs, and design target operating models.",
            "RequiredSkills": "Finance Transformation, EPM/ERP Advisory, Target Operating Model (TOM), Finance Strategy, program management"
        }
    }
]

def load_jobs_from_db():
    """
    Queries the jobs table from PostgreSQL.
    If database query fails or table is empty, returns curated fallback niche JDs.
    """
    logger.info("Connecting to PostgreSQL database to fetch jobs...")
    
    try:
        from app.core.database import SessionLocal
        from app.models.job import Job
        
        db = SessionLocal()
        try:
            db_jobs = db.query(Job).all()
            if not db_jobs:
                logger.warning("PostgreSQL 'jobs' table is empty. Falling back to gold-standard mock niche JDs.")
                return MOCK_NICHE_JOBS
            
            jobs = []
            for job in db_jobs:
                job_id = f"job_db_{job.id}"
                # Construct clean representation
                required_skills = job.required_skills or ""
                preferred_skills = job.preferred_skills or ""
                
                # Combine title, description, skills for the main description block
                full_desc = f"Title: {job.title}\n\nDescription:\n{job.description}"
                if required_skills:
                    full_desc += f"\n\nRequired Skills:\n{required_skills}"
                if preferred_skills:
                    full_desc += f"\n\nPreferred Skills:\n{preferred_skills}"
                    
                jobs.append({
                    "id": job_id,
                    "title": job.title,
                    "description": full_desc,
                    "chunks": {
                        "Description": job.description,
                        "RequiredSkills": required_skills,
                        "PreferredSkills": preferred_skills
                    }
                })
            
            logger.info(f"Successfully loaded {len(jobs)} jobs from PostgreSQL database.")
            return jobs
            
        except Exception as e:
            logger.error(f"SQLAlchemy query error: {e}. Falling back to gold-standard mock niche JDs.")
            return MOCK_NICHE_JOBS
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Could not import backend DB structures: {e}. Falling back to gold-standard mock niche JDs.")
        return MOCK_NICHE_JOBS

def load_domain_resumes():
    """
    Loads and parses real PDF resumes from the project's root 'resumes' folder.
    """
    logger.info(f"Loading local PDF resumes from: {RESUMES_DIR}")
    if not os.path.exists(RESUMES_DIR):
        logger.error(f"Resumes directory not found: {RESUMES_DIR}")
        return []
        
    resumes = parse_local_resumes(RESUMES_DIR)
    
    # Standardize resume IDs to avoid conflicts and represent domain origin
    for res in resumes:
        res["id"] = f"res_dom_{res['id']}"
        
    logger.info(f"Successfully loaded and parsed {len(resumes)} local resumes.")
    return resumes

if __name__ == "__main__":
    jobs = load_jobs_from_db()
    print(f"\n--- Loaded {len(jobs)} Niche Jobs ---")
    for j in jobs:
        print(f"- {j['title']} ({j['id']})")
        
    resumes = load_domain_resumes()
    print(f"\n--- Loaded {len(resumes)} Local Resumes ---")
    for r in resumes:
        print(f"- {r['name']} ({r['id']}) [Sections: {', '.join(r['chunks'].keys())}]")
