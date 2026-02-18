export type ReportVisibility = "public" | "private";

export interface Report {
  id: string;
  ownerUserId: string;
  periodScope: string;
  periodStart: string;
  periodEnd: string;
  visibility: ReportVisibility;
  includeProfileInfo: boolean;
  publicToken: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ReportAccessLog {
  id: string;
  reportId: string;
  viewerUserId: string | null;
  accessType: "public" | "private";
  accessedAt: string;
}

export interface CreateReportRequest {
  periodScope: string;
  periodStart: string;
  periodEnd: string;
  visibility: ReportVisibility;
  includeProfileInfo: boolean;
}
