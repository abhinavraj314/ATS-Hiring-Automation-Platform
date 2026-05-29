import type { Candidate } from "./candidate";
import type { PanelMember } from "./panel";

export interface Interview {
  id: number;
  candidate_id: number;
  panel_id?: number;
  round_type: string;
  scheduled_at?: string;
  status: string;
  outcome?: string;
  feedback_notes?: string;
  candidate?: Candidate;
  panel_member?: PanelMember;
}
