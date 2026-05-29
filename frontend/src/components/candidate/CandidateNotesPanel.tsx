import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CandidateNote } from "@/types/candidate";

interface CandidateNotesPanelProps {
  notes: CandidateNote[];
  onAddNote: (comment: string) => Promise<void>;
}

export const CandidateNotesPanel: React.FC<CandidateNotesPanelProps> = ({
  notes,
  onAddNote,
}) => {
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNoteClick = async () => {
    if (!newNote.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddNote(newNote);
      setNewNote("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 text-slate-700">
      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
        <MessageSquare className="h-4 w-4 mr-2 text-slate-400" /> Internal Notes
      </h3>
      
      <div className="flex flex-col gap-3">
        <Textarea
          placeholder="Add a note, application observations, or recruiter comments..."
          className="resize-none h-20 text-xs bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <Button
          size="sm"
          onClick={handleAddNoteClick}
          disabled={isSubmitting || !newNote.trim()}
          className="self-end bg-slate-900 hover:bg-slate-800 text-xs text-white px-4 h-8 font-semibold"
        >
          {isSubmitting ? "Adding..." : "Add Note"}
        </Button>
      </div>

      <div className="space-y-3 mt-6 pt-4 border-t border-slate-100">
        {notes.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No internal notes recorded yet.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-slate-50/50 border border-slate-150 rounded-lg p-3 text-xs">
              <p className="text-slate-850 whitespace-pre-wrap leading-relaxed">{note.comment}</p>
              <p className="text-[9px] text-slate-400 mt-2 font-medium">
                Added {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
