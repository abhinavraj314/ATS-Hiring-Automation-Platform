export type AssessmentStatus =
  | "NOT_ASSIGNED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PASSED"
  | "FAILED";

export function formatAssessmentStatus(status?: string | null): string {
  switch (status) {
    case "ASSIGNED":
      return "Pending";
    case "PASSED":
      return "Passed";
    case "FAILED":
      return "Failed";
    case "IN_PROGRESS":
      return "Ongoing";
    case "COMPLETED":
      return "Completed";
    case "NOT_ASSIGNED":
    default:
      return "Not Assigned";
  }
}

export function getAssessmentStatusColor(status?: string | null): string {
  switch (status) {
    case "PASSED":
      return "border-green-200 bg-green-50 text-green-700";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700";
    case "ASSIGNED":
    case "IN_PROGRESS":
      return "border-yellow-200 bg-yellow-50 text-yellow-800";
    case "COMPLETED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "NOT_ASSIGNED":
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function formatAssessmentScore(score?: number | null): string {
  if (score === null || score === undefined) return "—";
  return String(score);
}

export function formatAssessmentPercentage(percentage?: number | null): string {
  if (percentage === null || percentage === undefined) return "—";
  return `${percentage.toFixed(1)}%`;
}

export function formatAssessmentDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}
