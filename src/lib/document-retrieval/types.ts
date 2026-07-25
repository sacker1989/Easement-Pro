export interface RecorderOffice {
  name: string;
  address: string;
  hours: string;
  searchRooms: Array<{ room: string; coverage: string }>;
}

export interface CopyFeeSchedule {
  certifiedFirstPage: number;
  certifiedAdditionalPage: number;
  firstConformedCopy: number;
  currency: 'USD';
  notes: string;
}

export interface MailRequestInfo {
  address: string;
  process: string;
}

export interface LaCountyFallbackData {
  recorderOffices: RecorderOffice[];
  copyFeeSchedule: CopyFeeSchedule;
  indexStructure: string[];
  mailRequest: MailRequestInfo;
  /**
   * Phase 1 hardcodes this data from the strategy doc rather than a live source.
   * Research Agent must confirm it against the Registrar-Recorder's current
   * published information before this ships to real users.
   */
  needsLiveVerificationBeforeLaunch: true;
}

export interface GeneralGuidance {
  message: string;
  steps: string[];
  routeTo: 'track-3';
}
