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
}

export interface JobCreate {
  title: string;
  description: string;
  required_skills: string;
  min_experience: number;
  preferred_skills?: string;
  raw_jd_text?: string;
}
