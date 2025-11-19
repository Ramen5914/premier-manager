export interface PremierEvent {
  week: number;
  type: 'Practice' | 'Match';
  startTimestamp: number;
  endTimestamp: number;
  day: string;
  map: string;
  eventId: string;
  rosterAnnouncementMessageId: string | null;
  messageId: string | null;
}

export interface EventResponses {
  accepted: string[];
  declined: string[];
  tentative: string[];
}
