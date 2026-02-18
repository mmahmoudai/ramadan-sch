export type ChallengeScope = "daily" | "weekly" | "monthly";

export interface Challenge {
  id: string;
  userId: string;
  title: string;
  description: string;
  scope: ChallengeScope;
  active: boolean;
  createdAt: string;
}

export interface ChallengePeriod {
  id: string;
  challengeId: string;
  hijriYear: number;
  hijriMonth: number | null;
  hijriWeekIndex: number | null;
  startDateGregorian: string;
  endDateGregorian: string;
}

export interface ChallengeProgress {
  id: string;
  challengePeriodId: string;
  dateGregorian: string;
  progressValue: number;
  notes: string;
  completed: boolean;
}

export interface CreateChallengeRequest {
  title: string;
  description: string;
  scope: ChallengeScope;
}
