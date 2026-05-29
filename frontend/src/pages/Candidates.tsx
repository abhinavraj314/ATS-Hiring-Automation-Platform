import React, { useEffect, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { Upload, ChevronRight, FileText, Users, Trash2, Search, Download, AlertTriangle } from "lucide-react";
import {
  Table,
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
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { candidateService } from "@/services/candidates";
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

const ResumeViewer = ({ candidateId }: { candidateId: number }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    candidateService.getResumeBlobUrl(candidateId)
      .then(blobUrl => {
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
        <a href={url} download="resume.pdf" className="text-blue-500 underline mt-2">Download PDF instead</a>
      </div>
    </object>
  );
};

const CandidatesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");



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
      .filter(p => {
        const interviewFor = p.interview_for || "";
        const matchesJob = jobTitle && interviewFor.toLowerCase().includes(jobTitle.toLowerCase());
        const matchesSkill = skills && skills.toLowerCase().includes(interviewFor.toLowerCase());
        return matchesJob || matchesSkill;
      })
      .map(p => p.id);
  }, [selectedCandidate, selectedJob, panels]);

  // Modal Open/Close triggers
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedInterviewForFeedback, setSelectedInterviewForFeedback] = useState<Interview | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "ai">("all");
  const [loadingAi, setLoadingAi] = useState(false);

  // Pagination & Search
  const [candidateSearch, setCandidateSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Selected': return "border-green-200 bg-green-50 text-green-700";
      case 'Rejected': return "border-red-200 bg-red-50 text-red-700";
      case 'Shortlisted': return "border-blue-200 bg-blue-50 text-blue-700";
      case 'Interview Scheduled':
      case 'Interviewed': return "border-purple-200 bg-purple-50 text-purple-700";
      case 'Under Review': return "border-amber-200 bg-amber-50 text-amber-700";
      default: return "border-slate-200 bg-slate-50 text-slate-600";
    }
  };

  const VISIBLE_JOBS_COUNT = 3;
  let startIndex = 0;
  if (selectedJob && jobs.length > 0) {
    const idx = jobs.findIndex(j => j.id === selectedJob.id);
    if (idx !== -1) {
      startIndex = Math.max(0, Math.min(idx, jobs.length - VISIBLE_JOBS_COUNT));
    }
  }

  const visibleJobs = jobs.slice(startIndex, startIndex + VISIBLE_JOBS_COUNT);
  const hiddenJobs = jobs.filter(j => !visibleJobs.includes(j));
  const filteredJobs = jobs.filter(j => j.title.toLowerCase().includes(jobSearch.toLowerCase()));

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
          const jobIdParam = searchParams.get("jobId");
          const jobToSelect = jobIdParam
            ? jobsData.find(j => j.id === parseInt(jobIdParam)) || jobsData[0]
            : jobsData[0];

          setSelectedJob(jobToSelect);
          const candidatesData = await candidateService.getCandidatesByJob(jobToSelect.id);
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

  // Fetch candidate details, notes and interviews on selection change
  useEffect(() => {
    if (selectedCandidate) {
      // Load candidate notes
      candidateService.getNotes(selectedCandidate.id).then(setNotes).catch(console.error);

      // Load candidate interviews
      setLoadingInterviews(true);
      interviewService.getCandidateInterviews(selectedCandidate.id)
        .then(setInterviews)
        .catch(err => {
          console.error("Failed to load candidate interviews", err);
          setInterviews([]);
        })
        .finally(() => setLoadingInterviews(false));
    } else {
      setNotes([]);
      setInterviews([]);
    }
  }, [selectedCandidate]);

  const runAiMatching = async (jobId: number) => {
    setLoadingAi(true);
    try {
      const data = await jobService.getSemanticRecommendations(jobId);
      
      const updatedCandidates = await Promise.all(candidates.map(async c => {
        const match = data.recommendations?.find((r: any) => r.candidate_id === c.id);
        const semantic_score = match ? match.similarity_score : c.semantic_score;
        
        if (match && match.similarity_score > 80.0 && !["Selected", "Rejected", "Interviewing"].includes(c.status)) {
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
      }));

      setCandidates(updatedCandidates);
      
      if (selectedCandidate) {
        const updatedSelected = updatedCandidates.find(c => c.id === selectedCandidate.id);
        if (updatedSelected) setSelectedCandidate(updatedSelected);
      }
      
    } catch (error) {
      console.error("Failed to fetch AI matches", error);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleJobChange = async (job: Job) => {
    setSelectedJob(job);
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

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      const updated = await candidateService.updateStatus(id, status);
      setCandidates(candidates.map(c => c.id === id ? updated : c));
      if (selectedCandidate?.id === id) setSelectedCandidate(updated);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Status update failed");
      console.error("Status update failed", error);
    }
  };

  const handleAddNote = async (comment: string) => {
    if (!selectedCandidate) return;
    try {
      const note = await candidateService.addNote(selectedCandidate.id, comment);
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
        const selectedPanel = panels.find(p => p.id === data.panelId);
        const availableSlots = selectedPanel?.availabilities || [];
        const slot = availableSlots.find(s => s.id === data.slotId);
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
      const updatedInterviews = await interviewService.getCandidateInterviews(selectedCandidate.id);
      setInterviews(updatedInterviews);

      // Refresh candidates list and selectedCandidate details
      if (selectedJob) {
        const updatedCandidates = await candidateService.getCandidatesByJob(selectedJob.id);
        setCandidates(updatedCandidates);
        const found = updatedCandidates.find(c => c.id === selectedCandidate.id);
        if (found) setSelectedCandidate(found);
      }

      setIsScheduleOpen(false);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to schedule interview");
      console.error(error);
    }
  };

  const handleFeedbackSubmit = async (outcome: string, feedbackNotes: string) => {
    if (!selectedCandidate || !selectedInterviewForFeedback) return;
    try {
      await interviewService.updateInterview(selectedInterviewForFeedback.id, {
        status: "Completed",
        outcome: outcome,
        feedback_notes: feedbackNotes,
      });

      // Refresh candidate interviews
      const updatedInterviews = await interviewService.getCandidateInterviews(selectedCandidate.id);
      setInterviews(updatedInterviews);

      // Refresh candidate list and state
      if (selectedJob) {
        const updatedCandidates = await candidateService.getCandidatesByJob(selectedJob.id);
        setCandidates(updatedCandidates);
        const found = updatedCandidates.find(c => c.id === selectedCandidate.id);
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
      const updatedInterviews = await interviewService.getCandidateInterviews(selectedCandidate.id);
      setInterviews(updatedInterviews);

      // Refresh candidate details
      if (selectedJob) {
        const updatedCandidates = await candidateService.getCandidatesByJob(selectedJob.id);
        setCandidates(updatedCandidates);
        const found = updatedCandidates.find(c => c.id === selectedCandidate.id);
        if (found) setSelectedCandidate(found);
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to cancel interview");
      console.error(error);
    }
  };

  const handleClearRejected = async () => {
    if (!selectedJob) return;
    if (confirm("Are you sure you want to delete all rejected candidates for this job?")) {
      try {
        await candidateService.clearRejectedCandidates(selectedJob.id);
        setCandidates(candidates.filter(c => c.status !== 'rejected'));
        if (selectedCandidate?.status === 'rejected') setSelectedCandidate(null);
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
      <div className="flex h-[calc(100vh-0px)] overflow-hidden">
        {/* Left List */}
        <div className="flex w-[45%] flex-col border-r border-slate-200 bg-white">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-slate-900">Candidates</h1>
              <div className="relative flex gap-2">
                {candidates.some(c => c.status === 'rejected') && (
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
                  onClick={() => document.getElementById('resume-upload')?.click()}
                  disabled={uploading || !selectedJob}
                >
                  <Upload className="mr-2 h-4 w-4" /> {uploading ? "Processing..." : "Upload Resume"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pb-2">
              {visibleJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => handleJobChange(job)}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    selectedJob?.id === job.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                  )}
                >
                  {job.title}
                </button>
              ))}

              {hiddenJobs.length > 0 && (
                <Dialog open={isJobSelectorOpen} onOpenChange={setIsJobSelectorOpen}>
                  <DialogTrigger asChild>
                    <button className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all border border-slate-200">
                      +{hiddenJobs.length}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px] w-full">
                    <DialogHeader>
                      <DialogTitle>Select Job</DialogTitle>
                    </DialogHeader>
                    <div className="relative mt-2">
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
                      className="mt-4 overflow-x-auto pb-2 min-h-[260px] min-w-[300px]"
                      style={{
                        columnCount: Math.max(1, Math.ceil(jobs.length / 5)),
                        columnGap: '0.75rem',
                        columnFill: 'balance'
                      }}
                    >
                      {filteredJobs.length === 0 ? (
                        <div className="text-center text-slate-500 py-8 text-sm">No jobs found matching your search.</div>
                      ) : (
                        filteredJobs.map(job => (
                          <button
                            key={job.id}
                            onClick={() => handleJobChange(job)}
                            className={cn(
                              "text-left px-4 py-3 rounded-lg text-sm font-medium transition-all border w-full mb-3 break-inside-avoid inline-block",
                              selectedJob?.id === job.id
                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <div className="truncate">{job.title}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <SearchInput 
              value={candidateSearch}
              onChange={(val) => { setCandidateSearch(val); setCurrentPage(1); }}
              placeholder="Search candidates..."
              className="w-full max-w-[280px]"
            />
          </div>

          <ScrollArea className="flex-1">
              <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Candidate</TableHead>
                  <TableHead>Match Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : candidates.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">No candidates found for this job.</TableCell></TableRow>
                ) : (() => {
                  const filtered = candidates.filter(c => 
                    c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) || 
                    c.email.toLowerCase().includes(candidateSearch.toLowerCase())
                  );
                  const totalPages = Math.ceil(filtered.length / itemsPerPage);
                  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                  
                  if (filtered.length === 0) {
                    return <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">No matching candidates.</TableCell></TableRow>;
                  }
                  
                  return paginated.map(candidate => (
                    <TableRow
                      key={candidate.id}
                      className={cn(
                        "cursor-pointer",
                        selectedCandidate?.id === candidate.id ? "bg-slate-50" : "hover:bg-slate-50/50"
                      )}
                      onClick={() => setSelectedCandidate(candidate)}
                    >
                      <TableCell>
                        <div className="font-medium text-slate-900">{candidate.full_name}</div>
                        <div className="text-xs text-slate-500">{candidate.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-bold",
                            (candidate.semantic_score || 0) >= 80 ? "text-green-600" : (candidate.semantic_score || 0) >= 60 ? "text-amber-600" : "text-slate-600"
                          )}>
                            {candidate.semantic_score ? `${Math.round(candidate.semantic_score)}%` : "N/A"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "capitalize text-[10px] font-bold px-2 py-0",
                          getStatusColor(candidate.status)
                        )}>
                          {candidate.status}
                        </Badge>
                      </TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-slate-300" /></TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
              </Table>
          </ScrollArea>
          
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(candidates.filter(c => 
              c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) || 
              c.email.toLowerCase().includes(candidateSearch.toLowerCase())
            ).length / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right Details Workspace */}
        <div className="flex-1 bg-slate-50/30 overflow-hidden">
          {selectedCandidate ? (
            <div className="flex flex-col h-full">
              <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedCandidate.full_name}</h2>
                  <p className="text-sm text-slate-500">{selectedCandidate.email} • {selectedCandidate.phone || "No phone"}</p>
                </div>
              </div>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6 max-w-3xl mx-auto pb-10">
                  {/* Reapplication Alert Banner */}
                  {(selectedCandidate as any).reapplication_details && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                      <div className="mt-0.5"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                      <div>
                        <h4 className="font-semibold text-sm">Reapplication Detected</h4>
                        <p className="text-xs text-amber-800 mt-1">
                          This candidate previously applied for <strong>{(selectedCandidate as any).reapplication_details.job_title}</strong> 
                          (Status: {(selectedCandidate as any).reapplication_details.status}).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Candidate Workflow Stepper */}
                  <CandidateStageStepper
                    currentStatus={selectedCandidate.status}
                    onStatusUpdate={(status) => handleStatusUpdate(selectedCandidate.id, status)}
                    canSelect={interviews.some(i => i.round_type === "FINAL" && i.outcome === "Pass")}
                  />

                  {/* Matching Analysis & Experience */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col justify-between">
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Matching Analysis</h3>
                        <div className="flex items-end gap-3 mb-4">
                          <div className="text-3xl font-extrabold text-slate-900">{selectedCandidate.semantic_score ? `${Math.round(selectedCandidate.semantic_score)}%` : "0%"}</div>
                          <div className="text-xs text-slate-500 pb-0.5">Semantic Fit Score</div>
                        </div>
                      </div>
                      <Progress value={selectedCandidate.semantic_score || 0} className="h-2 bg-indigo-600" />
                    </div>
                    
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Work Experience</h3>
                      <div className="text-2xl font-bold text-slate-900">{selectedCandidate.experience_years} Years</div>
                      <p className="text-[10px] text-slate-400 mt-1">Calculated from resume history</p>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses / Skills */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Semantic Explainer</h4>
                      <div className="space-y-1.5">
                        {selectedCandidate.match_signals?.matched_skills && selectedCandidate.match_signals.matched_skills.length > 0 ? (
                          <>
                            <div className="text-xs text-indigo-700 font-semibold mb-2">Key Domain Matches Found:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedCandidate.match_signals.matched_skills.map((sig: string, i: number) => (
                                <span key={i} className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] px-2 py-0.5 rounded">
                                  {sig}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            {selectedCandidate.score_breakdown.strengths.slice(0, 3).map((s, i) => (
                              <div key={i} className="text-xs text-slate-600 flex items-start">
                                <span className="mr-2 mt-1.5 h-1 w-1 rounded-full bg-slate-800 shrink-0" />
                                <span>{s}</span>
                              </div>
                            ))}
                            {selectedCandidate.score_breakdown.weaknesses.slice(0, 2).map((w, i) => (
                              <div key={i} className="text-xs text-slate-500 flex items-start italic">
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
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Extracted Skills</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCandidate.skills.split(",").slice(0, 8).map((s, i) => (
                            <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-medium text-[10px] px-2 py-0.5 border border-slate-150">
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

                  {/* Internal Recruiter Notes Component */}
                  <CandidateNotesPanel
                    notes={notes}
                    onAddNote={handleAddNote}
                  />

                  {/* Original Resume Document Viewer Block */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-slate-400" /> Resume Document
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Review the raw parsed candidate application file.</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 text-xs font-medium">
                          View Resume
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-full h-[85vh] p-0 overflow-hidden bg-white/95 border border-slate-200 rounded-xl flex flex-col">
                        <DialogHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
                          <DialogTitle className="text-slate-900">{selectedCandidate.full_name}'s Resume</DialogTitle>
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
                <p className="text-sm font-medium">Select a candidate to load operational workspace</p>
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
    </MainLayout>
  );
};

export default CandidatesPage;
