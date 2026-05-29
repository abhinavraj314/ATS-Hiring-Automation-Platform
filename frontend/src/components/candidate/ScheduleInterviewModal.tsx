import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PanelMember } from "@/types/panel";
import type { Interview } from "@/types/interview";
import { cn } from "@/lib/utils";

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panels: PanelMember[];
  recommendedPanelIds?: number[];
  interviews?: Interview[];
  onSchedule: (data: {
    roundType: string;
    panelId?: number;
    slotId?: number;
    customScheduledAt?: string;
  }) => Promise<void>;
  onReject?: () => Promise<void>;
}

export const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({
  isOpen,
  onOpenChange,
  panels,
  recommendedPanelIds = [],
  interviews = [],
  onSchedule,
  onReject,
}) => {
  const availableRounds = React.useMemo(() => {
    const validInterviews = interviews.filter(i => i.status !== "Cancelled");
    const getLatest = (type: string) => {
      const typeInterviews = validInterviews.filter(i => i.round_type === type);
      return typeInterviews.length > 0 ? typeInterviews[typeInterviews.length - 1] : null;
    };
    
    const latestL1 = getLatest("L1");
    const latestL2 = getLatest("L2");
    const latestFinal = getLatest("FINAL");
    
    const latestInterview = validInterviews.length > 0 ? validInterviews[validInterviews.length - 1] : null;
    
    const options: { value: string, label: string }[] = [];
    
    if (latestInterview && latestInterview.outcome === "Hold") {
      options.push({ value: `RETRY_${latestInterview.round_type}`, label: `Reopen / Retry ${latestInterview.round_type}` });
      options.push({ value: "REJECT", label: "Reject Candidate" });
      
      if (latestInterview.round_type === "L1") {
        options.push({ value: "CONTINUE_L2", label: "Override Hold & Continue to L2" });
      } else if (latestInterview.round_type === "L2") {
        options.push({ value: "CONTINUE_FINAL", label: "Override Hold & Continue to FINAL" });
      }
      return options;
    }
    
    // Normal logical progression
    if (!latestL1 || latestL1.outcome !== "Pass") {
      options.push({ value: "L1", label: "L1 Technical Round" });
    } else if (!latestL2 || latestL2.outcome !== "Pass") {
      options.push({ value: "L2", label: "L2 Advanced Technical" });
    } else if (!latestFinal || latestFinal.outcome !== "Pass") {
      options.push({ value: "FINAL", label: "Final Executive Round" });
    }
    
    return options;
  }, [interviews]);

  const [selectedRoundType, setSelectedRoundType] = useState("L1");
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [customScheduledAt, setCustomScheduledAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form states when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setSelectedRoundType(availableRounds.length > 0 ? availableRounds[0].value : "");
      setSelectedPanelId("");
      setSelectedSlotId("");
      setCustomScheduledAt("");
      setIsSubmitting(false);
    }
  }, [isOpen, availableRounds]);

  const handleScheduleClick = async () => {
    setIsSubmitting(true);
    try {
      if (selectedRoundType === "REJECT") {
        if (onReject) await onReject();
        onOpenChange(false);
        return;
      }

      let actualRoundType = selectedRoundType;
      if (selectedRoundType.startsWith("RETRY_")) {
        actualRoundType = selectedRoundType.replace("RETRY_", "");
      } else if (selectedRoundType.startsWith("CONTINUE_")) {
        actualRoundType = selectedRoundType.replace("CONTINUE_", "");
      }

      const panelIdNum = selectedPanelId ? Number(selectedPanelId) : undefined;
      const slotIdNum = selectedSlotId && selectedSlotId !== "custom" && selectedSlotId !== "none" 
        ? Number(selectedSlotId) 
        : undefined;

      await onSchedule({
        roundType: actualRoundType,
        panelId: panelIdNum,
        slotId: slotIdNum,
        customScheduledAt: selectedSlotId === "custom" || !selectedPanelId ? customScheduledAt : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSelectedPanel = panels.find(p => p.id === Number(selectedPanelId));
  const activeAvailableSlots = activeSelectedPanel?.availabilities || [];
  const isRejectAction = selectedRoundType === "REJECT";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white border border-slate-200 shadow-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 text-base font-semibold">Schedule Interview Round</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4 text-slate-700">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Round Type</label>
            <Select value={selectedRoundType} onValueChange={setSelectedRoundType}>
              <SelectTrigger className="border-slate-200 text-xs">
                <SelectValue placeholder="Select round" />
              </SelectTrigger>
              <SelectContent>
                {availableRounds.length === 0 ? (
                  <SelectItem value="none" disabled className="text-xs">No rounds available</SelectItem>
                ) : (
                  availableRounds.map(round => (
                    <SelectItem key={round.value} value={round.value} className="text-xs">
                      {round.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {!isRejectAction && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interviewer / Panel Member</label>
              <Select value={selectedPanelId} onValueChange={(val) => {
                setSelectedPanelId(val);
                setSelectedSlotId(""); // Reset slot when interviewer changes
              }}>
                <SelectTrigger className="border-slate-200 text-xs">
                  <SelectValue placeholder="Select interviewer" />
                </SelectTrigger>
                <SelectContent>
                  {panels.map(panel => {
                    const isRecommended = recommendedPanelIds.includes(panel.id);
                    return (
                      <SelectItem key={panel.id} value={String(panel.id)} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span>{panel.name} ({panel.interview_for || "All Roles"})</span>
                          {isRecommended && (
                            <span className="bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Recommended</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isRejectAction && selectedPanelId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Select Available Slot</span>
                <span className="text-[9px] text-green-600 font-semibold lowercase">matched availability</span>
              </label>
              <Select value={selectedSlotId} onValueChange={setSelectedSlotId}>
                <SelectTrigger className="border-slate-200 text-xs">
                  <SelectValue placeholder="Choose a pre-defined slot" />
                </SelectTrigger>
                <SelectContent>
                  {activeAvailableSlots.length === 0 ? (
                    <SelectItem value="none" disabled className="text-xs">No pre-defined slots available</SelectItem>
                  ) : (
                    activeAvailableSlots.map(slot => (
                      <SelectItem key={slot.id} value={String(slot.id)} className="text-xs">
                        {slot.available_date} at {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                      </SelectItem>
                    ))
                  )}
                  <SelectItem value="custom" className="text-xs font-medium text-slate-900">+ Custom Date & Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isRejectAction && (selectedSlotId === "custom" || !selectedPanelId) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Custom Date & Time</label>
              <input 
                type="datetime-local" 
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-0"
                value={customScheduledAt}
                onChange={(e) => setCustomScheduledAt(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Cancel
          </Button>
          <Button 
            onClick={handleScheduleClick} 
            disabled={isSubmitting || (!isRejectAction && !selectedPanelId && !customScheduledAt)}
            className={cn(
              "text-white text-xs h-8",
              isRejectAction ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
            )}
          >
            {isSubmitting ? "Processing..." : isRejectAction ? "Reject Candidate" : "Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
