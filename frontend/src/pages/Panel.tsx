import React, { useEffect, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { Users, Plus, Trash2, Calendar, Clock, Mail, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { panelService } from "@/services/panels";
import type { PanelMember } from "@/types/panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const PanelPage: React.FC = () => {
  const [panels, setPanels] = useState<PanelMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [newPanelName, setNewPanelName] = useState("");
  const [newPanelEmail, setNewPanelEmail] = useState("");
  const [newPanelRole, setNewPanelRole] = useState("");

  const [selectedPanel, setSelectedPanel] = useState<PanelMember | null>(null);
  const [availDate, setAvailDate] = useState("");
  const [availStart, setAvailStart] = useState("");
  const [availEnd, setAvailEnd] = useState("");

  useEffect(() => {
    fetchPanels();
  }, []);

  const fetchPanels = async () => {
    try {
      const data = await panelService.getPanelMembers();
      setPanels(data);
      if (selectedPanel) {
        const updated = data.find(p => p.id === selectedPanel.id);
        if (updated) setSelectedPanel(updated);
      }
    } catch (error) {
      console.error("Failed to fetch panel members", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPanel = async () => {
    if (!newPanelName || !newPanelEmail || !newPanelRole) return;
    try {
      await panelService.createPanelMember({
        name: newPanelName,
        email: newPanelEmail,
        interview_for: newPanelRole
      });
      setNewPanelName("");
      setNewPanelEmail("");
      setNewPanelRole("");
      setIsAddPanelOpen(false);
      fetchPanels();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to add panel member");
    }
  };

  const handleDeletePanel = async (id: number) => {
    if (!confirm("Delete this panel member?")) return;
    try {
      await panelService.deletePanelMember(id);
      if (selectedPanel?.id === id) setSelectedPanel(null);
      fetchPanels();
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const handleAddAvailability = async () => {
    if (!selectedPanel || !availDate || !availStart || !availEnd) return;
    try {
      // API expects start_time and end_time, e.g., "14:00:00"
      await panelService.addAvailability(selectedPanel.id, {
        available_date: availDate,
        start_time: availStart.includes(":") && availStart.length === 5 ? `${availStart}:00` : availStart,
        end_time: availEnd.includes(":") && availEnd.length === 5 ? `${availEnd}:00` : availEnd
      });
      setAvailDate("");
      setAvailStart("");
      setAvailEnd("");
      fetchPanels();
    } catch (error: any) {
      alert("Failed to add availability. Ensure times are correct.");
    }
  };

  const handleDeleteAvailability = async (availId: number) => {
    try {
      await panelService.deleteAvailability(availId);
      fetchPanels();
    } catch (error) {
      console.error("Failed to delete availability", error);
    }
  };

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-0px)] overflow-hidden">
        {/* Left List */}
        <div className="flex w-[35%] flex-col border-r border-slate-200 bg-white">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">Panel</h1>
              </div>
              <p className="text-sm text-slate-500">Manage internal interviewers</p>
            </div>
            
            <Dialog open={isAddPanelOpen} onOpenChange={setIsAddPanelOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-slate-900"><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Panel Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">Name</label>
                    <Input value={newPanelName} onChange={e => setNewPanelName(e.target.value)} placeholder="Jane Doe" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">Email</label>
                    <Input value={newPanelEmail} onChange={e => setNewPanelEmail(e.target.value)} type="email" placeholder="jane@example.com" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">Role / Interview For</label>
                    <Input value={newPanelRole} onChange={e => setNewPanelRole(e.target.value)} placeholder="Senior Frontend Developer" className="mt-1" />
                  </div>
                  <Button onClick={handleAddPanel} className="w-full bg-slate-900">Add Member</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1 bg-slate-50/50">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading panel members...</div>
            ) : panels.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No panel members added yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {panels.map(panel => (
                  <div 
                    key={panel.id}
                    onClick={() => setSelectedPanel(panel)}
                    className={`p-5 cursor-pointer transition-colors ${selectedPanel?.id === panel.id ? 'bg-white border-l-4 border-l-indigo-500 shadow-sm' : 'hover:bg-white border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-900">{panel.name}</h3>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <Mail className="h-3 w-3 mr-1" /> {panel.email}
                        </div>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <Briefcase className="h-3 w-3 mr-1" /> {panel.interview_for}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleDeletePanel(panel.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Details */}
        <div className="flex-1 bg-slate-50/30 overflow-hidden">
          {selectedPanel ? (
            <div className="flex flex-col h-full">
              <div className="p-8 bg-white border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900">{selectedPanel.name}</h2>
                <p className="text-slate-500 mt-1">{selectedPanel.interview_for}</p>
              </div>

              <ScrollArea className="flex-1 p-8">
                <div className="max-w-3xl">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-indigo-500" /> Availability Slots
                      </h3>
                    </div>
                    
                    <div className="p-5">
                      <div className="grid grid-cols-4 gap-3 items-end mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="col-span-1">
                          <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Date</label>
                          <Input type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} className="h-9" />
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Start Time</label>
                          <Input type="time" value={availStart} onChange={e => setAvailStart(e.target.value)} className="h-9" />
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">End Time</label>
                          <Input type="time" value={availEnd} onChange={e => setAvailEnd(e.target.value)} className="h-9" />
                        </div>
                        <div className="col-span-1">
                          <Button onClick={handleAddAvailability} className="w-full h-9 bg-indigo-600 hover:bg-indigo-700">Add Slot</Button>
                        </div>
                      </div>

                      {selectedPanel.availabilities.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No availability configured.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedPanel.availabilities.map(avail => (
                            <div key={avail.id} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-sm font-semibold">
                                  {new Date(avail.available_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="text-sm text-slate-600 flex items-center">
                                  <Clock className="h-3 w-3 mr-1" /> 
                                  {avail.start_time.substring(0, 5)} - {avail.end_time.substring(0, 5)}
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteAvailability(avail.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Select a panel member to manage availability</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default PanelPage;
