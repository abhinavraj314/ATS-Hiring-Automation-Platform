import api from "./api";
import type { Job, JobCreate } from "../types/job";

export const jobService = {
  async getJobs(): Promise<Job[]> {
    const response = await api.get<Job[]>(`/jobs/`);
    return response.data;
  },

  async createJob(job: JobCreate): Promise<Job> {
    const response = await api.post<Job>(`/jobs/`, job);
    return response.data;
  },

  async getJob(id: number): Promise<Job> {
    const response = await api.get<Job>(`/jobs/${id}`);
    return response.data;
  },

  async updateJob(id: number, job: Partial<JobCreate>): Promise<Job> {
    const response = await api.patch<Job>(`/jobs/${id}`, job);
    return response.data;
  },

  async deleteJob(id: number): Promise<void> {
    await api.delete(`/jobs/${id}`);
  },

  async getSemanticRecommendations(id: number): Promise<any> {
    const response = await api.get(`/jobs/${id}/recommendations`);
    return response.data;
  },



  async parseJD(file: File): Promise<JobCreate> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<JobCreate>(`/jobs/parse`, formData);
    return response.data;
  },
};
