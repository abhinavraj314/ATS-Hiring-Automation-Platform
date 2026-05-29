import api from "./api";
import type { Interview } from "../types/interview";

export const interviewService = {
  async getInterviews(): Promise<Interview[]> {
    const response = await api.get<Interview[]>("/interviews/");
    return response.data;
  },

  async getCandidateInterviews(candidateId: number): Promise<Interview[]> {
    const response = await api.get<Interview[]>(`/interviews/candidate/${candidateId}`);
    return response.data;
  },

  async scheduleInterview(data: {
    candidate_id: number;
    panel_id?: number;
    round_type: string;
    scheduled_at?: string;
  }): Promise<Interview> {
    const response = await api.post<Interview>("/interviews/", data);
    return response.data;
  },

  async updateInterview(id: number, data: Partial<Interview>): Promise<Interview> {
    const response = await api.patch<Interview>(`/interviews/${id}`, data);
    return response.data;
  },

  async deleteInterview(id: number): Promise<void> {
    await api.delete(`/interviews/${id}`);
  },
};
