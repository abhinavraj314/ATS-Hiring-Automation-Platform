import React, { useEffect, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, FileUp, Loader2, Pencil, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import type { Job, JobCreate } from "@/types/job";
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
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);

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
        raw_jd_text: parsedData.raw_jd_text
      });
      const parsedSkills = parsedData.required_skills ? parsedData.required_skills.split(",").map(s => s.trim()).filter(Boolean) : [];
      setSkills(prev => [...new Set([...prev, ...parsedSkills])]);
    } catch (error) {
      console.error("Failed to parse JD", error);
      setCreateError("Failed to auto-fill from JD. Please enter details manually.");
    } finally {
      setParsing(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleAddSkill = () => {
    if (newSkillInput.trim() && !skills.includes(newSkillInput.trim())) {
      setSkills([...skills, newSkillInput.trim()]);
      setNewSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateError("");
    try {
      const finalJobData = { ...newJob, required_skills: skills.join(", ") };
      if (isEditing && editingJobId) {
        await jobService.updateJob(editingJobId, finalJobData);
      } else {
        await jobService.createJob(finalJobData);
      }
      setIsDialogOpen(false);
      await fetchJobs();
    } catch (error: any) {
      console.error("Failed to save job", error);
      setCreateError(error.response?.data?.detail || "Failed to save job. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClick = () => {
    setIsEditing(false);
    setEditingJobId(null);
    setNewJob({ title: "", description: "", required_skills: "", min_experience: 0 });
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
    });
    setSkills(job.required_skills ? job.required_skills.split(",").map(s => s.trim()).filter(Boolean) : []);
    setNewSkillInput("");
    setIsDialogOpen(true);
  };

  const handleDeleteJob = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this job and all its candidates?")) return;
    try {
      await jobService.deleteJob(id);
      fetchJobs();
    } catch (error) {
      console.error("Failed to delete job", error);
    }
  };

  return (
    <MainLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Jobs</h1>
            <p className="text-slate-500">Manage your active job openings and recruitment pipelines.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800" onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" /> Create Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>{isEditing ? "Edit Job Opening" : "Create Job Opening"}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? "Modify the details for this job position." : "Enter the details for the new job position."}
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
                      onClick={() => document.getElementById('jd-upload')?.click()}
                      disabled={submitting || parsing}
                      className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-medium"
                    >
                      {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                      {parsing ? "Parsing..." : "Auto-fill from JD"}
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <form onSubmit={handleSaveJob}>
                <div className="grid gap-4 py-4">
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
                      onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
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
                      onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                      required
                      className="min-h-[100px]"
                      disabled={submitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="experience">Min. Experience (years)</Label>
                      <Input
                        id="experience"
                        type="number"
                        value={newJob.min_experience}
                        onChange={(e) => setNewJob({ ...newJob, min_experience: parseInt(e.target.value) || 0 })}
                        required
                        disabled={submitting}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Required Skills</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {skills.map(skill => (
                        <div key={skill} className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-700 flex items-center gap-2">
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
                          if (e.key === 'Enter') {
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
                <DialogFooter>
                  <Button type="submit" className="bg-slate-900" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Job"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
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
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    Loading jobs...
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No jobs found. Create your first job to get started.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/candidates?jobId=${job.id}`)}
                  >
                    <TableCell className="font-medium text-slate-900">{job.title}</TableCell>
                    <TableCell>{job.min_experience}+ years</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {job.required_skills.split(",").map((skill, i) => (
                          <span key={i} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
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
      </div>
    </MainLayout>
  );
};

export default JobsPage;
