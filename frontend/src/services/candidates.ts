import api from "./api";
import type { Candidate, CandidateNote } from "../types/candidate";

export const candidateService = {
  async uploadResume(jobId: number, file: File): Promise<Candidate> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<Candidate>(`/candidates/upload/${jobId}`, formData);
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
    const response = await api.patch<Candidate>(`/candidates/${id}/status?status=${status}`, {});
    return response.data;
  },

  async getShortlistedCandidates(): Promise<Candidate[]> {
    const response = await api.get<Candidate[]>(`/candidates/shortlisted`);
    return response.data;
  },

  async clearRejectedCandidates(jobId: number): Promise<{status: string, deleted_count: number}> {
    const response = await api.delete<{status: string, deleted_count: number}>(`/candidates/job/${jobId}/rejected`);
    return response.data;
  },

  async getResumeBlobUrl(id: number): Promise<string> {
    const response = await api.get(`/candidates/${id}/resume`, { responseType: 'blob' });
    return URL.createObjectURL(response.data);
  },

  async getNotes(candidateId: number): Promise<CandidateNote[]> {
    const response = await api.get<CandidateNote[]>(`/candidates/${candidateId}/notes`);
    return response.data;
  },

  async addNote(candidateId: number, comment: string): Promise<CandidateNote> {
    const response = await api.post<CandidateNote>(`/candidates/${candidateId}/notes`, { comment });
    return response.data;
  },

  async exportCandidates(jobId: number): Promise<void> {
    const response = await api.get(`/candidates/job/${jobId}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `candidates_job_${jobId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
