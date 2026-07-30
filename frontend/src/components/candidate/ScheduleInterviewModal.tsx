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

const TIME_SLOTS = [
  { start: "08:00", end: "08:30", label: "08:00 AM - 08:30 AM" },
  { start: "08:30", end: "09:00", label: "08:30 AM - 09:00 AM" },
  { start: "09:00", end: "09:30", label: "09:00 AM - 09:30 AM" },
  { start: "09:30", end: "10:00", label: "09:30 AM - 10:00 AM" },
  { start: "10:00", end: "10:30", label: "10:00 AM - 10:30 AM" },
  { start: "10:30", end: "11:00", label: "10:30 AM - 11:00 AM" },
  { start: "11:00", end: "11:30", label: "11:00 AM - 11:30 AM" },
  { start: "11:30", end: "12:00", label: "11:30 AM - 12:00 PM" },
  { start: "12:00", end: "12:30", label: "12:00 PM - 12:30 PM" },
  { start: "12:30", end: "13:00", label: "12:30 PM - 01:00 PM" },
  { start: "13:00", end: "13:30", label: "01:00 PM - 01:30 PM" },
  { start: "13:30", end: "14:00", label: "01:30 PM - 02:00 PM" },
  { start: "14:00", end: "14:30", label: "02:00 PM - 02:30 PM" },
  { start: "14:30", end: "15:00", label: "02:30 PM - 03:00 PM" },
  { start: "15:00", end: "15:30", label: "03:00 PM - 03:30 PM" },
  { start: "15:30", end: "16:00", label: "03:30 PM - 04:00 PM" },
  { start: "16:00", end: "16:30", label: "04:00 PM - 04:30 PM" },
  { start: "16:30", end: "17:00", label: "04:30 PM - 05:00 PM" },
  { start: "17:00", end: "17:30", label: "05:00 PM - 05:30 PM" },
  { start: "17:30", end: "18:00", label: "05:30 PM - 06:00 PM" },
  { start: "18:00", end: "18:30", label: "06:00 PM - 06:30 PM" },
  { start: "18:30", end: "19:00", label: "06:30 PM - 07:00 PM" },
  { start: "19:00", end: "19:30", label: "07:00 PM - 07:30 PM" },
  { start: "19:30", end: "20:00", label: "07:30 PM - 08:00 PM" },
  { start: "20:00", end: "20:30", label: "08:00 PM - 08:30 PM" },
  { start: "20:30", end: "21:00", label: "08:30 PM - 09:00 PM" },
];

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
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [selectedCustomTime, setSelectedCustomTime] = useState<string>("");
  const [showCustomGrid, setShowCustomGrid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form states when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setSelectedRoundType(availableRounds.length > 0 ? availableRounds[0].value : "");
      setSelectedPanelId("");
      setSelectedSlotId("");
      setSelectedCustomTime("");
      setShowCustomGrid(false);
      setSelectedDate(new Date().toLocaleDateString('en-CA'));
      setIsSubmitting(false);
    }
  }, [isOpen, availableRounds]);

  const activeSelectedPanel = panels.find(p => p.id === Number(selectedPanelId));
  const activeAvailableSlots = activeSelectedPanel?.availabilities || [];
  const isRejectAction = selectedRoundType === "REJECT";

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
      const isCustom = !selectedSlotId || selectedSlotId === "custom";
      const slotIdNum = !isCustom ? Number(selectedSlotId) : undefined;
      
      const customScheduledAt = isCustom && selectedDate && selectedCustomTime 
        ? `${selectedDate}T${selectedCustomTime}` 
        : undefined;

      await onSchedule({
        roundType: actualRoundType,
        panelId: panelIdNum,
        slotId: slotIdNum,
        customScheduledAt,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = isRejectAction || (
    selectedDate && (
      (selectedPanelId && (
        (selectedSlotId && selectedSlotId !== "custom" && selectedSlotId !== "none") ||
        (selectedSlotId === "custom" && selectedCustomTime)
      )) ||
      (!selectedPanelId && selectedCustomTime)
    )
  );

  const availableSlotsForDate = activeAvailableSlots.filter(
    slot => slot.available_date === selectedDate
  );

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
                setSelectedCustomTime("");
                setShowCustomGrid(false);
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

          {!isRejectAction && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
              <input 
                type="date" 
                min={new Date().toLocaleDateString('en-CA')} 
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-0"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlotId("");
                  setSelectedCustomTime("");
                }}
              />
            </div>
          )}

          {!isRejectAction && selectedPanelId && !showCustomGrid && availableSlotsForDate.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Select Available Predefined Slot</span>
                <span className="text-[9px] text-green-600 font-semibold lowercase">matched availability</span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto">
                {availableSlotsForDate.map(slot => {
                  const isSelected = selectedSlotId === String(slot.id);
                  const slotDateTime = new Date(`${slot.available_date}T${slot.start_time}`);
                  const isPast = !isNaN(slotDateTime.getTime()) && slotDateTime <= new Date();

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={isPast}
                      onClick={() => {
                        setSelectedSlotId(String(slot.id));
                        setSelectedCustomTime("");
                      }}
                      className={cn(
                        "p-2 text-xs font-semibold rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-0.5",
                        isPast
                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                          : isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/20"
                      )}
                    >
                      <span>{slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}</span>
                      <span className="text-[9px] opacity-75 uppercase font-bold">{isPast ? "Passed" : "Available"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isRejectAction && selectedPanelId && availableSlotsForDate.length === 0 && !showCustomGrid && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 text-center font-medium">
              No predefined availability slots configured for this date.
            </div>
          )}

          {!isRejectAction && selectedPanelId && availableSlotsForDate.length > 0 && !showCustomGrid && (
            <button
              type="button"
              onClick={() => {
                setShowCustomGrid(true);
                setSelectedSlotId("custom");
                setSelectedCustomTime("");
              }}
              className="w-full py-2 border border-dashed border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 rounded-lg text-xs font-semibold text-center transition-all"
            >
              + Custom Time Slot
            </button>
          )}

          {!isRejectAction && (!selectedPanelId || showCustomGrid || availableSlotsForDate.length === 0) && (
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Time Slot (08:00 AM - 09:00 PM)</label>
                {selectedPanelId && availableSlotsForDate.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCustomGrid(false);
                      setSelectedSlotId("");
                      setSelectedCustomTime("");
                    }}
                    className="text-[9px] text-indigo-600 font-bold uppercase hover:underline"
                  >
                    ← Predefined Slots
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto border border-slate-100 p-2 rounded-lg bg-slate-50/50">
                {TIME_SLOTS.map(slot => {
                  const isSelected = selectedCustomTime === slot.start && (!selectedSlotId || selectedSlotId === "custom");
                  
                  // Check if slot has already passed
                  const isToday = selectedDate === new Date().toLocaleDateString('en-CA');
                  const slotDateTime = new Date(`${selectedDate}T${slot.start}`);
                  const isPast = isToday && !isNaN(slotDateTime.getTime()) && slotDateTime <= new Date();

                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={isPast}
                      onClick={() => {
                        setSelectedCustomTime(slot.start);
                        setSelectedSlotId("custom");
                      }}
                      className={cn(
                        "p-2 text-xs font-semibold rounded border text-center transition-all flex flex-col items-center justify-center gap-0.5",
                        isPast
                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                          : isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/20"
                      )}
                    >
                      <span>{slot.label.split(" - ")[0]}</span>
                      <span className="text-[9px] opacity-75 uppercase font-bold">{isPast ? "Passed" : "Select"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Cancel
          </Button>
          <Button 
            onClick={handleScheduleClick} 
            disabled={isSubmitting || !isFormValid}
            className={cn(
              "text-white text-xs h-8 px-4 font-semibold",
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
