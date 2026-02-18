export type MemberRole = "owner" | "member";
export type MemberStatus = "invited" | "active";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalScope = "dashboard" | "reports";

export interface FamilyGroup {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  familyGroupId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
}

export interface VisibilityApproval {
  id: string;
  ownerUserId: string;
  viewerUserId: string;
  scope: ApprovalScope;
  status: ApprovalStatus;
}

export interface Comment {
  id: string;
  ownerUserId: string;
  authorUserId: string;
  targetType: string;
  targetId: string;
  body: string;
  hiddenByOwner: boolean;
  deletedByOwner: boolean;
  createdAt: string;
}

export interface Reaction {
  id: string;
  ownerUserId: string;
  authorUserId: string;
  targetType: string;
  targetId: string;
  reactionType: string;
  createdAt: string;
}
