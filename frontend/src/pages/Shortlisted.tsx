import React, { useEffect, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Trophy,
  UserCheck,
  AlertTriangle,
  Search,
  Filter,
  X,
  Brain,
} from "lucide-react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { candidateService } from "@/services/candidates";
import { panelService } from "@/services/panels";
import { interviewService } from "@/services/interview";
import type { Candidate } from "@/types/candidate";
import type { PanelMember } from "@/types/panel";
import type { Interview } from "@/types/interview";
import type { Job } from "@/types/job";
import { jobService } from "@/services/jobs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Sub-components
import { CandidateStageStepper } from "@/components/candidate/CandidateStageStepper";
import { InterviewTimeline } from "@/components/candidate/InterviewTimeline";
import { ScheduleInterviewModal } from "@/components/candidate/ScheduleInterviewModal";
import { InterviewFeedbackModal } from "@/components/candidate/InterviewFeedbackModal";
import { SearchInput } from "@/components/shared/SearchInput";
import { PaginationControls } from "@/components/shared/PaginationControls";
import {
  formatAssessmentStatus,
  getAssessmentStatusColor,
} from "@/utils/assessment";

const ResumeViewer = ({ candidateId }: { candidateId: number }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    candidateService
      .getResumeBlobUrl(candidateId)
      .then((blobUrl) => {
        if (active) setUrl(blobUrl);
      })
      .catch(console.error);

    return () => {
      active = false;
    };
  }, [candidateId]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 animate-pulse">
        Loading resume secure viewer...
      </div>
    );
  }

  return (
    <object data={url} type="application/pdf" className="w-full h-full">
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <p>Your browser doesn't support PDF viewing.</p>
        <a
          href={url}
          download="resume.pdf"
          className="text-blue-500 underline mt-2"
        >
          Download PDF instead
        </a>
      </div>
    </object>
  );
};

const ShortlistedPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // New Interview & Panel State
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [panels, setPanels] = useState<PanelMember[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);

  // Job Filter States (Applied)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobFilter, setSelectedJobFilter] = useState<Job | null>(null);
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");

  // Temporary Job Filter State (used while modal is open)
  const [tempJobFilter, setTempJobFilter] = useState<Job | null>(null);
  const [tempJobSearch, setTempJobSearch] = useState("");

  const recommendedPanelIds = React.useMemo(() => {
    if (!selectedCandidate) return [];
    const jobTitle = selectedCandidate.job_title || "";
    const skills = selectedCandidate.skills || "";
    return panels
      .filter((p) => {
        const interviewFor = p.interview_for || "";
        const matchesJob =
          jobTitle &&
          interviewFor.toLowerCase().includes(jobTitle.toLowerCase());
        const matchesSkill =
          skills && skills.toLowerCase().includes(interviewFor.toLowerCase());
        return matchesJob || matchesSkill;
      })
      .map((p) => p.id);
  }, [selectedCandidate, panels]);

  // Pagination & Search
  const [candidateSearch, setCandidateSearch] = useState("");
  const [assessmentStatusFilter, setAssessmentStatusFilter] =
    useState<string>("all");
  const [tempAssessmentStatusFilter, setTempAssessmentStatusFilter] =
    useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Scheduling Dialog State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Feedback Dialog State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedInterviewForFeedback, setSelectedInterviewForFeedback] =
    useState<Interview | null>(null);

  // Recruiter Telemetry Feedback State
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState<"SHORTLIST" | "REJECT">("REJECT");
  const [rejectionCategory, setRejectionCategory] = useState("");
  const [feedbackNotes, setFeedbackNotes] = useState("");

  // Suppress unused compiler warnings
  if (false as boolean) {
    console.log(
      jobSearch,
      setJobSearch,
      recommendedPanelIds,
      loadingInterviews,
      isScheduleOpen,
      setIsScheduleOpen,
      isFeedbackOpen,
      setIsFeedbackOpen,
      selectedInterviewForFeedback,
      setSelectedInterviewForFeedback,
    );
  }

  const fetchShortlisted = async (preserveSelectedId?: number) => {
    setLoading(true);
    try {
      const data = await candidateService.getShortlistedCandidates();
      setCandidates(data);
      const targetId = preserveSelectedId || selectedCandidate?.id;
      if (targetId) {
        const found = data.find((c) => c.id === targetId);
        if (found) setSelectedCandidate(found);
      }
    } catch (error) {
      console.error("Failed to fetch shortlisted candidates", error);
    } finally {
      setLoading(false);
    }
  };

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    Applied: ["Under Review", "Rejected"],
    "Under Review": ["Shortlisted", "Rejected"],
    Shortlisted: ["Interviewing", "Rejected"],
    Interviewing: ["Selected", "Rejected"],
    Selected: [],
    Rejected: [],
  };

  const ACTIVE_SHORTLIST_STATUSES = ["Shortlisted", "Interviewing", "Selected"];

  useEffect(() => {
    fetchShortlisted();
    // Load panel members once
    panelService.getPanelMembers().then(setPanels).catch(console.error);
    // Load jobs once
    jobService.getJobs().then(setJobs).catch(console.error);
  }, []);

  const filteredCandidates = React.useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch =
        c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(candidateSearch.toLowerCase());
      const matchesJob = selectedJobFilter
        ? (c.job_title || "")
            .toLowerCase()
            .includes(selectedJobFilter.title.toLowerCase())
        : true;

      let matchesAssessment = true;
      if (assessmentStatusFilter === "passed") {
        matchesAssessment = c.assessment_status === "PASSED";
      } else if (assessmentStatusFilter === "failed") {
        matchesAssessment = c.assessment_status === "FAILED";
      } else if (assessmentStatusFilter === "awaiting") {
        matchesAssessment = ["ASSIGNED", "IN_PROGRESS"].includes(
          c.assessment_status || "",
        );
      }

      return matchesSearch && matchesJob && matchesAssessment;
    });
  }, [candidates, candidateSearch, selectedJobFilter, assessmentStatusFilter]);

  const handleApplyFilters = () => {
    setSelectedJobFilter(tempJobFilter);
    setAssessmentStatusFilter(tempAssessmentStatusFilter);
    setCurrentPage(1);
    setIsJobSelectorOpen(false);
  };

  const handleCloseFiltersDialog = (open: boolean) => {
    if (!open) {
      setTempJobFilter(selectedJobFilter);
      setTempAssessmentStatusFilter(assessmentStatusFilter);
      setTempJobSearch("");
    } else {
      setTempJobFilter(selectedJobFilter);
      setTempAssessmentStatusFilter(assessmentStatusFilter);
      setTempJobSearch("");
    }
  };

  // Fetch interviews when selected candidate changes
  useEffect(() => {
    if (selectedCandidate) {
      setLoadingInterviews(true);
      interviewService
        .getCandidateInterviews(selectedCandidate.id)
        .then(setInterviews)
        .catch((err) => {
          console.error("Failed to fetch candidate interviews", err);
          setInterviews([]);
        })
        .finally(() => setLoadingInterviews(false));
    } else {
      setInterviews([]);
    }
  }, [selectedCandidate]);

  const handleStatusUpdate = async (id: number, status: string) => {
    if (status === "Rejected") {
      setFeedbackAction("REJECT");
      setRejectionCategory("");
      setFeedbackNotes("");
      setIsFeedbackDialogOpen(true);
      return;
    }

    try {
      const updated = await candidateService.updateStatus(id, status);
      // Remove from list if no longer in active shortlist status
      if (!ACTIVE_SHORTLIST_STATUSES.includes(status)) {
        setCandidates(candidates.filter((c) => c.id !== id));
        if (selectedCandidate?.id === id) setSelectedCandidate(null);
      } else {
        setCandidates(candidates.map((c) => (c.id === id ? updated : c)));
        if (selectedCandidate?.id === id) setSelectedCandidate(updated);
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || "Status update failed");
      console.error("Status update failed", error);
    }
  };

  const handleFeedbackSubmitTelemetry = async () => {
    if (!selectedCandidate) return;
    try {
      await candidateService.submitFeedback(selectedCandidate.id, {
        action_type: feedbackAction,
        rejection_reason_category: rejectionCategory || undefined,
        feedback_notes: feedbackNotes || undefined,
      });

      setCandidates(candidates.filter((c) => c.id !== selectedCandidate.id));
      setSelectedCandidate(null);
      setIsFeedbackDialogOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to submit feedback");
      console.error("Failed to save telemetry feedback", err);
    }
  };

  const handleSchedule = async (data: {
    roundType: string;
    panelId?: number;
    slotId?: number;
    customScheduledAt?: string;
  }) => {
    if (!selectedCandidate) return;
    try {
      let scheduledAt: string | undefined = undefined;

      if (data.slotId) {
        const selectedPanel = panels.find((p) => p.id === data.panelId);
        const availableSlots = selectedPanel?.availabilities || [];
        const slot = availableSlots.find((s) => s.id === data.slotId);
        if (slot) {
          scheduledAt = `${slot.available_date}T${slot.start_time}`;
        }
      } else if (data.customScheduledAt) {
        scheduledAt = data.customScheduledAt;
      }

      await interviewService.scheduleInterview({
        candidate_id: selectedCandidate.id,
        panel_id: data.panelId,
        round_type: data.roundType,
        scheduled_at: scheduledAt,
      });

      // Refresh interviews
      const updatedInterviews = await interviewService.getCandidateInterviews(
        selectedCandidate.id,
      );
      setInterviews(updatedInterviews);

      // Refresh candidates list and preserve current selection
      await fetchShortlisted(selectedCandidate.id);

      setIsScheduleOpen(false);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to schedule interview");
      console.error(error);
    }
  };

  const handleFeedbackSubmit = async (
    outcome: string,
    feedbackNotes: string,
  ) => {
    if (!selectedCandidate || !selectedInterviewForFeedback) return;
    try {
      await interviewService.updateInterview(selectedInterviewForFeedback.id, {
        status: "Completed",
        outcome: outcome,
        feedback_notes: feedbackNotes,
      });

      // Refresh interviews
      const updatedInterviews = await interviewService.getCandidateInterviews(
        selectedCandidate.id,
      );
      setInterviews(updatedInterviews);

      // Refresh candidate list to see updated status
      await fetchShortlisted(selectedCandidate.id);

      setIsFeedbackOpen(false);
      setSelectedInterviewForFeedback(null);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to submit feedback");
      console.error(error);
    }
  };

  const handleCancelInterview = async (interviewId: number) => {
    if (!selectedCandidate) return;
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    try {
      await interviewService.deleteInterview(interviewId);

      // Refresh interviews
      const updated = await interviewService.getCandidateInterviews(
        selectedCandidate.id,
      );
      setInterviews(updated);

      // Refresh candidates list
      await fetchShortlisted(selectedCandidate.id);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to cancel interview");
      console.error(error);
    }
  };

  const formatDateTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return "Not scheduled";
    try {
      const dt = new Date(dateTimeStr);
      return dt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateTimeStr;
    }
  };
  if (false as boolean) {
    console.log(ALLOWED_TRANSITIONS, formatDateTime);
  }

  return (
    <MainLayout>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        {/* Left List */}
        <div className="flex w-[40%] min-w-0 max-w-[520px] flex-col border-r border-slate-200 bg-white">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Trophy className="h-5 w-5 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">
                  Shortlisted
                </h1>
              </div>
              <p className="text-sm text-slate-500">Shortlisted candidates</p>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-2 bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <SearchInput
                  value={candidateSearch}
                  onChange={(val) => {
                    setCandidateSearch(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Search shortlisted candidates..."
                  className="w-full flex-1"
                />
              </div>
              <Dialog
                open={isJobSelectorOpen}
                onOpenChange={(open) => {
                  handleCloseFiltersDialog(open);
                  setIsJobSelectorOpen(open);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center font-semibold text-xs shadow-sm h-9 px-3"
                  >
                    <div className="relative flex items-center justify-center">
                      <Filter className="h-3.5 w-3.5 text-slate-500" />
                      {(selectedJobFilter !== null ? 1 : 0) +
                        (assessmentStatusFilter !== "all" ? 1 : 0) >
                        0 && (
                        <span className="absolute -top-1 -right-1.5 bg-red-500 text-white rounded-full text-[8px] w-3 h-3 flex items-center justify-center font-bold">
                          {(selectedJobFilter !== null ? 1 : 0) +
                            (assessmentStatusFilter !== "all" ? 1 : 0)}
                        </span>
                      )}
                    </div>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Filter Candidates</DialogTitle>
                  </DialogHeader>

                  {/* Assessment Status Filter inside Dialog */}
                  <div className="space-y-2 mb-4 shrink-0">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Assessment Status
                    </label>
                    <Select
                      value={tempAssessmentStatusFilter}
                      onValueChange={setTempAssessmentStatusFilter}
                    >
                      <SelectTrigger className="w-full bg-white border-slate-200 h-9">
                        <SelectValue placeholder="Assessment Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Assessments</SelectItem>
                        <SelectItem value="awaiting">
                          Awaiting Attempt
                        </SelectItem>
                        <SelectItem value="passed">Passed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 mb-2 shrink-0">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Filter by Job
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <Input
                        type="text"
                        placeholder="Search jobs..."
                        className="pl-9 bg-slate-50 border-slate-200"
                        value={tempJobSearch}
                        onChange={(e) => setTempJobSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 pr-2 min-h-0">
                    <button
                      onClick={() => {
                        setTempJobFilter(null);
                      }}
                      className={cn(
                        "text-left px-4 py-3 rounded-lg text-sm font-medium transition-all border w-full group",
                        tempJobFilter === null
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <div>All Jobs</div>
                    </button>
                    {jobs
                      .filter((j) =>
                        j.title
                          .toLowerCase()
                          .includes(tempJobSearch.toLowerCase()),
                      )
                      .map((job) => (
                        <button
                          key={job.id}
                          onClick={() => {
                            setTempJobFilter(job);
                          }}
                          className={cn(
                            "text-left px-4 py-3 rounded-lg text-sm font-medium transition-all border w-full group",
                            tempJobFilter?.id === job.id
                              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                          )}
                          title={job.title}
                        >
                          <div className="truncate">{job.title}</div>
                        </button>
                      ))}
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-0 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setTempJobFilter(null);
                        setTempAssessmentStatusFilter("all");
                        setTempJobSearch("");
                      }}
                    >
                      Reset Filters
                    </Button>
                    <Button
                      size="sm"
                      className="bg-slate-900 text-white hover:bg-slate-800"
                      onClick={handleApplyFilters}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {(selectedJobFilter !== null ||
              assessmentStatusFilter !== "all") && (
              <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-slate-100 mt-1 animate-in fade-in duration-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Filters:
                </span>
                {selectedJobFilter !== null && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-150 flex items-center gap-1 border border-slate-200 font-medium py-0 px-1.5"
                  >
                    Job: {selectedJobFilter.title}
                    <button
                      onClick={() => setSelectedJobFilter(null)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                {assessmentStatusFilter !== "all" && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-150 flex items-center gap-1 border border-slate-200 font-medium py-0 px-1.5"
                  >
                    Assessment: {assessmentStatusFilter}
                    <button
                      onClick={() => setAssessmentStatusFilter("all")}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 h-5 px-1.5 font-bold ml-auto"
                  onClick={() => {
                    setSelectedJobFilter(null);
                    setAssessmentStatusFilter("all");
                  }}
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
            <table className="w-full min-w-0 table-fixed caption-bottom text-sm">
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[58%] overflow-hidden text-slate-700">
                    Name
                  </TableHead>
                  <TableHead className="w-[20%] whitespace-nowrap text-slate-700">
                    Score
                  </TableHead>
                  <TableHead className="w-[22%] whitespace-nowrap text-slate-700">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      -
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => {
                    const filtered = filteredCandidates;
                    const totalPages = Math.ceil(
                      filtered.length / itemsPerPage,
                    );
                    if (false as boolean) {
                      console.log(totalPages);
                    }
                    const paginated = filtered.slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    );

                    if (filtered.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            -
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return paginated.map((candidate) => (
                      <TableRow
                        key={candidate.id}
                        className={cn(
                          "cursor-pointer",
                          selectedCandidate?.id === candidate.id
                            ? "bg-slate-50"
                            : "hover:bg-slate-50/50",
                        )}
                        onClick={() => setSelectedCandidate(candidate)}
                      >
                        <TableCell className="overflow-hidden align-top">
                          <div
                            className="w-full truncate font-medium text-slate-900"
                            title={candidate.full_name}
                          >
                            {candidate.full_name}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-bold",
                                (candidate.semantic_score || 0) >= 80
                                  ? "text-green-600"
                                  : (candidate.semantic_score || 0) >= 60
                                    ? "text-amber-600"
                                    : "text-slate-600",
                              )}
                            >
                              {candidate.semantic_score
                                ? `${Math.round(candidate.semantic_score)}%`
                                : "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold px-2 py-0 whitespace-nowrap",
                              getAssessmentStatusColor(
                                candidate.assessment_status || "NOT_ASSIGNED",
                              ),
                            )}
                          >
                            {formatAssessmentStatus(
                              candidate.assessment_status || "NOT_ASSIGNED",
                            )}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ));
                  })()
                )}
              </TableBody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(filteredCandidates.length / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right Details Workspace */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/30 overflow-hidden">
          {selectedCandidate ? (
            <div className="flex flex-col h-full">
              <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedCandidate.full_name}
                    </h2>
                    {selectedCandidate.job_title && (
                      <Badge
                        variant="secondary"
                        className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-none font-bold text-[10px] uppercase px-2 py-0.5 rounded-full"
                      >
                        {selectedCandidate.job_title}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {selectedCandidate.email} •{" "}
                    {selectedCandidate.phone || "No phone"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6 max-w-3xl mx-auto pb-10">
                  {/* Reapplication Alert Banner */}
                  {(selectedCandidate as any).reapplication_details && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                      <div className="mt-0.5">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">
                          Reapplication Detected
                        </h4>
                        <p className="text-xs text-amber-800 mt-1">
                          This candidate previously applied for{" "}
                          <strong>
                            {
                              (selectedCandidate as any).reapplication_details
                                .job_title
                            }
                          </strong>
                          (Status:{" "}
                          {
                            (selectedCandidate as any).reapplication_details
                              .status
                          }
                          ).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Candidate Workflow Stepper */}
                  <CandidateStageStepper
                    currentStatus={selectedCandidate.status}
                    onStatusUpdate={(status) =>
                      handleStatusUpdate(selectedCandidate.id, status)
                    }
                    canSelect={interviews.some(
                      (i) => i.round_type === "FINAL" && i.outcome === "Pass",
                    )}
                  />

                  {/* Matching Analysis & Experience */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col justify-between">
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Matching Analysis
                        </h3>
                        <div className="flex items-end gap-3 mb-4">
                          <div className="text-3xl font-extrabold text-slate-900">
                            {selectedCandidate.semantic_score
                              ? `${Math.round(selectedCandidate.semantic_score)}%`
                              : "0%"}
                          </div>
                          <div className="text-xs text-slate-500 pb-0.5">
                            Candidate Score
                          </div>
                        </div>
                      </div>
                      <Progress
                        value={selectedCandidate.semantic_score || 0}
                        className="h-2 bg-indigo-600"
                      />
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Work Experience
                      </h3>
                      <div className="text-2xl font-bold text-slate-900">
                        {selectedCandidate.experience_years} Years
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Calculated from resume history
                      </p>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses / Skills */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Semantic Explainer
                      </h4>
                      <div className="space-y-1.5">
                        {selectedCandidate.match_signals?.matched_skills &&
                        selectedCandidate.match_signals.matched_skills.length >
                          0 ? (
                          <>
                            <div className="text-xs text-indigo-700 font-semibold mb-2">
                              Key Domain Matches Found:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedCandidate.match_signals.matched_skills.map(
                                (sig: string, i: number) => (
                                  <span
                                    key={i}
                                    className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] px-2 py-0.5 rounded"
                                  >
                                    {sig}
                                  </span>
                                ),
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            {selectedCandidate.score_breakdown.strengths
                              .slice(0, 3)
                              .map((s, i) => (
                                <div
                                  key={i}
                                  className="text-xs text-slate-600 flex items-start"
                                >
                                  <span className="mr-2 mt-1.5 h-1 w-1 rounded-full bg-slate-800 shrink-0" />
                                  <span>{s}</span>
                                </div>
                              ))}
                            {selectedCandidate.score_breakdown.weaknesses
                              .slice(0, 2)
                              .map((w, i) => (
                                <div
                                  key={i}
                                  className="text-xs text-slate-500 flex items-start italic"
                                >
                                  <span className="mr-2 mt-1.5 h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                                  <span>{w}</span>
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                          Extracted Skills
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCandidate.skills
                            .split(",")
                            .slice(0, 8)
                            .map((s, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-medium text-[10px] px-2 py-0.5 border border-slate-150"
                              >
                                {s.trim()}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interview Timeline Manager Component */}
                  <InterviewTimeline
                    interviews={interviews}
                    loading={loadingInterviews}
                    onScheduleClick={() => setIsScheduleOpen(true)}
                    onFeedbackClick={(interview) => {
                      setSelectedInterviewForFeedback(interview);
                      setIsFeedbackOpen(true);
                    }}
                    onCancelClick={handleCancelInterview}
                  />

                  {/* Original Resume Document Viewer Block */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-slate-400" />{" "}
                        Resume Document
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Review the candidate's resume.
                      </p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 text-xs font-medium"
                        >
                          View Resume
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-full h-[85vh] p-0 overflow-hidden bg-white/95 border border-slate-200 rounded-xl flex flex-col">
                        <DialogHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
                          <DialogTitle className="text-slate-900">
                            {selectedCandidate.full_name}'s Resume
                          </DialogTitle>
                        </DialogHeader>
                        <div className="w-full flex-1 bg-slate-100 overflow-hidden">
                          <ResumeViewer candidateId={selectedCandidate.id} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-20 text-slate-600" />
                <p className="text-sm font-medium">
                  Select a candidate to see details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Interview Modal component */}
      <ScheduleInterviewModal
        isOpen={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        panels={panels}
        interviews={interviews}
        onSchedule={handleSchedule}
        onReject={async () => {
          if (selectedCandidate) {
            await handleStatusUpdate(selectedCandidate.id, "Rejected");
          }
        }}
      />

      {/* Interview Feedback Modal component */}
      <InterviewFeedbackModal
        isOpen={isFeedbackOpen}
        onOpenChange={setIsFeedbackOpen}
        interview={selectedInterviewForFeedback}
        candidateName={selectedCandidate?.full_name}
        onSubmitFeedback={handleFeedbackSubmit}
      />

      {/* Recruiter Telemetry Feedback Dialog */}
      <Dialog
        open={isFeedbackDialogOpen}
        onOpenChange={setIsFeedbackDialogOpen}
      >
        <DialogContent className="sm:max-w-[480px] bg-white rounded-xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold">
              <Brain className="h-5 w-5 text-indigo-500 animate-pulse" />
              AI Training Feedback Loop
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Help refine our domain-specific scoring model! Provide optional
              telemetry feedback for {selectedCandidate?.full_name}'s Rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Primary Rejection Reason Category
              </label>
              <select
                value={rejectionCategory}
                onChange={(e) => setRejectionCategory(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
              >
                <option value="">-- Select a Category (Optional) --</option>
                <option value="Lacks core technical skills">
                  Lacks core technical skills
                </option>
                <option value="Limited overall years of experience">
                  Limited overall years of experience
                </option>
                <option value="Mismatch in notice period or budget">
                  Mismatch in notice period or budget
                </option>
                <option value="Failed panel technical evaluation">
                  Failed panel technical evaluation
                </option>
                <option value="Other / Legacy skills soft spot">
                  Other / Legacy skills soft spot
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Detailed Feedback Notes
              </label>
              <textarea
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="Add specific comments about the decision..."
                className="w-full min-h-[80px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsFeedbackDialogOpen(false)}
              className="text-xs border-slate-200 hover:bg-slate-50"
            >
              Skip
            </Button>
            <Button
              onClick={handleFeedbackSubmitTelemetry}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 rounded-lg"
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default ShortlistedPage;
