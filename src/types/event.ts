export interface PremierEvent {
  week: number;
  type: 'Practice' | 'Match' | 'Playoff';
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
  // Match result tracking
  match1Result?: 'win' | 'loss' | 'unplayed';
  match2Result?: 'win' | 'loss' | 'unplayed';
}

export interface EventResponses {
  accepted: string[];
  declined: string[];
  tentative: string[];
}
