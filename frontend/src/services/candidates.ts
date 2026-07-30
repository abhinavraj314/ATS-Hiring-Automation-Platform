import api from "./api";
import type { Candidate, CandidateNote } from "../types/candidate";

export const candidateService = {
  async uploadResume(jobId: number, file: File): Promise<Candidate> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<Candidate>(
      `/candidates/upload/${jobId}`,
      formData,
    );
    return response.data;
  },

  async getCandidatesByJob(jobId: number): Promise<Candidate[]> {
    const response = await api.get<Candidate[]>(`/candidates/job/${jobId}`);
    return response.data;
  },

  async getCandidate(id: number): Promise<Candidate> {
    const response = await api.get<Candidate>(`/candidates/${id}`);
    return response.data;
  },

  async updateStatus(id: number, status: string): Promise<Candidate> {
    const response = await api.patch<Candidate>(
      `/candidates/${id}/status?status=${status}`,
      {},
    );
    return response.data;
  },

  async getSimilarCandidates(id: number): Promise<Candidate[]> {
    const response = await api.get<Candidate[]>(`/candidates/${id}/similar`);
    return response.data;
  },

  async submitFeedback(
    id: number,
    payload: {
      action_type: string;
      rejection_reason_category?: string;
      feedback_notes?: string;
    },
  ): Promise<any> {
    const response = await api.post(`/candidates/${id}/feedback`, payload);
    return response.data;
  },

  async getShortlistedCandidates(): Promise<Candidate[]> {
    const response = await api.get<Candidate[]>(`/candidates/shortlisted`);
    return response.data;
  },

  async getAllCandidates(): Promise<Candidate[]> {
    const response = await api.get<Candidate[]>(`/candidates/all`);
    return response.data;
  },

  async getDashboardStats(filters?: {
    jobId?: string;
    status?: string;
    minScore?: number;
    maxScore?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.jobId) params.append("job_id", filters.jobId);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.minScore !== undefined) params.append("min_score", filters.minScore.toString());
    if (filters?.maxScore !== undefined) params.append("max_score", filters.maxScore.toString());

    const response = await api.get(`/candidates/reports/dashboard?${params.toString()}`);
    return response.data;
  },

  async clearRejectedCandidates(
    jobId: number,
  ): Promise<{ status: string; deleted_count: number }> {
    const response = await api.delete<{
      status: string;
      deleted_count: number;
    }>(`/candidates/job/${jobId}/rejected`);
    return response.data;
  },

  async getResumeBlobUrl(id: number): Promise<string> {
    const response = await api.get(`/candidates/${id}/resume`, {
      responseType: "blob",
    });
    return URL.createObjectURL(response.data);
  },

  async getNotes(candidateId: number): Promise<CandidateNote[]> {
    const response = await api.get<CandidateNote[]>(
      `/candidates/${candidateId}/notes`,
    );
    return response.data;
  },

  async addNote(candidateId: number, comment: string): Promise<CandidateNote> {
    const response = await api.post<CandidateNote>(
      `/candidates/${candidateId}/notes`,
      { comment },
    );
    return response.data;
  },

  async exportCandidates(jobId: number): Promise<void> {
    const response = await api.get(`/candidates/job/${jobId}/export`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `candidates_job_${jobId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async exportAllCandidates(format: "json" | "csv" = "csv"): Promise<void> {
    const response = await api.get(`/candidates/export/all?format=${format}`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ats_candidate_export.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
