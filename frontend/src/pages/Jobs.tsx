import React, { useEffect, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  FileUp,
  Loader2,
  Pencil,
  X,
  Briefcase,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { jobService } from "@/services/jobs";
import type { AssessmentTemplate, Job, JobCreate } from "@/types/job";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/shared/SearchInput";
import { PaginationControls } from "@/components/shared/PaginationControls";

const ASSESSMENT_TEMPLATE_OPTIONS: {
  value: AssessmentTemplate;
  label: string;
}[] = [
    { value: "POWER_PLATFORM", label: "Power Platform Assessment" },
    { value: "ORACLE_EPM", label: "Oracle EPM Assessment" },
    { value: "SQL", label: "SQL Developer Assessment" },
  ];

const JobsPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newJob, setNewJob] = useState<JobCreate>({
    title: "",
    description: "",
    required_skills: "",
    min_experience: 0,
    assessment_required: false,
    assessment_template: null,
    passing_score: 70,
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [jobSearch, setJobSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Advanced Filtering States (Applied Filters)
  const [selectedExperience, setSelectedExperience] = useState<string>("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedDatePosted, setSelectedDatePosted] = useState<string>("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  // Temporary Filter States (used while modal is open)
  const [tempExperience, setTempExperience] = useState<string>("");
  const [tempSkills, setTempSkills] = useState<string[]>([]);
  const [tempDatePosted, setTempDatePosted] = useState<string>("");
  const [skillsSearch, setSkillsSearch] = useState("");

  const uniqueSkillsList = React.useMemo(() => {
    const allSkills = new Set<string>();
    jobs.forEach((job) => {
      if (job.required_skills) {
        job.required_skills.split(",").forEach((s) => {
          const trimmed = s.trim();
          if (trimmed) allSkills.add(trimmed);
        });
      }
    });
    return Array.from(allSkills).sort();
  }, [jobs]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (selectedExperience) count++;
    if (selectedSkills.length > 0) count++;
    if (selectedDatePosted) count++;
    return count;
  }, [selectedExperience, selectedSkills, selectedDatePosted]);

  const handleClearAllFilters = () => {
    setSelectedExperience("");
    setSelectedSkills([]);
    setSelectedDatePosted("");
  };

  const handleApplyFilters = () => {
    setSelectedExperience(tempExperience);
    setSelectedSkills(tempSkills);
    setSelectedDatePosted(tempDatePosted);
    setIsFilterDialogOpen(false);
  };

  const handleCloseFilterDialog = (open: boolean) => {
    if (!open) {
      // Reset temp states to current applied filters
      setTempExperience(selectedExperience);
      setTempSkills(selectedSkills);
      setTempDatePosted(selectedDatePosted);
      setSkillsSearch("");
    } else {
      // Initialize temp states from applied filters when opening
      setTempExperience(selectedExperience);
      setTempSkills(selectedSkills);
      setTempDatePosted(selectedDatePosted);
      setSkillsSearch("");
    }
    setIsFilterDialogOpen(open);
  };

  const fetchJobs = async () => {
    try {
      const data = await jobService.getJobs();
      setJobs(data);
    } catch (error) {
      console.error("Failed to fetch jobs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleJDParse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setParsing(true);
    setCreateError("");
    try {
      const parsedData = await jobService.parseJD(e.target.files[0]);
      setNewJob({
        ...newJob,
        title: parsedData.title || newJob.title,
        description: parsedData.description || newJob.description,
        required_skills: parsedData.required_skills || newJob.required_skills,
        min_experience: parsedData.min_experience || newJob.min_experience,
        preferred_skills: parsedData.preferred_skills,
        raw_jd_text: parsedData.raw_jd_text,
      });
      const parsedSkills = parsedData.required_skills
        ? parsedData.required_skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        : [];
      setSkills((prev) => [...new Set([...prev, ...parsedSkills])]);
    } catch (error) {
      console.error("Failed to parse JD", error);
      setCreateError(
        "Failed to auto-fill from JD. Please enter details manually.",
      );
    } finally {
      setParsing(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleAddSkill = () => {
    if (newSkillInput.trim() && !skills.includes(newSkillInput.trim())) {
      setSkills([...skills, newSkillInput.trim()]);
      setNewSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateError("");
    try {
      const finalJobData = {
        ...newJob,
        required_skills: skills.join(", "),
        assessment_template: newJob.assessment_required
          ? newJob.assessment_template
          : null,
      };
      if (isEditing && editingJobId) {
        await jobService.updateJob(editingJobId, finalJobData);
      } else {
        await jobService.createJob(finalJobData);
      }
      setIsDialogOpen(false);
      await fetchJobs();
    } catch (error: any) {
      console.error("Failed to save job", error);
      setCreateError(
        error.response?.data?.detail || "Failed to save job. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClick = () => {
    setIsEditing(false);
    setEditingJobId(null);
    setNewJob({
      title: "",
      description: "",
      required_skills: "",
      min_experience: 0,
      assessment_required: false,
      assessment_template: null,
      passing_score: 70,
    });
    setSkills([]);
    setNewSkillInput("");
    setIsDialogOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingJobId(job.id);
    setNewJob({
      title: job.title,
      description: job.description,
      required_skills: job.required_skills,
      min_experience: job.min_experience,
      preferred_skills: job.preferred_skills,
      raw_jd_text: job.raw_jd_text,
      assessment_required: job.assessment_required ?? false,
      assessment_template: job.assessment_template ?? null,
      passing_score: job.passing_score ?? 70,
    });
    setSkills(
      job.required_skills
        ? job.required_skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        : [],
    );
    setNewSkillInput("");
    setIsDialogOpen(true);
  };

  const handleDeleteJob = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (
      !confirm(
        "Are you sure you want to delete this job and all its candidates?",
      )
    )
      return;
    try {
      await jobService.deleteJob(id);
      fetchJobs();
    } catch (error) {
      console.error("Failed to delete job", error);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
      (job.required_skills &&
        job.required_skills.toLowerCase().includes(jobSearch.toLowerCase()));

    let matchesExperience = true;
    if (selectedExperience === "entry") {
      matchesExperience = job.min_experience <= 2;
    } else if (selectedExperience === "mid") {
      matchesExperience = job.min_experience > 2 && job.min_experience <= 5;
    } else if (selectedExperience === "senior") {
      matchesExperience = job.min_experience > 5;
    }

    let matchesSkills = true;
    if (selectedSkills.length > 0) {
      const jobSkillsList = job.required_skills
        ? job.required_skills.split(",").map((s) => s.trim().toLowerCase())
        : [];
      matchesSkills = selectedSkills.every((skill) =>
        jobSkillsList.includes(skill.toLowerCase()),
      );
    }

    let matchesDate = true;
    if (selectedDatePosted) {
      const jobDate = new Date(job.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - jobDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (selectedDatePosted === "today") {
        matchesDate = diffDays <= 1;
      } else if (selectedDatePosted === "week") {
        matchesDate = diffDays <= 7;
      } else if (selectedDatePosted === "month") {
        matchesDate = diffDays <= 30;
      }
    }

    return matchesSearch && matchesExperience && matchesSkills && matchesDate;
  });

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <MainLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-slate-700" /> Jobs
            </h1>
            <p className="text-slate-500">Manage active job openings</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-slate-900 hover:bg-slate-800"
                onClick={handleCreateClick}
              >
                <Plus className="mr-2 h-4 w-4" /> Create Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
              <DialogHeader className="p-6 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>
                      {isEditing ? "Edit Job Opening" : "Create Job Opening"}
                    </DialogTitle>
                    <DialogDescription>
                      {isEditing
                        ? "Modify the details for this job position."
                        : "Enter the details for the new job position."}
                    </DialogDescription>
                  </div>
                  <div>
                    <input
                      type="file"
                      id="jd-upload"
                      className="hidden"
                      onChange={handleJDParse}
                      accept=".pdf,.docx,.txt"
                      disabled={submitting || parsing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("jd-upload")?.click()
                      }
                      disabled={submitting || parsing}
                      className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-medium"
                    >
                      {parsing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileUp className="mr-2 h-4 w-4" />
                      )}
                      {parsing ? "Parsing..." : "Auto-fill from JD"}
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <form onSubmit={handleSaveJob} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {createError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {createError}
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Senior Software Engineer"
                      value={newJob.title}
                      onChange={(e) =>
                        setNewJob({ ...newJob, title: e.target.value })
                      }
                      required
                      disabled={submitting}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Job Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the role..."
                      value={newJob.description}
                      onChange={(e) =>
                        setNewJob({ ...newJob, description: e.target.value })
                      }
                      required
                      className="min-h-[100px]"
                      disabled={submitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="experience">
                        Min. Experience (years)
                      </Label>
                      <Input
                        id="experience"
                        type="number"
                        value={newJob.min_experience}
                        onChange={(e) =>
                          setNewJob({
                            ...newJob,
                            min_experience: parseInt(e.target.value) || 0,
                          })
                        }
                        required
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="passing_score">Passing Score (%)</Label>
                      <Input
                        id="passing_score"
                        type="number"
                        min={0}
                        max={100}
                        value={newJob.passing_score ?? 70}
                        onChange={(e) =>
                          setNewJob({
                            ...newJob,
                            passing_score: Math.min(
                              100,
                              Math.max(0, parseInt(e.target.value) || 0),
                            ),
                          })
                        }
                        disabled={submitting || !newJob.assessment_required}
                      />
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        id="assessment_required"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={newJob.assessment_required ?? false}
                        onChange={(e) =>
                          setNewJob({
                            ...newJob,
                            assessment_required: e.target.checked,
                            assessment_template: e.target.checked
                              ? newJob.assessment_template
                              : null,
                          })
                        }
                        disabled={submitting}
                      />
                      <Label htmlFor="assessment_required" className="mb-0">
                        Require Moodle assessment for this job
                      </Label>
                    </div>
                    {newJob.assessment_required && (
                      <div className="grid gap-2">
                        <Label htmlFor="assessment_template">
                          Assessment Template
                        </Label>
                        <Select
                          value={newJob.assessment_template ?? ""}
                          onValueChange={(value) =>
                            setNewJob({
                              ...newJob,
                              assessment_template: value as AssessmentTemplate,
                            })
                          }
                          disabled={submitting}
                        >
                          <SelectTrigger id="assessment_template">
                            <SelectValue placeholder="Select assessment template" />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSESSMENT_TEMPLATE_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Required Skills</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {skills.map((skill) => (
                        <div
                          key={skill}
                          className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-700 flex items-center gap-2"
                        >
                          {skill}
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600 font-bold flex items-center justify-center"
                            onClick={() => handleRemoveSkill(skill)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a skill (e.g. React)"
                        value={newSkillInput}
                        onChange={(e) => setNewSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSkill();
                          }
                        }}
                        disabled={submitting}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddSkill}
                        disabled={submitting || !newSkillInput.trim()}
                      >
                        + Skill
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter className="p-6 border-t border-slate-100 shrink-0 bg-slate-50/50 flex items-center justify-end gap-2">
                  <Button
                    type="submit"
                    className="bg-slate-900"
                    disabled={
                      submitting ||
                      (newJob.assessment_required && !newJob.assessment_template)
                    }
                  >
                    {submitting ? "Saving..." : "Save Job"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-2 mb-6 bg-white p-4 rounded-md border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <SearchInput
              value={jobSearch}
              onChange={(val) => {
                setJobSearch(val);
                setCurrentPage(1);
              }}
              placeholder="Search jobs by title or skills..."
              className="w-full max-w-sm"
            />
            <Dialog
              open={isFilterDialogOpen}
              onOpenChange={handleCloseFilterDialog}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 font-semibold text-xs shadow-sm h-9"
                >
                  <div className="relative flex items-center justify-center">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 bg-red-500 text-white rounded-full text-[8px] w-3 h-3 flex items-center justify-center font-bold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Filters</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* Experience Filter */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Experience Level
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "", label: "All Experience" },
                        { id: "entry", label: "Entry (0-2 years)" },
                        { id: "mid", label: "Mid (3-5 years)" },
                        { id: "senior", label: "Senior (6+ years)" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTempExperience(opt.id)}
                          className={cn(
                            "px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all",
                            tempExperience === opt.id
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Skills Filter */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Required Skills
                    </h4>
                    <div className="relative mb-2">
                      <Input
                        type="text"
                        placeholder="Search skills..."
                        value={skillsSearch}
                        onChange={(e) => setSkillsSearch(e.target.value)}
                        className="px-3 py-1.5 text-xs border-slate-200 bg-white"
                      />
                    </div>
                    {uniqueSkillsList.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No skills available to filter.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-slate-50/50">
                        {uniqueSkillsList
                          .filter((skill) =>
                            skill
                              .toLowerCase()
                              .includes(skillsSearch.toLowerCase()),
                          )
                          .map((skill) => {
                            const isSelected = tempSkills.includes(skill);
                            return (
                              <button
                                key={skill}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setTempSkills((prev) =>
                                      prev.filter((s) => s !== skill),
                                    );
                                  } else {
                                    setTempSkills((prev) => [...prev, skill]);
                                  }
                                }}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-medium rounded transition-all border",
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50",
                                )}
                              >
                                {skill}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Date Posted Filter */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Date Created
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "", label: "Any Time" },
                        { id: "today", label: "Last 24 Hours" },
                        { id: "week", label: "Last 7 Days" },
                        { id: "month", label: "Last 30 Days" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTempDatePosted(opt.id)}
                          className={cn(
                            "px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all",
                            tempDatePosted === opt.id
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setTempExperience("");
                      setTempSkills([]);
                      setTempDatePosted("");
                      setSkillsSearch("");
                    }}
                  >
                    Clear All Filters
                  </Button>
                  <Button
                    size="sm"
                    className="bg-slate-900"
                    onClick={handleApplyFilters}
                  >
                    Apply Filters
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-100 mt-2 animate-in fade-in duration-200">
              <span className="text-xs text-slate-500 font-medium">
                Active Filters:
              </span>
              {selectedExperience && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-100 flex items-center gap-1 border border-slate-200"
                >
                  Experience:{" "}
                  {selectedExperience === "entry"
                    ? "Entry"
                    : selectedExperience === "mid"
                      ? "Mid"
                      : "Senior"}
                  <button
                    onClick={() => setSelectedExperience("")}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedSkills.map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-100 flex items-center gap-1 border border-slate-200"
                >
                  Skill: {skill}
                  <button
                    onClick={() =>
                      setSelectedSkills((prev) =>
                        prev.filter((s) => s !== skill),
                      )
                    }
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedDatePosted && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-100 flex items-center gap-1 border border-slate-200"
                >
                  Created:{" "}
                  {selectedDatePosted === "today"
                    ? "24h"
                    : selectedDatePosted === "week"
                      ? "7d"
                      : "30d"}
                  <button
                    onClick={() => setSelectedDatePosted("")}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 font-semibold"
                onClick={handleClearAllFilters}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="h-[520px] overflow-y-auto">

            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="w-[300px]">Title</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-slate-500"
                    >
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-slate-500"
                    >
                      {jobSearch
                        ? "No matching jobs found."
                        : "No jobs found. Create your first job to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/candidates?jobId=${job.id}`)}
                    >
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex flex-col gap-1">
                          <span>{job.title}</span>
                          {job.assessment_required && (
                            <Badge
                              variant="secondary"
                              className="w-fit text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100"
                            >
                              Assessment: {job.assessment_template ?? "Not set"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{job.min_experience}+ years</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {job.required_skills.split(",").map((skill, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                            >
                              {skill.trim()}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(job.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                            onClick={(e) => handleEditClick(e, job)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => handleDeleteJob(e, job.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="border-t border-slate-200 bg-slate-50/50"
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default JobsPage;
