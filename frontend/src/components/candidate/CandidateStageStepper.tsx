import React from "react";
import { Check, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CandidateStageStepperProps {
  currentStatus: string;
  onStatusUpdate: (status: string) => Promise<void>;
  disabled?: boolean;
  canSelect?: boolean;
}

const STAGES = [
  "Applied",
  "Under Review",
  "Shortlisted",
  "Interviewing",
  "Selected",
];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "Applied": ["Under Review", "Rejected"],
  "Under Review": ["Shortlisted", "Rejected"],
  "Shortlisted": ["Interviewing", "Rejected"],
  "Interviewing": ["Selected", "Rejected"],
  "Selected": [],
  "Rejected": [],
};

export const CandidateStageStepper: React.FC<CandidateStageStepperProps> = ({
  currentStatus,
  onStatusUpdate,
  disabled = false,
  canSelect = false,
}) => {
  const isRejected = currentStatus === "Rejected";
  const activeIndex = STAGES.indexOf(currentStatus);

  let allowedNextStages = ALLOWED_TRANSITIONS[currentStatus] || [];
  
  // Enforce Workflow Action Logic (Feature 6)
  allowedNextStages = allowedNextStages.filter(stage => {
    if (stage === "Interviewing") return false; // Must happen via Schedule Round
    if (stage === "Selected") return canSelect;
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6">
      {/* Rejection Alert Banner */}
      {isRejected && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <strong className="font-semibold">Candidate Application Rejected</strong>
            <p className="text-red-700 mt-0.5">This candidate's progression has been stopped. Manual stage progression is disabled.</p>
          </div>
        </div>
      )}

      {/* Stepper Graphic */}
      <div className="relative flex items-center justify-between w-full">
        {/* Connection Line Behind Steps */}
        <div className="absolute top-[18px] left-[5%] right-[5%] h-0.5 bg-slate-100 -z-0" />
        
        {/* Colored Active Connection Line */}
        {!isRejected && activeIndex > 0 && (
          <div 
            className="absolute top-[18px] left-[5%] h-0.5 bg-slate-900 -z-0 transition-all duration-300"
            style={{
              width: `${(activeIndex / (STAGES.length - 1)) * 90}%`
            }}
          />
        )}

        {STAGES.map((stage, idx) => {
          const isCompleted = !isRejected && idx < activeIndex;
          const isActive = !isRejected && idx === activeIndex;
          const isPending = isRejected || idx > activeIndex;

          return (
            <div key={stage} className="flex flex-col items-center relative z-10 w-[20%]">
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center border text-sm font-semibold transition-colors duration-200",
                  isCompleted && "bg-slate-900 border-slate-900 text-white",
                  isActive && "bg-white border-slate-900 text-slate-900 ring-2 ring-slate-900/10",
                  isPending && "bg-white border-slate-200 text-slate-400"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4.5 w-4.5" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-medium mt-2 text-center break-words max-w-full",
                  isCompleted && "text-slate-900",
                  isActive && "text-slate-900 font-bold",
                  isPending && "text-slate-400"
                )}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action Controls */}
      {allowedNextStages.length > 0 && !disabled && (
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 mr-auto font-medium">
            Strict Stage Workflow Controls:
          </span>
          {allowedNextStages.map((nextStage) => {
            const isReject = nextStage === "Rejected";
            return (
              <Button
                key={nextStage}
                variant={isReject ? "outline" : "default"}
                size="sm"
                onClick={() => onStatusUpdate(nextStage)}
                className={cn(
                  "text-xs font-semibold px-4 h-9",
                  isReject
                    ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                )}
              >
                {isReject ? "Reject Candidate" : `Move to ${nextStage}`}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};
