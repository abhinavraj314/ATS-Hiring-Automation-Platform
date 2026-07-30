export interface Candidate {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  skills: string;
  experience_years: number;
  status: string;
  score: number;
  score_breakdown: {
    strengths: string[];
    weaknesses: string[];
    details: Record<string, string>;
  };
  semantic_score?: number;
  match_signals?: {
    matched_skills?: string[];
    missing_skills?: string[];
    skill_gap_analysis?: Array<{
      skill: string;
      severity: "Critical" | "Preferred";
      reason: string;
    }>;
    strengths?: string[];
    weaknesses?: string[];
    interview_focus_areas?: string[];
  };
  job_id: number;
  job_title?: string;
  file_path: string;
  raw_text?: string;
  current_org?: string;
  notice_period?: string;
  moodle_user_id?: number | null;
  assessment_status?: string;
  assessment_score?: number | null;
  assessment_percentage?: number | null;
  assessment_assigned_at?: string | null;
  assessment_completed_at?: string | null;
}

export interface CandidateNote {
  id: number;
  candidate_id: number;
  recruiter_id: number;
  comment: string;
  created_at: string;
}
