import React, { useEffect, useState } from "react";
import MainLayout from "@/layouts/MainLayout";

import { Button } from "@/components/ui/button";
import {
  Upload,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  Trash2,
  Search,
  Download,
  AlertTriangle,
  AlertCircle,
  Brain,
  CheckCircle2,
  Target,
  X,
  RefreshCw,
  Loader2,
  ClipboardCheck,
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { candidateService } from "@/services/candidates";
import { assessmentService } from "@/services/assessments";
import { jobService } from "@/services/jobs";
import { panelService } from "@/services/panels";
import { interviewService } from "@/services/interview";
import type { Job } from "@/types/job";
import type { Candidate, CandidateNote } from "@/types/candidate";
import type { PanelMember } from "@/types/panel";
import type { Interview } from "@/types/interview";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";

// Sub-components
import { CandidateStageStepper } from "@/components/candidate/CandidateStageStepper";
import { InterviewTimeline } from "@/components/candidate/InterviewTimeline";
import { ScheduleInterviewModal } from "@/components/candidate/ScheduleInterviewModal";
import { InterviewFeedbackModal } from "@/components/candidate/InterviewFeedbackModal";
import { CandidateNotesPanel } from "@/components/candidate/CandidateNotesPanel";
import { SearchInput } from "@/components/shared/SearchInput";
import { PaginationControls } from "@/components/shared/PaginationControls";
import {
  formatAssessmentDate,
  formatAssessmentPercentage,
  formatAssessmentScore,
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

const SHOW_SIMILAR_TALENT = false;

const CandidatesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncingAssessments, setSyncingAssessments] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState("");
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");

  // Phase 3 States
  const [similarCandidates, setSimilarCandidates] = useState<Candidate[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState<"SHORTLIST" | "REJECT">(
    "SHORTLIST",
  );
  const [rejectionCategory, setRejectionCategory] = useState("");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [intelTab, setIntelTab] = useState<"gaps" | "profiler" | "interview">(
    "gaps",
  );

  // Notes, interviews, and panel lists
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [panels, setPanels] = useState<PanelMember[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);

  const recommendedPanelIds = React.useMemo(() => {
    if (!selectedCandidate) return [];
    const jobTitle = selectedJob?.title || "";
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
  }, [selectedCandidate, selectedJob, panels]);

  // Modal Open/Close triggers
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedInterviewForFeedback, setSelectedInterviewForFeedback] =
    useState<Interview | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "ai">("all");
  const [loadingAi, setLoadingAi] = useState(false);

  // Pagination, Search & Filter
  const [candidateSearch, setCandidateSearch] = useState("");
  const [assessmentStatusFilter, setAssessmentStatusFilter] =
    useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Suppress unused compiler warnings
  if (false as boolean) {
    console.log(activeTab, setActiveTab, loadingAi);
  }

  const VISIBLE_JOBS_COUNT = 4;
  const SELECTED_JOB_STORAGE_KEY = "candidates.selectedJobId";
  let startIndex = 0;
  if (selectedJob && jobs.length > 0) {
    const idx = jobs.findIndex((j) => j.id === selectedJob.id);
    if (idx !== -1) {
      startIndex = Math.max(0, Math.min(idx, jobs.length - VISIBLE_JOBS_COUNT));
    }
  }

  const visibleJobs = jobs.slice(startIndex, startIndex + VISIBLE_JOBS_COUNT);
  const hiddenJobs = jobs.filter((j) => !visibleJobs.includes(j));
  const currentJobIndex = selectedJob
    ? jobs.findIndex((j) => j.id === selectedJob.id)
    : -1;
  const previousJob = currentJobIndex > 0 ? jobs[currentJobIndex - 1] : null;
  const filteredJobs = jobs.filter((j) =>
    j.title.toLowerCase().includes(jobSearch.toLowerCase()),
  );

  // Fetch initial data: jobs, and panels
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [jobsData, panelsData] = await Promise.all([
          jobService.getJobs(),
          panelService.getPanelMembers(),
        ]);
        setJobs(jobsData);
        setPanels(panelsData);

        if (jobsData.length > 0) {
          const storedJobId = Number(
            typeof window !== "undefined"
              ? window.localStorage.getItem(SELECTED_JOB_STORAGE_KEY)
              : null,
          );
          const jobIdParam = searchParams.get("jobId");
          const storedJob =
            storedJobId && jobsData.some((j) => j.id === storedJobId)
              ? jobsData.find((j) => j.id === storedJobId)
              : null;
          const jobToSelect = jobIdParam
            ? jobsData.find((j) => j.id === parseInt(jobIdParam)) ||
            storedJob ||
            jobsData[0]
            : storedJob || jobsData[0];

          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              SELECTED_JOB_STORAGE_KEY,
              String(jobToSelect.id),
            );
          }

          setSelectedJob(jobToSelect);
          const candidatesData = await candidateService.getCandidatesByJob(
            jobToSelect.id,
          );
          setCandidates(candidatesData);
        }
      } catch (error) {
        console.error("Failed to fetch jobs or panel availability", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [searchParams]);

  // Fetch candidate details, notes, interviews, and similar candidates on selection change
  useEffect(() => {
    if (selectedCandidate) {
      // Load candidate notes
      candidateService
        .getNotes(selectedCandidate.id)
        .then(setNotes)
        .catch(console.error);

      // Load candidate interviews
      setLoadingInterviews(true);
      interviewService
        .getCandidateInterviews(selectedCandidate.id)
        .then(setInterviews)
        .catch((err) => {
          console.error("Failed to load candidate interviews", err);
          setInterviews([]);
        })
        .finally(() => setLoadingInterviews(false));

      // Load similar candidates only if feature is enabled
      if (SHOW_SIMILAR_TALENT) {
        setLoadingSimilar(true);
        candidateService
          .getSimilarCandidates(selectedCandidate.id)
          .then(setSimilarCandidates)
          .catch((err) => {
            console.error("Failed to load similar candidates", err);
            setSimilarCandidates([]);
          })
          .finally(() => setLoadingSimilar(false));
      } else {
        setSimilarCandidates([]);
      }
    } else {
      setNotes([]);
      setInterviews([]);
      setSimilarCandidates([]);
    }
  }, [selectedCandidate]);

  const runAiMatching = async (jobId: number) => {
    setLoadingAi(true);
    try {
      const data = await jobService.getSemanticRecommendations(jobId);

      const updatedCandidates = await Promise.all(
        candidates.map(async (c) => {
          const match = data.recommendations?.find(
            (r: any) => r.candidate_id === c.id,
          );
          const semantic_score = match
            ? match.similarity_score
            : c.semantic_score;

          if (
            match &&
            match.similarity_score > 80.0 &&
            !["Selected", "Rejected", "Interviewing"].includes(c.status)
          ) {
            let updatedStatus = c.status;
            try {
              if (c.status === "Applied") {
                await candidateService.updateStatus(c.id, "Under Review");
              }
              await candidateService.updateStatus(c.id, "Shortlisted");
              updatedStatus = "Shortlisted";
            } catch (e) {
              console.error("Failed to auto-shortlist candidate", c.id, e);
            }
            return { ...c, status: updatedStatus, semantic_score };
          }
          return { ...c, semantic_score };
        }),
      );

      setCandidates(updatedCandidates);

      if (selectedCandidate) {
        const updatedSelected = updatedCandidates.find(
          (c) => c.id === selectedCandidate.id,
        );
        if (updatedSelected) setSelectedCandidate(updatedSelected);
      }
    } catch (error) {
      console.error("Failed to fetch AI matches", error);
    } finally {
      setLoadingAi(false);
    }
  };
  if (false as boolean) {
    console.log(runAiMatching);
  }

  const handleJobChange = async (job: Job) => {
    setSelectedJob(job);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_JOB_STORAGE_KEY, String(job.id));
    }
    setLoading(true);
    try {
      const data = await candidateService.getCandidatesByJob(job.id);
      setCandidates(data);
      setSelectedCandidate(null);
      setNotes([]);
      setInterviews([]);
      setActiveTab("all");
      setCandidateSearch("");
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to fetch candidates", error);
    } finally {
      setLoading(false);
      setIsJobSelectorOpen(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedJob) return;
    setUploading(true);
    try {
      await candidateService.uploadResume(selectedJob.id, e.target.files[0]);
      const data = await candidateService.getCandidatesByJob(selectedJob.id);
      setCandidates(data);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setUploading(false);
    }
  };

  const refreshCandidates = async () => {
    if (!selectedJob) return;
    const data = await candidateService.getCandidatesByJob(selectedJob.id);
    setCandidates(data);
    if (selectedCandidate) {
      const refreshed = data.find((c) => c.id === selectedCandidate.id);
      if (refreshed) setSelectedCandidate(refreshed);
    }
  };

  const handleSyncAssessments = async () => {
    setSyncingAssessments(true);
    setSyncSuccessMessage("");
    try {
      await assessmentService.syncResults();
      setSyncSuccessMessage(`Assessment sync complete`);
      setTimeout(() => setSyncSuccessMessage(""), 5000);
      await refreshCandidates();
    } catch (error: any) {
      console.error("Assessment sync failed", error);
      alert(
        error.response?.data?.detail || "Failed to sync assessment results",
      );
    } finally {
      setSyncingAssessments(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    if (status === "Shortlisted" || status === "Rejected") {
      setFeedbackAction(status === "Shortlisted" ? "SHORTLIST" : "REJECT");
      setRejectionCategory("");
      setFeedbackNotes("");
      setIsFeedbackDialogOpen(true);
      return;
    }

    try {
      const updated = await candidateService.updateStatus(id, status);
      setCandidates(candidates.map((c) => (c.id === id ? updated : c)));
      if (selectedCandidate?.id === id) setSelectedCandidate(updated);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Status update failed");
      console.error("Status update failed", error);
    }
  };

  const handleFeedbackSubmitTelemetry = async () => {
    if (!selectedCandidate) return;
    try {
      const res = await candidateService.submitFeedback(selectedCandidate.id, {
        action_type: feedbackAction,
        rejection_reason_category: rejectionCategory || undefined,
        feedback_notes: feedbackNotes || undefined,
      });

      const targetStatus = feedbackAction === "SHORTLIST" ? "Shortlisted" : "Rejected";
      const updatedCand = res.candidate ? res.candidate : { ...selectedCandidate, status: targetStatus };

      setCandidates(candidates.map((c) => (c.id === selectedCandidate.id ? updatedCand : c)));
      setSelectedCandidate(updatedCand);
      setIsFeedbackDialogOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to submit feedback");
      console.error("Failed to save telemetry feedback", err);
    }
  };

  const handleAddNote = async (comment: string) => {
    if (!selectedCandidate) return;
    try {
      const note = await candidateService.addNote(
        selectedCandidate.id,
        comment,
      );
      setNotes([note, ...notes]);
    } catch (error) {
      console.error("Failed to add note", error);
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

      // Refresh candidate interviews
      const updatedInterviews = await interviewService.getCandidateInterviews(
        selectedCandidate.id,
      );
      setInterviews(updatedInterviews);

      // Refresh candidates list and selectedCandidate details
      if (selectedJob) {
        const updatedCandidates = await candidateService.getCandidatesByJob(
          selectedJob.id,
        );
        setCandidates(updatedCandidates);
        const found = updatedCandidates.find(
          (c) => c.id === selectedCandidate.id,
        );
        if (found) setSelectedCandidate(found);
      }

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

      // Refresh candidate interviews
      const updatedInterviews = await interviewService.getCandidateInterviews(
        selectedCandidate.id,
      );
      setInterviews(updatedInterviews);

      // Refresh candidate list and state
      if (selectedJob) {
        const updatedCandidates = await candidateService.getCandidatesByJob(
          selectedJob.id,
        );
        setCandidates(updatedCandidates);
        const found = updatedCandidates.find(
          (c) => c.id === selectedCandidate.id,
        );
        if (found) setSelectedCandidate(found);
      }

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
      const updatedInterviews = await interviewService.getCandidateInterviews(
        selectedCandidate.id,
      );
      setInterviews(updatedInterviews);

      // Refresh candidate details
      if (selectedJob) {
        const updatedCandidates = await candidateService.getCandidatesByJob(
          selectedJob.id,
        );
        setCandidates(updatedCandidates);
        const found = updatedCandidates.find(
          (c) => c.id === selectedCandidate.id,
        );
        if (found) setSelectedCandidate(found);
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to cancel interview");
      console.error(error);
    }
  };

  const handleClearRejected = async () => {
    if (!selectedJob) return;
    if (
      confirm(
        "Are you sure you want to delete all rejected candidates for this job?",
      )
    ) {
      try {
        await candidateService.clearRejectedCandidates(selectedJob.id);
        setCandidates(candidates.filter((c) => c.status !== "rejected"));
        if (selectedCandidate?.status === "rejected")
          setSelectedCandidate(null);
      } catch (error) {
        console.error("Failed to clear rejected candidates", error);
      }
    }
  };

  const handleExport = async () => {
    if (!selectedJob) return;
    try {
      await candidateService.exportCandidates(selectedJob.id);
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  return (
    <MainLayout>
      {syncSuccessMessage && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          {syncSuccessMessage}
        </div>
      )}
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        {/* Left List */}
        <div className="flex w-[40%] min-w-0 max-w-[520px] flex-col border-r border-slate-200 bg-white">
          <div className="p-6 border-b border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Candidates
                  </h1>
                </div>
                <p className="text-sm text-slate-500">
                  Manage incoming applicants
                </p>
              </div>
              <div className="relative flex gap-2">
                {candidates.some((c) => c.status === "rejected") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-red-200 text-red-600 hover:bg-red-50"
                    onClick={handleClearRejected}
                    disabled={!selectedJob}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Rejected
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={handleExport}
                  disabled={!selectedJob || candidates.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <input
                  type="file"
                  id="resume-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading || !selectedJob}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    document.getElementById("resume-upload")?.click()
                  }
                  disabled={uploading || !selectedJob}
                >
                  <Upload className="mr-2 h-4 w-4" />{" "}
                  {uploading ? "Processing..." : "Upload Resume"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pb-2 max-w-full">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <button
                  type="button"
                  aria-label="View previous job"
                  onClick={() => previousJob && handleJobChange(previousJob)}
                  disabled={!previousJob}
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-full border text-xs font-medium transition-all flex items-center justify-center",
                    previousJob
                      ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      : "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed",
                  )}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {visibleJobs.slice(0, 2).map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleJobChange(job)}
                    className={cn(
                      "w-full min-w-0 truncate whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      selectedJob?.id === job.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent",
                    )}
                    title={job.title}
                  >
                    {job.title}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                {visibleJobs.slice(2, 4).map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleJobChange(job)}
                    className={cn(
                      "w-full min-w-0 truncate whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      selectedJob?.id === job.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent",
                    )}
                    title={job.title}
                  >
                    {job.title}
                  </button>
                ))}

                {hiddenJobs.length > 0 && (
                  <Dialog
                    open={isJobSelectorOpen}
                    onOpenChange={setIsJobSelectorOpen}
                  >
                    <DialogTrigger asChild>
                      <button className="h-8 w-8 shrink-0 rounded-full border text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all border-slate-200 flex items-center justify-center">
                        +{hiddenJobs.length}
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] w-full max-h-[70vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>Select Job</DialogTitle>
                      </DialogHeader>
                      <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                          type="text"
                          placeholder="Search jobs by title..."
                          className="pl-9 bg-slate-50 border-slate-200"
                          value={jobSearch}
                          onChange={(e) => setJobSearch(e.target.value)}
                        />
                      </div>
                      <div
                        className="overflow-y-auto pb-2 min-w-[300px] flex-1 min-h-0"
                        style={{
                          columnCount: Math.max(1, Math.ceil(jobs.length / 5)),
                          columnGap: "0.75rem",
                          columnFill: "balance",
                        }}
                      >
                        {filteredJobs.length === 0 ? (
                          <div className="text-center text-slate-500 py-8 text-sm">
                            No jobs found matching your search.
                          </div>
                        ) : (
                          <TooltipProvider>
                            {filteredJobs.map((job) => (
                              <Tooltip key={job.id}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleJobChange(job)}
                                    className={cn(
                                      "text-left px-4 py-3 rounded-lg text-sm font-medium transition-all border w-full mb-3 break-inside-avoid inline-block",
                                      selectedJob?.id === job.id
                                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                                    )}
                                  >
                                    <div className="truncate">{job.title}</div>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{job.title}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </TooltipProvider>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100 flex items-center bg-slate-50/50">
            <div className="flex items-center gap-2 w-full min-w-0">
              <SearchInput
                value={candidateSearch}
                onChange={(val) => {
                  setCandidateSearch(val);
                  setCurrentPage(1);
                }}
                placeholder="Search candidates..."
                className="flex-1 min-w-0"
              />

              <Select
                value={assessmentStatusFilter}
                onValueChange={(val) => {
                  setAssessmentStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] shrink-0 bg-white border-slate-200 h-9">
                  <SelectValue placeholder="Assessment Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assessments</SelectItem>
                  <SelectItem value="awaiting">Awaiting Attempt</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={handleSyncAssessments}
                disabled={syncingAssessments}
                title="Sync Assessment Results"
              >
                {syncingAssessments ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
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
                    const filtered = candidates.filter((c) => {
                      const matchesSearch =
                        c.full_name
                          .toLowerCase()
                          .includes(candidateSearch.toLowerCase()) ||
                        c.email
                          .toLowerCase()
                          .includes(candidateSearch.toLowerCase());

                      let matchesAssessment = true;
                      if (assessmentStatusFilter === "passed") {
                        matchesAssessment = c.assessment_status === "PASSED";
                      } else if (assessmentStatusFilter === "failed") {
                        matchesAssessment = c.assessment_status === "FAILED";
                      } else if (assessmentStatusFilter === "awaiting") {
                        matchesAssessment = [
                          "ASSIGNED",
                          "IN_PROGRESS",
                        ].includes(c.assessment_status || "");
                      }

                      return matchesSearch && matchesAssessment;
                    });
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
            totalPages={Math.ceil(
              candidates.filter((c) => {
                const matchesSearch =
                  c.full_name
                    .toLowerCase()
                    .includes(candidateSearch.toLowerCase()) ||
                  c.email.toLowerCase().includes(candidateSearch.toLowerCase());

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

                return matchesSearch && matchesAssessment;
              }).length / itemsPerPage,
            )}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right Details Workspace */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/30 overflow-hidden">
          {selectedCandidate ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedCandidate.full_name}
                  </h2>
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

                  {/* Assessment Information */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Assessment Information
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Assessment Status
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0",
                            getAssessmentStatusColor(
                              selectedCandidate.assessment_status ||
                              "NOT_ASSIGNED",
                            ),
                          )}
                        >
                          {formatAssessmentStatus(
                            selectedCandidate.assessment_status ||
                            "NOT_ASSIGNED",
                          )}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Assessment Score
                        </p>
                        <p className="font-semibold text-slate-900">
                          {formatAssessmentScore(
                            selectedCandidate.assessment_score,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Assessment Percentage
                        </p>
                        <p className="font-semibold text-slate-900">
                          {formatAssessmentPercentage(
                            selectedCandidate.assessment_percentage,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Assigned At
                        </p>
                        <p className="font-medium text-slate-800">
                          {formatAssessmentDate(
                            selectedCandidate.assessment_assigned_at,
                          )}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500 mb-1">
                          Completed At
                        </p>
                        <p className="font-medium text-slate-800">
                          {formatAssessmentDate(
                            selectedCandidate.assessment_completed_at,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

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

                  {/* Recruiter Intelligence Dashboard */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 bg-slate-50/50 p-4 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-indigo-500 animate-pulse" />
                        <h4 className="text-sm font-bold text-slate-800">
                          AI Recruiter
                        </h4>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setIntelTab("gaps")}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                            intelTab === "gaps"
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                          )}
                        >
                          <Target className="h-3.5 w-3.5" /> Skill Gaps
                        </button>
                        <button
                          onClick={() => setIntelTab("profiler")}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                            intelTab === "profiler"
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                          )}
                        >
                          <Brain className="h-3.5 w-3.5" /> Candidate Profiler
                        </button>
                        <button
                          onClick={() => setIntelTab("interview")}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                            intelTab === "interview"
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                          )}
                        >
                          <AlertCircle className="h-3.5 w-3.5" /> Interview
                          Playbook
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      {intelTab === "gaps" && (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-500 mb-2">
                            SKILL GAP ANALYSIS:
                          </div>
                          {selectedCandidate.match_signals
                            ?.skill_gap_analysis &&
                            selectedCandidate.match_signals.skill_gap_analysis
                              .length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                              {selectedCandidate.match_signals.skill_gap_analysis.map(
                                (gap: any, i: number) => (
                                  <div
                                    key={i}
                                    className="p-3.5 border border-slate-100 rounded-xl bg-slate-50/50 space-y-1.5 shadow-sm"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="font-bold text-slate-800 text-xs">
                                        {gap.skill}
                                      </div>
                                      <Badge
                                        className={cn(
                                          "text-[9px] font-extrabold uppercase px-2 py-0 border",
                                          gap.severity === "Critical"
                                            ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-50"
                                            : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-50",
                                        )}
                                      >
                                        {gap.severity}
                                      </Badge>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed">
                                      {gap.reason}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                              <CheckCircle2 className="h-8 w-8 text-green-500 mb-2 animate-bounce" />
                              <h5 className="font-bold text-xs text-slate-800">
                                100% Skill Match Alignment!
                              </h5>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                This profile covers all required and preferred
                                technologies in the JD.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {intelTab === "profiler" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 border border-green-150 rounded-xl bg-green-50/20 space-y-3">
                              <div className="text-xs font-bold text-green-700 flex items-center gap-1.5 uppercase">
                                <CheckCircle2 className="h-4 w-4" /> Strengths
                              </div>
                              <ul className="space-y-2">
                                {selectedCandidate.match_signals?.strengths &&
                                  selectedCandidate.match_signals.strengths
                                    .length > 0
                                  ? selectedCandidate.match_signals.strengths.map(
                                    (str: string, i: number) => (
                                      <li
                                        key={i}
                                        className="text-slate-700 text-xs flex items-start leading-relaxed"
                                      >
                                        <span className="text-green-500 mr-2 font-bold shrink-0">
                                          •
                                        </span>
                                        <span>{str}</span>
                                      </li>
                                    ),
                                  )
                                  : selectedCandidate.score_breakdown?.strengths
                                    ?.slice(0, 3)
                                    .map((s: string, i: number) => (
                                      <li
                                        key={i}
                                        className="text-slate-700 text-xs flex items-start leading-relaxed"
                                      >
                                        <span className="text-green-500 mr-2 font-bold shrink-0">
                                          •
                                        </span>
                                        <span>{s}</span>
                                      </li>
                                    )) || (
                                    <li className="text-slate-400 text-xs italic">
                                      No specific strengths computed
                                    </li>
                                  )}
                              </ul>
                            </div>

                            <div className="p-4 border border-slate-150 rounded-xl bg-slate-50/20 space-y-3">
                              <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase">
                                <AlertTriangle className="h-4 w-4 text-slate-400" />{" "}
                                Weaknesses
                              </div>
                              <ul className="space-y-2">
                                {selectedCandidate.match_signals?.weaknesses &&
                                  selectedCandidate.match_signals.weaknesses
                                    .length > 0
                                  ? selectedCandidate.match_signals.weaknesses.map(
                                    (weak: string, i: number) => (
                                      <li
                                        key={i}
                                        className="text-slate-600 text-xs flex items-start leading-relaxed italic"
                                      >
                                        <span className="text-slate-400 mr-2 font-bold shrink-0">
                                          •
                                        </span>
                                        <span>{weak}</span>
                                      </li>
                                    ),
                                  )
                                  : selectedCandidate.score_breakdown?.weaknesses
                                    ?.slice(0, 3)
                                    .map((w: string, i: number) => (
                                      <li
                                        key={i}
                                        className="text-slate-600 text-xs flex items-start leading-relaxed italic"
                                      >
                                        <span className="text-slate-400 mr-2 font-bold shrink-0">
                                          •
                                        </span>
                                        <span>{w}</span>
                                      </li>
                                    )) || (
                                    <li className="text-slate-400 text-xs italic">
                                      No specific gaps computed
                                    </li>
                                  )}
                              </ul>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              Technical Skills
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedCandidate.skills
                                .split(",")
                                .map((s, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 text-[10px] font-medium px-2 py-0.5"
                                  >
                                    {s.trim()}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {intelTab === "interview" && (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-500 mb-2">
                            ACTIONABLE PLAYBOOK QUESTIONNAIRE:
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {selectedCandidate.match_signals
                              ?.interview_focus_areas &&
                              selectedCandidate.match_signals
                                .interview_focus_areas.length > 0 ? (
                              selectedCandidate.match_signals.interview_focus_areas.map(
                                (focus: string, i: number) => (
                                  <div
                                    key={i}
                                    className="p-3.5 border border-indigo-100 rounded-xl bg-indigo-50/10 flex items-start gap-3 shadow-sm"
                                  >
                                    <Target className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                      <div className="font-bold text-indigo-900 text-xs">
                                        Recommended Question Round Focus
                                      </div>
                                      <p className="text-slate-700 text-xs leading-relaxed">
                                        {focus}
                                      </p>
                                    </div>
                                  </div>
                                ),
                              )
                            ) : (
                              <div className="p-3.5 border border-indigo-100 rounded-xl bg-indigo-50/10 flex items-start gap-3 shadow-sm">
                                <Target className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <div className="font-bold text-indigo-900 text-xs">
                                    Architectural Design Playbook
                                  </div>
                                  <p className="text-slate-700 text-xs leading-relaxed">
                                    Focus on complex project lifecycle
                                    architectures, team collaboration
                                    methodologies, and domain integration
                                    patterns.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Similar Talent Section (hidden behind feature flag) */}
                  {SHOW_SIMILAR_TALENT && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center">
                            <Brain className="h-4 w-4 mr-2 text-indigo-500" />{" "}
                            Similar Talent Recommendations
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            AI-powered passive sourcing from internal talent
                            database.
                          </p>
                        </div>
                      </div>
                      {loadingSimilar ? (
                        <div className="text-center py-4 text-xs text-slate-400 animate-pulse">
                          Computing similar profiles...
                        </div>
                      ) : similarCandidates.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-400">
                          No similar candidates in database.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {similarCandidates.map((sim) => (
                            <div
                              key={sim.id}
                              onClick={() => setSelectedCandidate(sim)}
                              className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all cursor-pointer flex justify-between items-center group shadow-sm"
                            >
                              <div>
                                <div className="font-semibold text-xs text-slate-800 group-hover:text-indigo-900 truncate max-w-[160px]">
                                  {sim.full_name}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]">
                                  {sim.job_title || "Candidate"}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="bg-indigo-50/60 border-indigo-100 text-indigo-700 text-[9px] font-bold py-0 px-1.5"
                                >
                                  {sim.semantic_score
                                    ? `${Math.round(sim.semantic_score)}%`
                                    : "N/A"}
                                </Badge>
                                <ChevronRight className="h-3 w-3 text-slate-350 group-hover:text-indigo-500 transition-all" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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

                  {/* Internal Recruiter Notes Component */}
                  <CandidateNotesPanel
                    notes={notes}
                    onAddNote={handleAddNote}
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
                <Users className="h-12 w-12 mx-auto mb-4 opacity-20 text-slate-600" />
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
        recommendedPanelIds={recommendedPanelIds}
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
              telemetry feedback for {selectedCandidate?.full_name}'s{" "}
              {feedbackAction === "SHORTLIST" ? "Shortlist" : "Rejection"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {feedbackAction === "REJECT" && (
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
            )}
            {feedbackAction === "SHORTLIST" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  Shortlist Strength Area
                </label>
                <select
                  value={rejectionCategory}
                  onChange={(e) => setRejectionCategory(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                  <option value="">
                    -- Select a Core Strength (Optional) --
                  </option>
                  <option value="Strong domain match and certifications">
                    Strong domain match and certifications
                  </option>
                  <option value="Excellent hands-on project portfolio">
                    Excellent hands-on project portfolio
                  </option>
                  <option value="Highly relevant past organizational experience">
                    Highly relevant past organizational experience
                  </option>
                  <option value="Outstanding cultural and communication fit">
                    Outstanding cultural and communication fit
                  </option>
                </select>
              </div>
            )}
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

export default CandidatesPage;
