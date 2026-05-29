export interface PanelAvailability {
  id: number;
  panel_id: number;
  available_date: string;
  start_time: string;
  end_time: string;
}

export interface PanelMember {
  id: number;
  name: string;
  email: string;
  interview_for: string;
  availabilities: PanelAvailability[];
}
