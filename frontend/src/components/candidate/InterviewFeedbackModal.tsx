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
import type { Interview } from "@/types/interview";

interface InterviewFeedbackModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  interview: Interview | null;
  candidateName?: string;
  onSubmitFeedback: (outcome: string, feedbackNotes: string) => Promise<void>;
}

export const InterviewFeedbackModal: React.FC<InterviewFeedbackModalProps> = ({
  isOpen,
  onOpenChange,
  interview,
  candidateName = "the candidate",
  onSubmitFeedback,
}) => {
  const [outcome, setOutcome] = useState("Pass");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setOutcome("Pass");
      setFeedbackNotes("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmitFeedback(outcome, feedbackNotes);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white border border-slate-200 shadow-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 text-base font-semibold">Submit Interview Feedback</DialogTitle>
        </DialogHeader>
        
        {interview && (
          <div className="grid gap-4 py-3 text-slate-700">
            <div className="text-xs text-slate-500 mb-1 leading-relaxed bg-slate-50 border border-slate-100 p-2.5 rounded-md">
              Submitting feedback for <strong className="text-slate-700">{candidateName}</strong>'s{" "}
              <strong className="text-slate-700">{interview.round_type}</strong> round with interviewer{" "}
              <strong className="text-slate-700">{interview.panel_member?.name || "Unassigned"}</strong>.
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outcome Decision</label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="border-slate-200 text-xs">
                  <SelectValue placeholder="Decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pass" className="text-xs text-green-700">Pass - Recommended for Next Stage</SelectItem>
                  <SelectItem value="Hold" className="text-xs text-amber-700">Hold - Needs Review / Re-evaluation</SelectItem>
                  <SelectItem value="Fail" className="text-xs text-red-700">Fail - Does Not Match Requirements</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evaluation & Notes</label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-0"
                placeholder="Type comprehensive feedback notes, technical performance details, and recruiter remarks..."
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !feedbackNotes.trim()}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8 font-semibold"
          >
            {isSubmitting ? "Submitting..." : "Submit Decision"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
