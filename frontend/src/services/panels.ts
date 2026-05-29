import api from "./api";
import type { PanelMember, PanelAvailability } from "../types/panel";

export const panelService = {
  async getPanelMembers(): Promise<PanelMember[]> {
    const response = await api.get<PanelMember[]>("/panels/");
    return response.data;
  },

  async createPanelMember(data: Omit<PanelMember, "id" | "availabilities">): Promise<PanelMember> {
    const response = await api.post<PanelMember>("/panels/", data);
    return response.data;
  },

  async deletePanelMember(id: number): Promise<void> {
    await api.delete(`/panels/${id}`);
  },

  async addAvailability(panelId: number, data: Omit<PanelAvailability, "id" | "panel_id">): Promise<PanelAvailability> {
    const response = await api.post<PanelAvailability>(`/panels/${panelId}/availability`, data);
    return response.data;
  },

  async deleteAvailability(availId: number): Promise<void> {
    await api.delete(`/panels/availability/${availId}`);
  },
};
