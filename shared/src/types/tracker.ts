export type EntryStatus = "open" | "locked";

export interface DailyEntry {
  id: string;
  userId: string;
  gregorianDate: string;
  hijriYear: number;
  hijriMonth: number;
  hijriDay: number;
  timezoneSnapshot: string;
  lockAtUtc: string;
  status: EntryStatus;
  createdAt: string;
}

export interface DailyEntryField {
  id: string;
  dailyEntryId: string;
  fieldKey: string;
  fieldType: "checkbox" | "text" | "radio" | "textarea";
  valueJson: unknown;
  completedBool: boolean;
  updatedAt: string;
}

export interface SaveEntryRequest {
  fields: Record<string, unknown>;
}

export interface TrackerSection {
  key: string;
  label: string;
  labelAr: string;
  fields: TrackerFieldDef[];
}

export interface TrackerFieldDef {
  key: string;
  type: "checkbox" | "text" | "radio" | "textarea";
  label: string;
  labelAr: string;
  options?: { value: string; label: string; labelAr: string }[];
}
