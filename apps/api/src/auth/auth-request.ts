import type { Request } from 'express';
import type { SessionInfo } from '@slotwise/shared';

export type AuthedRequest = Request & {
  auth: SessionInfo;
  sessionToken: string;
};
