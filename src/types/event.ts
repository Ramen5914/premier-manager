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
  // Thread + pre-event reminder tracking
  threadId: string | null;
  threadRosterMessageId: string | null;
  preEventReminderSent: boolean;
  // Post-match prompt & result tracking
  postMatchPromptMessageId: string | null;
  postMatchCountRecorded: boolean; // true once a reaction or fallback sets match count
  // Signup control for remaining week matches
  signupsDisabled: boolean; // when true, disable Accept/Decline for this match
}

export interface EventResponses {
  accepted: string[];
  declined: string[];
  tentative: string[];
}
