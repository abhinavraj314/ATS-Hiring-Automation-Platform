import api from "./api";

export interface AssessmentSyncSummary {
  processed: number;
  passed: number;
  failed: number;
  pending: number;
}

export const assessmentService = {
  async syncResults(): Promise<AssessmentSyncSummary> {
    const response = await api.post<AssessmentSyncSummary>(
      "/assessments/sync",
      {},
    );
    return response.data;
  },
};
