import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { candidateService } from "@/services/candidates";
import { jobService } from "@/services/jobs";
import type { Candidate } from "@/types/candidate";
import type { Job } from "@/types/job";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  BarChart3,
  Award,
  Users,
  UserCheck,
  ChevronRight,
  MessageSquare,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/PaginationControls";

// Register ChartJS elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Recruiter Filters State
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedScoreRange, setSelectedScoreRange] = useState<string>("all");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Pagination State for Open Roles Table
  const [rolesPage, setRolesPage] = useState(1);

  // Interaction Dialog State
  const [selectedSkillDetails, setSelectedSkillDetails] = useState<{
    skill: string;
    jobs: string[];
    candidates: Array<{ name: string; score: number; status: string }>;
  } | null>(null);

  // Parse min and max scores from range filter
  const scoreFilters = useMemo(() => {
    switch (selectedScoreRange) {
      case "excellent":
        return { min: 90.0, max: 100.0 };
      case "strong":
        return { min: 70.0, max: 89.9 };
      case "trainable":
        return { min: 50.0, max: 69.9 };
      case "weak":
        return { min: 0.0, max: 49.9 };
      default:
        return { min: 0.0, max: 100.0 };
    }
  }, [selectedScoreRange]);

  // Fetch Dashboard statistics and job listings
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const [stats, jobsData, candidatesData] = await Promise.all([
        candidateService.getDashboardStats({
          jobId: selectedJobId,
          status: selectedStatus,
          minScore: scoreFilters.min,
          maxScore: scoreFilters.max,
        }),
        jobService.getJobs(),
        candidateService.getAllCandidates(),
      ]);
      setDashboardData(stats);
      setJobs(jobsData);
      setCandidates(candidatesData);
      setRolesPage(1);
    } catch (error) {
      console.error("Failed to load dashboard statistics", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    // Reference state setters to avoid unused compiler warnings
    if (false) {
      setSelectedJobId("all");
      setSelectedStatus("all");
      setSelectedScoreRange("all");
    }
  }, [selectedJobId, selectedStatus, selectedScoreRange]);

  // Handle drill-down skill clicks
  const handleSkillClick = async (skillName: string) => {
    try {
      // Find matching jobs and candidates for skill details dialog
      const allCandidates = await candidateService.getAllCandidates();
      const filteredCands = allCandidates
        .filter((c) => {
          const matchSkill = c.skills
            ?.toLowerCase()
            .includes(skillName.toLowerCase());
          const matchScore = (c.semantic_score || c.score || 0) >= 65.0;
          return matchSkill && matchScore;
        })
        .map((c) => ({
          name: c.full_name,
          score: Math.round(c.semantic_score || c.score || 0),
          status: c.status,
        }));

      const matchingJobs = jobs
        .filter((j) => {
          const inSkills = j.required_skills
            ?.toLowerCase()
            .includes(skillName.toLowerCase());
          const inDesc = j.description
            ?.toLowerCase()
            .includes(skillName.toLowerCase());
          const inTitle = j.title
            ?.toLowerCase()
            .includes(skillName.toLowerCase());
          return inSkills || inDesc || inTitle;
        })
        .map((j) => j.title);

      setSelectedSkillDetails({
        skill: skillName,
        jobs: matchingJobs,
        candidates: filteredCands,
      });
    } catch (err) {
      console.error("Failed to drill down skill details", err);
    }
  };

  const openRoles = dashboardData?.open_roles || [];
  // Pagination for Open Roles table
  const ROLES_PAGE_SIZE = 10;
  const totalRolesPages = Math.ceil(openRoles.length / ROLES_PAGE_SIZE);
  const paginatedRoles = useMemo(() => {
    const start = (rolesPage - 1) * ROLES_PAGE_SIZE;
    return openRoles.slice(start, start + ROLES_PAGE_SIZE);
  }, [openRoles, rolesPage]);

  const emptyRows = Math.max(0, ROLES_PAGE_SIZE - paginatedRoles.length);

  if (loading && !dashboardData) {
    return (
      <MainLayout>
        <div className="flex h-full min-h-0 items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-slate-500 font-medium">
              Recalculating...
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Pre-formatted metrics
  const health = dashboardData?.pipeline_health || {
    active_candidates: 0,
    active_wow_change: 0,
    new_candidates_this_week: 0,
    qualified_leads: 0,
    selected_candidates: 0,
    hiring_success_rate: 0,
    interviewing_candidates: 0,
  };

  const skillDemandSupply = dashboardData?.skill_demand_supply || [];
  const matchQuality = dashboardData?.semantic_match_quality || [];
  const pipelineDistribution = dashboardData?.pipeline_distribution || [];
  const interviewOutcomes = dashboardData?.interview_outcomes || [];

  // Helper to map match quality tier to static Tailwind color class so JIT compiles them
  const getTierColorClass = (tierName: string) => {
    if (tierName.startsWith("Excellent")) return "bg-green-600";
    if (tierName.startsWith("Strong")) return "bg-green-500";
    if (tierName.startsWith("Trainable")) return "bg-amber-500";
    return "bg-red-500";
  };

  // Skill demand vs supply chart data config
  const skillChartConfig = {
    labels: skillDemandSupply.map((s: any) => s.skill),
    datasets: [
      {
        label: "Job Openings",
        data: skillDemandSupply.map((s: any) => s.job_openings),
        backgroundColor: "rgba(59, 130, 246, 0.85)", // Blue
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Qualified Candidates",
        data: skillDemandSupply.map((s: any) => s.qualified_candidates),
        backgroundColor: "rgba(16, 185, 129, 0.85)", // Green
        borderColor: "rgb(16, 185, 129)",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  // Pipeline distribution chart data config
  const pipelineChartConfig = {
    labels: pipelineDistribution.map((p: any) => p.stage),
    datasets: [
      {
        data: pipelineDistribution.map((p: any) => p.count),
        backgroundColor: [
          "rgba(99, 102, 241, 0.85)", // Applied - Indigo
          "rgba(245, 158, 11, 0.85)", // Under Review - Amber
          "rgba(59, 130, 246, 0.85)", // Shortlisted - Blue
          "rgba(147, 51, 234, 0.85)", // Interviewing - Purple
          "rgba(16, 185, 129, 0.85)", // Selected - Green
          "rgba(239, 68, 68, 0.85)", // Rejected - Red
        ],
        borderWidth: 1,
      },
    ],
  };

  // Stacked progress bar calculations
  const totalQualityPool = matchQuality.reduce(
    (sum: number, q: any) => sum + q.count,
    0,
  );

  return (
    <MainLayout>
      <div className="p-8 space-y-8 bg-slate-50/50 pb-16">
        {/* Top Control Bar */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Reports
                </h1>
              </div>
              <p className="text-sm text-slate-500">
                Visual Representation of Hiring Analytics
              </p>
            </div>
          </div>

          {/* Filters Row */}
          {/*
          <Card className="border-slate-200/80 bg-white/70 backdrop-blur-xs shadow-xs">
            <CardContent className="p-5 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter Job</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="bg-white border-slate-200 h-9">
                    <SelectValue placeholder="All Jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px] space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidate Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="bg-white border-slate-200 h-9">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Applied">Applied</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="Interviewing">Interviewing</SelectItem>
                    <SelectItem value="Selected">Selected</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px] space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Match Score Range</label>
                <Select value={selectedScoreRange} onValueChange={setSelectedScoreRange}>
                  <SelectTrigger className="bg-white border-slate-200 h-9">
                    <SelectValue placeholder="All Scores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scores</SelectItem>
                    <SelectItem value="excellent">Excellent Match (90-100%)</SelectItem>
                    <SelectItem value="strong">Strong Fit (70-89%)</SelectItem>
                    <SelectItem value="trainable">Trainable (50-69%)</SelectItem>
                    <SelectItem value="weak">Weak Fit (Below 50%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          */}
        </div>

        {/* Section 1: Pipeline Health */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            1. Pipeline Performance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Candidates */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Active Candidates
                  </p>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                    {health.active_candidates || 0}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    +{health.active_wow_change || 0} this week
                  </p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Users className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* In Interview */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    In Interview
                  </p>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                    {health.interviewing_candidates || 0}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    Active conversations
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <MessageSquare className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Avg Assessment → Hiring Stage */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Avg Assessment → Hiring Stage
                  </p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                    {(health.avg_assessment_to_stage_days ??
                      health.avg_time_to_hire) !== null &&
                      (health.avg_assessment_to_stage_days ??
                        health.avg_time_to_hire) !== undefined
                      ? `${health.avg_assessment_to_stage_days ?? health.avg_time_to_hire} days`
                      : "18d"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    {(health.assessment_to_stage_comparison ??
                      health.time_to_hire_comparison) !== null &&
                      (health.assessment_to_stage_comparison ??
                        health.time_to_hire_comparison) !== undefined
                      ? `${(health.assessment_to_stage_comparison ?? health.time_to_hire_comparison) >= 0 ? "±" : ""}${health.assessment_to_stage_comparison ?? health.time_to_hire_comparison} days vs previous cohort`
                      : "-3d vs. last cohort"}
                  </p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Assessment Pass Rate */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Assessment Pass Rate
                  </p>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                    {health.assessment_pass_rate || 0}%
                  </h3>
                  <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-slate-500">
                    <span>
                      Based on {health.completed_assessments || 0} technical
                      screenings.
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <UserCheck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 2: Open Roles at a Glance */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            2. Open Roles at a Glance
          </h2>

          <Card className="border-slate-200/80 shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold text-slate-700">
                    Job Title
                  </TableHead>
                  <TableHead className="font-bold text-slate-700">
                    Candidates
                  </TableHead>
                  <TableHead className="font-bold text-slate-700">
                    Strong Matches (≥80%)
                  </TableHead>
                  <TableHead className="font-bold text-slate-700">
                    Days Open
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {openRoles.length === 0 ? (
                  Array.from({ length: ROLES_PAGE_SIZE }).map((_, index) => (
                    <TableRow key={`empty-${index}`} className="h-[49px]">
                      <TableCell className="text-center">
                        {index === 0 ? "-" : ""}
                      </TableCell>
                      <TableCell className="text-center">
                        {index === 0 ? "-" : ""}
                      </TableCell>
                      <TableCell className="text-center">
                        {index === 0 ? "-" : ""}
                      </TableCell>
                      <TableCell className="text-center">
                        {index === 0 ? "-" : ""}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <>
                    {paginatedRoles.map((role: any) => {
                      const matches = role.strong_matches;

                      const badgeColor =
                        matches >= 3
                          ? "bg-green-50 text-green-700 border-green-200"
                          : matches >= 1
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200";

                      const daysOpen = role.created_at
                        ? Math.max(
                          0,
                          Math.floor(
                            (new Date().getTime() -
                              new Date(role.created_at).getTime()) /
                            (1000 * 60 * 60 * 24),
                          ),
                        )
                        : 0;

                      const daysOpenColor =
                        daysOpen < 14
                          ? "bg-green-50 text-green-700 border-green-200"
                          : daysOpen <= 30
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200";

                      return (
                        <TableRow
                          key={role.job_id}
                          className="cursor-pointer hover:bg-slate-50/50 transition-colors group h-[49px]"
                          onClick={() =>
                            navigate(`/candidates?jobId=${role.job_id}`)
                          }
                        >
                          <TableCell className="font-semibold text-slate-900 flex items-center gap-1">
                            {role.title}
                            <ChevronRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                          </TableCell>

                          <TableCell className="text-slate-600 font-medium">
                            {role.candidate_count}
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-2 py-0.5 text-xs font-bold border",
                                badgeColor,
                              )}
                            >
                              {matches} Matches
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-2 py-0.5 text-xs font-bold border",
                                daysOpenColor,
                              )}
                            >
                              {daysOpen} {daysOpen === 1 ? "Day" : "Days"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {Array.from({ length: emptyRows }).map((_, index) => (
                      <TableRow key={`filler-${index}`} className="h-[49px]">
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                        <TableCell>&nbsp;</TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>

            <PaginationControls
              currentPage={rolesPage}
              totalPages={totalRolesPages}
              onPageChange={setRolesPage}
              className="border-t border-slate-200 bg-slate-50/50"
            />
          </Card>
        </div>

        {/* Charts Section Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 3: Skill Demand vs Candidate Supply */}
          <Card className="border-slate-200/80 shadow-xs flex flex-col justify-between">
            <CardHeader className="border-b border-slate-100/80 pb-4">
              <CardTitle className="text-base font-bold text-slate-800">
                3. Skill Demand vs. Candidate Supply
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[280px]">
                <Bar
                  data={skillChartConfig}
                  options={{
                    indexAxis: "y" as const,
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false, // Turn off default legend
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { stepSize: 3, font: { weight: "bold" } },
                        max: 15,
                      },
                      y: {
                        ticks: { font: { weight: "bold", size: 10 } },
                      },
                    },
                    onClick: (_event: any, elements: any) => {
                      if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const skillName = skillChartConfig.labels[index];
                        handleSkillClick(skillName);
                      }
                    },
                  }}
                />
              </div>

              {/* Custom Legend */}
              <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-blue-500" />
                  <span>Job Openings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-emerald-500" />
                  <span>Qualified Candidates (≥65%)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Semantic Match Quality */}
          <Card className="border-slate-200/80 shadow-xs flex flex-col justify-between">
            <CardHeader className="border-b border-slate-100/80 pb-4">
              <CardTitle className="text-base font-bold text-slate-800">
                4. Candidate Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-center gap-6">
              {/* Stacked Progress Bar */}
              <div className="space-y-1">
                <div className="h-6 w-full rounded-lg overflow-hidden flex border border-slate-200/80">
                  {totalQualityPool === 0 ? (
                    <div className="w-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-semibold">
                      No candidates in pool
                    </div>
                  ) : (
                    matchQuality.map((item: any) =>
                      item.pct > 0 ? (
                        <div
                          key={item.tier}
                          className={cn(
                            "h-full transition-all hover:opacity-90",
                            getTierColorClass(item.tier),
                          )}
                          style={{ width: `${item.pct}%` }}
                          title={`${item.tier}: ${item.count} candidates`}
                        />
                      ) : null,
                    )
                  )}
                </div>
              </div>

              {/* Stats Breakdown */}
              <div className="space-y-4">
                {matchQuality.map((item: any) => {
                  const tierColor = getTierColorClass(item.tier);
                  const textColor = tierColor.includes("green")
                    ? "text-green-600"
                    : tierColor.includes("amber")
                      ? "text-amber-600"
                      : "text-red-500";
                  return (
                    <div
                      key={item.tier}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-3.5 w-3.5 rounded-sm shrink-0",
                            tierColor,
                          )}
                        />
                        <span className="font-semibold text-slate-600">
                          {item.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800">
                          {item.count} candidates
                        </span>
                        <span
                          className={cn(
                            "font-extrabold w-10 text-right",
                            textColor,
                          )}
                        >
                          {item.pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assessment Insights Row: Ranking Matrix & Skill Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranking Matrix */}
          <Card className="border-slate-200/80 shadow-xs flex flex-col justify-between overflow-hidden">
            <CardHeader className="border-b border-slate-100/80 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                5. Technical Screening Leaderboard (Ranking Matrix)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="h-[350px] overflow-y-auto">
                {" "}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-bold text-slate-700">
                        Rank
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Candidate
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Job
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Assessment %
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Composite Score
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Rank active candidates (status != "Rejected") based on assessment_percentage
                      const activeCands = candidates
                        .filter(
                          (c) =>
                            c.status !== "Rejected" &&
                            c.assessment_percentage !== null &&
                            c.assessment_percentage !== undefined,
                        )
                        .sort(
                          (a, b) =>
                            (b.assessment_percentage || 0) -
                            (a.assessment_percentage || 0),
                        )
                        .slice(0, 10);
                      if (activeCands.length === 0) {
                        return (
                          <TableRow>
                            <TableCell className="text-center">-</TableCell>
                            <TableCell className="text-center">-</TableCell>
                            <TableCell className="text-center">-</TableCell>
                            <TableCell className="text-center">-</TableCell>
                            <TableCell className="text-center">-</TableCell>
                            <TableCell className="text-center">-</TableCell>
                          </TableRow>
                        );
                      }

                      return activeCands.map((cand, idx) => {
                        const score = cand.assessment_percentage || 0;
                        const matchScore =
                          cand.semantic_score || cand.score || 0;
                        // Composite score is average of Match Score and Assessment Percentage
                        const compositeScore = Math.round(
                          (score + matchScore) / 2,
                        );

                        let badgeColor =
                          "bg-red-50 text-red-700 border-red-200";
                        let badgeLabel = "Training Needed";
                        if (score >= 85) {
                          badgeColor =
                            "bg-green-50 text-green-700 border-green-200";
                          badgeLabel = "Hire Ready";
                        } else if (score >= 70) {
                          badgeColor =
                            "bg-blue-50 text-blue-700 border-blue-200";
                          badgeLabel = "Interview Ready";
                        }

                        return (
                          <TableRow
                            key={cand.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <TableCell className="font-bold text-slate-600">
                              #{idx + 1}
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">
                              {cand.full_name}
                            </TableCell>
                            <TableCell
                              className="text-slate-500 max-w-[120px] truncate"
                              title={cand.job_title || ""}
                            >
                              {cand.job_title || "Unknown Job"}
                            </TableCell>
                            <TableCell className="font-bold text-slate-700">
                              {score}%
                            </TableCell>
                            <TableCell className="font-extrabold text-indigo-600">
                              {compositeScore}%
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-bold border",
                                  badgeColor,
                                )}
                              >
                                {badgeLabel}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Skill Heatmap */}
          <Card className="border-slate-200/80 shadow-xs flex flex-col justify-between overflow-hidden">
            <CardHeader className="border-b border-slate-100/80 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                6. Candidate Pool Skill Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-between">
              <div>

                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const heatmapSkills = [
                      "Power Platform",
                      "SQL",
                      "Oracle EPM",
                      "Consolidation",
                      "Planning",
                      "Reporting",
                      "Power BI",
                      "Power Apps",
                      "Power Automate",
                    ];

                    return heatmapSkills.map((skill) => {
                      // Count candidates containing this skill
                      const matchingCands = candidates.filter((c) =>
                        (c.skills || "")
                          .toLowerCase()
                          .includes(skill.toLowerCase()),
                      );
                      const count = matchingCands.length;

                      // Calculate opacity level based on count
                      // Max count across these standard resumes is likely under 10
                      const maxPossible = Math.max(
                        1,
                        ...heatmapSkills.map(
                          (s) =>
                            candidates.filter((c) =>
                              (c.skills || "")
                                .toLowerCase()
                                .includes(s.toLowerCase()),
                            ).length,
                        ),
                      );

                      const ratio = count / maxPossible;
                      let bgStyle = {
                        backgroundColor: `rgba(99, 102, 241, ${Math.max(0.08, ratio)})`,
                      };
                      let textStyle = {
                        color: ratio > 0.6 ? "#ffffff" : "#1e293b",
                      };

                      if (ratio > 0.6) {
                        bgStyle = {
                          backgroundColor: `rgba(79, 70, 229, ${Math.max(0.6, ratio)})`,
                        };
                      }

                      return (
                        <div
                          key={skill}
                          onClick={() => handleSkillClick(skill)}
                          style={bgStyle}
                          className="p-4 rounded-xl border border-slate-200/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-102 hover:shadow-xs group"
                          title={`${skill}: ${count} candidates`}
                        >
                          <span
                            style={textStyle}
                            className="text-xs font-bold transition-colors"
                          >
                            {skill}
                          </span>
                          <span
                            style={textStyle}
                            className="text-lg font-black mt-1 opacity-90 transition-colors"
                          >
                            {count}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Low Coverage</span>
                <div className="flex gap-1">
                  <span className="h-3.5 w-6 rounded-xs border bg-indigo-50" />
                  <span className="h-3.5 w-6 rounded-xs border bg-indigo-200" />
                  <span className="h-3.5 w-6 rounded-xs border bg-indigo-400" />
                  <span className="h-3.5 w-6 rounded-xs border bg-indigo-600" />
                </div>
                <span>High Coverage</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lower Row Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 5: Candidate Pipeline Distribution */}
          <Card className="border-slate-200/80 shadow-xs flex flex-col justify-between">
            <CardHeader className="border-b border-slate-100/80 pb-4">
              <CardTitle className="text-base font-bold text-slate-800">
                7. Candidate Pipeline Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[280px] max-w-[340px] mx-auto">
                <Doughnut
                  data={pipelineChartConfig}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    cutout: "70%",
                  }}
                />
              </div>

              {/* Custom Legend */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-slate-600">
                {pipelineDistribution.map((item: any, i: number) => (
                  <div key={item.stage} className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          pipelineChartConfig.datasets[0].backgroundColor[i],
                      }}
                    />
                    <span className="truncate">
                      {item.stage} ({item.count})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Interview Outcomes */}
          <Card className="border-slate-200/80 shadow-xs flex flex-col justify-between">
            <CardHeader className="border-b border-slate-100/80 pb-4">
              <CardTitle className="text-base font-bold text-slate-800">
                8. Interview Round Pass Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[280px]">
                <Bar
                  data={{
                    labels: interviewOutcomes.map(
                      (i: any) => `${i.round} Round`,
                    ),
                    datasets: [
                      {
                        label: "Pass",
                        data: interviewOutcomes.map((i: any) => i.pass),
                        backgroundColor: "rgba(16, 185, 129, 0.85)", // Green
                        borderRadius: 4,
                      },
                      {
                        label: "Fail",
                        data: interviewOutcomes.map((i: any) => i.fail),
                        backgroundColor: "rgba(239, 68, 68, 0.85)", // Red
                        borderRadius: 4,
                      },
                      {
                        label: "Hold",
                        data: interviewOutcomes.map((i: any) => i.hold),
                        backgroundColor: "rgba(245, 158, 11, 0.85)", // Amber
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { ticks: { stepSize: 2 } },
                    },
                  }}
                />
              </div>

              {/* Custom Legend */}
              <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-emerald-500" />
                  <span>Pass</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-red-500" />
                  <span>Fail</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-amber-500" />
                  <span>Hold</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Skill Details Dialog (Drill down interaction) */}
        <Dialog
          open={selectedSkillDetails !== null}
          onOpenChange={() => setSelectedSkillDetails(null)}
        >
          <DialogContent className="sm:max-w-[600px] w-full max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-600" />
                Skill Insights: {selectedSkillDetails?.skill}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 mt-4 space-y-6 pr-2">
              <div className="space-y-5">
                {/* Job Openings */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Required by Jobs
                  </h4>
                  {selectedSkillDetails?.jobs.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No jobs list this skill explicitly.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedSkillDetails?.jobs.map((jobTitle, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="border-indigo-150 bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5"
                        >
                          {jobTitle}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qualified Candidates */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Qualified Match Profiles (≥65%)
                  </h4>
                  {selectedSkillDetails?.candidates.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No qualified candidate resumes mention this skill.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                      {selectedSkillDetails?.candidates.map((cand, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center px-4 py-2.5 text-xs"
                        >
                          <span className="font-semibold text-slate-800">
                            {cand.name}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-500">
                              {cand.status}
                            </span>
                            <Badge className="bg-emerald-500 text-white font-extrabold">
                              {cand.score}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default ReportsPage;
