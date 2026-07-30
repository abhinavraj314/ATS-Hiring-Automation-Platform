# ATS Hiring Automation Platform

An AI-powered Applicant Tracking System (ATS) that streamlines the recruitment process through intelligent resume screening, semantic candidate-job matching, interview management, recruiter workflows, and Moodle-based online technical assessments.

---

## Features

- AI-powered resume parsing with automatic extraction of candidate skills, experience, education, and metadata.
- Semantic candidate-job matching using Sentence Transformers (`all-MiniLM-L6-v2`).
- Explainable AI scoring with detailed match reasoning.
- Candidate workflow management across multiple recruitment stages.
- Recruiter dashboard for managing jobs, candidates, interviews, and assessments.
- Interview scheduling with panel assignment and interview management.
- Moodle LMS integration for assigning online technical assessments.
- Automatic synchronization of Moodle assessment scores.
- JWT-based authentication and role-based access control.
- FastAPI backend with PostgreSQL for scalable application development.

---

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Backend
- FastAPI
- Python 3.10+

### Database
- PostgreSQL
- SQLAlchemy ORM
- Alembic

### AI / Machine Learning
- Sentence Transformers (`all-MiniLM-L6-v2`)
- PyTorch
- PyMuPDF

### Authentication
- JWT
- Passlib (Bcrypt)

### Assessment Platform
- Moodle LMS (Dockerized)

### Containerization
- Docker
- Docker Compose

---

## Project Structure

```text
ATS-Hiring-Automation-Platform/
├── backend/          # FastAPI backend, AI models, database, API routes
├── frontend/         # React frontend
├── moodle/           # Docker Compose setup for Moodle LMS
├── docs/             # Project documentation
└── README.md
```

---

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/abhinavraj314/ATS-Hiring-Automation-Platform.git
cd ATS-Hiring-Automation-Platform
```

### 2. Start PostgreSQL

Ensure PostgreSQL is installed and running.

Create a database named:

```text
hiring_platform
```

### 3. Start Moodle

```bash
cd moodle
docker compose up -d
cd ..
```

Open:

```
http://localhost:8080
```

Complete the Moodle setup wizard.

After setup:

- Create a course.
- Create one or more quiz assessments.
- Enable Web Services.
- Generate a Moodle Web Service Token.

### 4. Configure the Backend

Navigate to the backend directory:

```bash
cd backend
```

Create a `.env` file:

```env
PROJECT_NAME="Hiring Automation Platform"
SECRET_KEY="your_jwt_secret_key"

# PostgreSQL
POSTGRES_SERVER="localhost"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="your_password"
POSTGRES_DB="hiring_platform"

# SMTP Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USERNAME="your_email@gmail.com"
SMTP_PASSWORD="your_app_password"
SENDER_EMAIL="your_email@gmail.com"

# Moodle Integration
MOODLE_URL="http://localhost:8080"
MOODLE_TOKEN="your_moodle_webservice_token"
```

### 5. Start the Backend

```bash
pip install -r requirements.txt

python init_db.py

uvicorn app.main:app --reload
```

Backend API:

```
http://localhost:8000
```

Swagger documentation:

```
http://localhost:8000/docs
```

### 6. Start the Frontend

Open a new terminal.

```bash
cd frontend

npm install
npm run dev
```

Frontend:

```
http://localhost:5173
```

---

## Usage

1. Start PostgreSQL.
2. Start Moodle using Docker Compose.
3. Complete the Moodle setup and generate a Web Service Token.
4. Configure the backend `.env` file.
5. Launch the FastAPI backend.
6. Launch the React frontend.
7. Create job postings.
8. Upload candidate resumes.
9. Review AI-generated candidate match scores.
10. Move candidates through the recruitment workflow.
11. Schedule interviews.
12. Assign Moodle assessments.
13. Synchronize assessment results.

---

## System Architecture

```text
                React Frontend
                      │
                      ▼
              FastAPI Backend
              │             │
              ▼             ▼
       PostgreSQL       Moodle LMS
              │
              ▼
 Sentence Transformer AI
```

---

## Screenshots

Include screenshots of:

- Dashboard
- Job Management
- Candidate Management
- Candidate Details
- Interview Scheduling
- Moodle Assessment Assignment
- Assessment Results

---

## Notes

- Docker volumes are not included in this repository.
- Moodle data is stored locally using Docker volumes.
- Sample Moodle assessments used during demonstrations are not included.
- Create your own Moodle courses and quiz assessments after completing the Moodle setup.
- Moodle integration requires a valid Web Service Token configured in the backend `.env` file.
