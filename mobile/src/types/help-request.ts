export type HelpRequestStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

export interface HelpRequestItem {
  id: string;
  description: string | null;
  status: HelpRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface HelpRequestsResponse {
  items: HelpRequestItem[];
}
