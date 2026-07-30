import React, { useEffect, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Users,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Mail,
  Briefcase,
  Filter,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/SearchInput";
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
import { cn } from "@/lib/utils";

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

const PanelPage: React.FC = () => {
  const [panels, setPanels] = useState<PanelMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [newPanelName, setNewPanelName] = useState("");
  const [newPanelEmail, setNewPanelEmail] = useState("");
  const [newPanelRole, setNewPanelRole] = useState("");

  const [selectedPanel, setSelectedPanel] = useState<PanelMember | null>(null);
  const [availDate, setAvailDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Search & Filter States (Applied Filters)
  const [panelSearch, setPanelSearch] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [selectedAvailability, setSelectedAvailability] = useState<string>("");
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] =
    useState<string>("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  // Temporary Filter States (used while modal is open)
  const [tempExpertise, setTempExpertise] = useState<string[]>([]);
  const [tempAvailability, setTempAvailability] = useState<string>("");
  const [tempAvailabilityDate, setTempAvailabilityDate] = useState<string>("");
  const [expertiseSearch, setExpertiseSearch] = useState("");

  const uniqueExpertiseList = React.useMemo(() => {
    const roles = new Set<string>();
    panels.forEach((p) => {
      if (p.interview_for) {
        p.interview_for.split(",").forEach((r) => {
          const trimmed = r.trim();
          if (trimmed) roles.add(trimmed);
        });
      }
    });
    return Array.from(roles).sort();
  }, [panels]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (selectedExpertise.length > 0) count++;
    if (selectedAvailability) count++;
    return count;
  }, [selectedExpertise, selectedAvailability]);

  const handleClearAllFilters = () => {
    setSelectedExpertise([]);
    setSelectedAvailability("");
    setSelectedAvailabilityDate("");
  };

  const handleApplyFilters = () => {
    setSelectedExpertise(tempExpertise);
    setSelectedAvailability(tempAvailability);
    setSelectedAvailabilityDate(tempAvailabilityDate);
    setIsFilterDialogOpen(false);
  };

  const handleCloseFilterDialog = (open: boolean) => {
    if (!open) {
      // Reset temp states to current applied filters
      setTempExpertise(selectedExpertise);
      setTempAvailability(selectedAvailability);
      setTempAvailabilityDate(selectedAvailabilityDate);
      setExpertiseSearch("");
    } else {
      // Initialize temp states from applied filters when opening
      setTempExpertise(selectedExpertise);
      setTempAvailability(selectedAvailability);
      setTempAvailabilityDate(selectedAvailabilityDate);
      setExpertiseSearch("");
    }
  };

  const filteredPanels = React.useMemo(() => {
    return panels.filter((panel) => {
      // Search matching (name, email, role)
      const matchesSearch =
        panel.name.toLowerCase().includes(panelSearch.toLowerCase()) ||
        panel.email.toLowerCase().includes(panelSearch.toLowerCase()) ||
        (panel.interview_for || "")
          .toLowerCase()
          .includes(panelSearch.toLowerCase());

      // Expertise matching
      let matchesExpertise = true;
      if (selectedExpertise.length > 0) {
        const panelRoles = panel.interview_for
          ? panel.interview_for.split(",").map((r) => r.trim().toLowerCase())
          : [];
        matchesExpertise = selectedExpertise.some((exp) =>
          panelRoles.includes(exp.toLowerCase()),
        );
      }

      // Availability matching
      let matchesAvailability = true;
      if (selectedAvailability) {
        const now = new Date();
        const todayStr = now.toLocaleDateString("en-CA");

        if (selectedAvailability === "today") {
          matchesAvailability = panel.availabilities.some(
            (avail) => avail.available_date === todayStr,
          );
        } else if (selectedAvailability === "week") {
          const weekLater = new Date();
          weekLater.setDate(now.getDate() + 7);
          matchesAvailability = panel.availabilities.some((avail) => {
            const availDate = new Date(avail.available_date);
            return avail.available_date >= todayStr && availDate <= weekLater;
          });
        } else if (
          selectedAvailability === "date" &&
          selectedAvailabilityDate
        ) {
          matchesAvailability = panel.availabilities.some(
            (avail) => avail.available_date === selectedAvailabilityDate,
          );
        }
      }

      return matchesSearch && matchesExpertise && matchesAvailability;
    });
  }, [
    panels,
    panelSearch,
    selectedExpertise,
    selectedAvailability,
    selectedAvailabilityDate,
  ]);

  useEffect(() => {
    fetchPanels();
  }, []);

  // Clear selected slots and date when panelist selection changes
  useEffect(() => {
    setSelectedSlots([]);
    setAvailDate("");
  }, [selectedPanel]);

  // Clear selected slots when date changes
  useEffect(() => {
    setSelectedSlots([]);
  }, [availDate]);

  const fetchPanels = async () => {
    try {
      const data = await panelService.getPanelMembers();
      setPanels(data);
      if (selectedPanel) {
        const updated = data.find((p) => p.id === selectedPanel.id);
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
        interview_for: newPanelRole,
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
    if (!selectedPanel || !availDate || selectedSlots.length === 0) return;
    setIsAdding(true);
    try {
      // Create availability for each selected 30-minute block sequentially
      for (const slotKey of selectedSlots) {
        const [start, end] = slotKey.split("_");
        await panelService.addAvailability(selectedPanel.id, {
          available_date: availDate,
          start_time: `${start}:00`,
          end_time: `${end}:00`,
        });
      }
      setSelectedSlots([]);
      fetchPanels();
    } catch (error: any) {
      alert(
        error.response?.data?.detail ||
          "Failed to add availability. Ensure times are correct.",
      );
    } finally {
      setIsAdding(false);
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
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        {/* Left List */}
        <div className="flex w-[40%] min-w-0 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">Panel</h1>
              </div>
              <p className="text-sm text-slate-500">
                Manage internal interviewers
              </p>
            </div>

            <Dialog open={isAddPanelOpen} onOpenChange={setIsAddPanelOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-slate-900">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Panel Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">
                      Name
                    </label>
                    <Input
                      value={newPanelName}
                      placeholder="Full Name"
                      onChange={(e) => setNewPanelName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">
                      Email
                    </label>
                    <Input
                      value={newPanelEmail}
                      placeholder="Email"
                      onChange={(e) => setNewPanelEmail(e.target.value)}
                      type="email"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">
                      Role / Interview For
                    </label>
                    <Input
                      value={newPanelRole}
                      onChange={(e) => setNewPanelRole(e.target.value)}
                      placeholder="eg. Developer"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    onClick={handleAddPanel}
                    className="w-full bg-slate-900"
                  >
                    Add Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-2 bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <SearchInput
                value={panelSearch}
                onChange={(val) => setPanelSearch(val)}
                placeholder="Search panelists..."
                className="w-full flex-1"
              />
              <Dialog
                open={isFilterDialogOpen}
                onOpenChange={(open) => {
                  handleCloseFilterDialog(open);
                  setIsFilterDialogOpen(open);
                }}
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
                <DialogContent className="sm:max-w-[450px] max-h-[70vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Filter Panelists</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
                    {/* Expertise / Role Checklist */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Expertise / Role
                      </h4>
                      <div className="relative mb-2">
                        <Input
                          type="text"
                          placeholder="Search expertise..."
                          value={expertiseSearch}
                          onChange={(e) => setExpertiseSearch(e.target.value)}
                          className="px-3 py-1.5 text-xs border-slate-200 bg-white"
                        />
                      </div>
                      {uniqueExpertiseList.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No roles available to filter.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-slate-50/50">
                          {uniqueExpertiseList
                            .filter((role) =>
                              role
                                .toLowerCase()
                                .includes(expertiseSearch.toLowerCase()),
                            )
                            .map((role) => {
                              const isSelected = tempExpertise.includes(role);
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setTempExpertise((prev) =>
                                        prev.filter((r) => r !== role),
                                      );
                                    } else {
                                      setTempExpertise((prev) => [
                                        ...prev,
                                        role,
                                      ]);
                                    }
                                  }}
                                  className={cn(
                                    "px-2.5 py-1 text-xs font-medium rounded transition-all border",
                                    isSelected
                                      ? "bg-indigo-600 border-indigo-600 text-white"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/10",
                                  )}
                                >
                                  {role}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Availability Filter */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Availability
                      </h4>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {[
                          { id: "", label: "All Availability" },
                          { id: "today", label: "Available Today" },
                          { id: "week", label: "Available This Week" },
                          { id: "date", label: "Select Date..." },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setTempAvailability(opt.id);
                              if (opt.id !== "date") {
                                setTempAvailabilityDate("");
                              }
                            }}
                            className={cn(
                              "px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all",
                              tempAvailability === opt.id
                                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {tempAvailability === "date" && (
                        <div className="mt-2 animate-in fade-in duration-200">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                            Date
                          </label>
                          <Input
                            type="date"
                            value={tempAvailabilityDate}
                            onChange={(e) =>
                              setTempAvailabilityDate(e.target.value)
                            }
                            className="h-9 bg-white text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-0 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setTempExpertise([]);
                        setTempAvailability("");
                        setTempAvailabilityDate("");
                        setExpertiseSearch("");
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
              <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t border-slate-100 mt-1 animate-in fade-in duration-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Filters:
                </span>
                {selectedExpertise.map((role) => (
                  <Badge
                    key={role}
                    variant="secondary"
                    className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-150 flex items-center gap-1 border border-slate-200 font-medium py-0 px-1.5"
                  >
                    {role}
                    <button
                      onClick={() =>
                        setSelectedExpertise((prev) =>
                          prev.filter((r) => r !== role),
                        )
                      }
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                {selectedAvailability && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-150 flex items-center gap-1 border border-slate-200 font-medium py-0 px-1.5"
                  >
                    Avail:{" "}
                    {selectedAvailability === "today"
                      ? "Today"
                      : selectedAvailability === "week"
                        ? "Week"
                        : selectedAvailabilityDate || "Date"}
                    <button
                      onClick={() => {
                        setSelectedAvailability("");
                        setSelectedAvailabilityDate("");
                      }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 h-5 px-1.5 font-bold ml-auto"
                  onClick={handleClearAllFilters}
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 bg-slate-50/50">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                Loading panel members...
              </div>
            ) : panels.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No panel members added yet.
              </div>
            ) : filteredPanels.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No matching panel members found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPanels.map((panel) => (
                  <div
                    key={panel.id}
                    onClick={() => setSelectedPanel(panel)}
                    className={cn(
                      "p-5 cursor-pointer transition-all border-l-4",
                      selectedPanel?.id === panel.id
                        ? "bg-white border-l-indigo-500 shadow-md"
                        : "bg-slate-50/50 border-l-transparent hover:bg-white",
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {panel.name}
                        </h3>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <Mail className="h-3 w-3 mr-1" /> {panel.email}
                        </div>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          <Briefcase className="h-3 w-3 mr-1" />{" "}
                          {panel.interview_for}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePanel(panel.id);
                        }}
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/30 overflow-hidden">
          {selectedPanel ? (
            <div className="flex flex-col h-full">
              <div className="p-8 bg-white border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedPanel.name}
                </h2>
                <p className="text-slate-500 mt-1">
                  {selectedPanel.interview_for}
                </p>
              </div>

              <ScrollArea className="flex-1 p-8">
                <div className="max-w-3xl">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-indigo-500" />{" "}
                        Availability Slots
                      </h3>
                    </div>

                    <div className="p-5">
                      <div className="flex flex-col gap-4 mb-6 bg-slate-50 p-5 rounded-lg border border-slate-100">
                        <div className="flex flex-wrap gap-4 items-center justify-between">
                          <div className="w-[200px]">
                            <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">
                              Select Date
                            </label>
                            <Input
                              type="date"
                              min={new Date().toLocaleDateString("en-CA")}
                              value={availDate}
                              onChange={(e) => setAvailDate(e.target.value)}
                              className="h-9 bg-white text-xs"
                            />
                          </div>
                          {availDate && (
                            <div className="flex-1 flex justify-end">
                              <Button
                                onClick={handleAddAvailability}
                                disabled={
                                  selectedSlots.length === 0 || isAdding
                                }
                                className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4"
                              >
                                {isAdding
                                  ? "Adding..."
                                  : `Add ${selectedSlots.length} Selected Slot(s)`}
                              </Button>
                            </div>
                          )}
                        </div>

                        {availDate ? (
                          <div className="space-y-3 mt-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Predefined 30-Minute Blocks
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {TIME_SLOTS.map((slot) => {
                                const slotKey = `${slot.start}_${slot.end}`;
                                const isSelected =
                                  selectedSlots.includes(slotKey);

                                // Check if slot is in the past (only if selected date is today)
                                const isToday =
                                  availDate ===
                                  new Date().toLocaleDateString("en-CA");
                                const slotDateTime = new Date(
                                  `${availDate}T${slot.start}`,
                                );
                                const isPast =
                                  isToday &&
                                  !isNaN(slotDateTime.getTime()) &&
                                  slotDateTime <= new Date();

                                // Check if this availability slot is already created for this panelist
                                const isAlreadyCreated =
                                  selectedPanel.availabilities.some(
                                    (avail) =>
                                      avail.available_date === availDate &&
                                      avail.start_time.substring(0, 5) ===
                                        slot.start,
                                  );

                                return (
                                  <button
                                    key={slotKey}
                                    type="button"
                                    disabled={isPast || isAlreadyCreated}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedSlots((prev) =>
                                          prev.filter((s) => s !== slotKey),
                                        );
                                      } else {
                                        setSelectedSlots((prev) => [
                                          ...prev,
                                          slotKey,
                                        ]);
                                      }
                                    }}
                                    className={cn(
                                      "p-2.5 text-xs font-semibold rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-0.5",
                                      isAlreadyCreated
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed opacity-80"
                                        : isPast
                                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                          : isSelected
                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                            : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/20",
                                    )}
                                  >
                                    <span>{slot.label.split(" - ")[0]}</span>
                                    {isAlreadyCreated && (
                                      <span className="text-[9px] opacity-75 uppercase font-bold">
                                        Saved
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-slate-400">
                            Please select a date to view and configure
                            availability slots.
                          </div>
                        )}
                      </div>

                      {selectedPanel.availabilities.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No availability configured.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedPanel.availabilities.map((avail) => (
                            <div
                              key={avail.id}
                              className="flex justify-between items-center p-3 border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-sm font-semibold">
                                  {new Date(
                                    avail.available_date,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                                <div className="text-sm text-slate-600 flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {avail.start_time.substring(0, 5)} -{" "}
                                  {avail.end_time.substring(0, 5)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  handleDeleteAvailability(avail.id)
                                }
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
                <p>Select a panelist to see details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default PanelPage;
