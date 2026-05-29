import React from "react";
import { Calendar, Clock, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Interview } from "@/types/interview";
import { cn } from "@/lib/utils";

interface InterviewTimelineProps {
  interviews: Interview[];
  loading: boolean;
  onScheduleClick: () => void;
  onFeedbackClick: (interview: Interview) => void;
  onCancelClick: (interviewId: number) => Promise<void>;
}

export const InterviewTimeline: React.FC<InterviewTimelineProps> = ({
  interviews,
  loading,
  onScheduleClick,
  onFeedbackClick,
  onCancelClick,
}) => {
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

  const validInterviews = interviews.filter(i => i.status !== "Cancelled");
  const latestInterview = validInterviews[validInterviews.length - 1];
  const isRejected = latestInterview?.outcome === "Fail";
  const hasActiveRound = interviews.some(i => i.status === "Scheduled");
  
  const disableSchedule = hasActiveRound || isRejected;
  let scheduleTitle = "Schedule a new round";
  if (isRejected) {
    scheduleTitle = "Candidate has been rejected. Terminal state.";
  } else if (hasActiveRound) {
    scheduleTitle = "Cannot schedule while an active round exists.";
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          Scheduled Interviews & Rounds
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onScheduleClick}
          disabled={disableSchedule}
          title={scheduleTitle}
          className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center gap-1 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" /> Schedule Round
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-500 text-sm animate-pulse">
          Loading interviews...
        </div>
      ) : interviews.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <p className="text-sm text-slate-500 font-medium">No interviews scheduled yet for this candidate.</p>
          <p className="text-xs text-slate-400 mt-1">Click "Schedule Round" to create a manual interview round.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((interview) => (
            <div
              key={interview.id}
              className="p-4 border border-slate-150 rounded-lg bg-slate-50/30 hover:bg-slate-50/80 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-slate-900 text-white hover:bg-slate-950 border-none font-bold text-xs uppercase px-2 py-0.5">
                      {interview.round_type}
                    </Badge>
                    {interview.outcome === "Hold" ? (
                      <Badge className="text-[10px] font-bold px-2 py-0 uppercase border-none text-white bg-amber-500">
                        On Hold
                      </Badge>
                    ) : (
                      <>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0 capitalize",
                            interview.status === "Completed"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : interview.status === "Cancelled"
                              ? "border-slate-200 bg-slate-100 text-slate-500"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          )}
                        >
                          {interview.status}
                        </Badge>
                        {interview.outcome && (
                          <Badge
                            className={cn(
                              "text-[10px] font-bold px-2 py-0 uppercase border-none text-white",
                              interview.outcome === "Pass"
                                ? "bg-green-600"
                                : interview.outcome === "Fail"
                                ? "bg-red-600"
                                : "bg-amber-500"
                            )}
                          >
                            {interview.outcome}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  {interview.outcome === "Hold" && !interview.panel_member && !interview.scheduled_at ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/50 border border-amber-100 rounded-md px-3 py-1.5 w-fit">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Process is currently paused at this round. No interview is scheduled.</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        Panel: <strong className="text-slate-700">{interview.panel_member?.name || "Unassigned"}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {formatDateTime(interview.scheduled_at)}
                      </span>
                    </div>
                  )}

                  {interview.feedback_notes && (
                    <div className="mt-2 p-3 bg-white border border-slate-100 rounded-md text-xs text-slate-600 italic">
                      <span className="font-semibold text-slate-700 not-italic block mb-1">Feedback Notes:</span>
                      "{interview.feedback_notes}"
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  {interview.status === "Scheduled" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100 text-[10px] h-7 px-2.5 font-bold"
                        onClick={() => onFeedbackClick(interview)}
                      >
                        Feedback
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0 rounded-md"
                        onClick={() => onCancelClick(interview.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
