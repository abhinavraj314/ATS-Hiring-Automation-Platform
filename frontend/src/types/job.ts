export type AssessmentTemplate = "POWER_PLATFORM" | "ORACLE_EPM" | "SQL";

export interface Job {
  id: number;
  title: string;
  description: string;
  required_skills: string;
  min_experience: number;
  owner_id: number;
  created_at: string;
  preferred_skills?: string;
  raw_jd_text?: string;
  assessment_required: boolean;
  assessment_template?: AssessmentTemplate | null;
  passing_score: number;
}

export interface JobCreate {
  title: string;
  description: string;
  required_skills: string;
  min_experience: number;
  preferred_skills?: string;
  raw_jd_text?: string;
  assessment_required?: boolean;
  assessment_template?: AssessmentTemplate | null;
  passing_score?: number;
}
