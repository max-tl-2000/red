/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { REVA_SERVICE_STATUS } from '../../../common/enums/applicationTypes';

const BLOCKED_STATUS_TRANS = 'BLOCKED'; // Blocked by 123abc

export const FADV_SERVICE_STATUS = {
  COMPLETED: 'COMPLETED',
  BLOCKED: BLOCKED_STATUS_TRANS,
  IN_PROCESS: 'IN PROCESS',
  INCOMPLETE: 'INCOMPLETE',
};

export const FADV_TO_DATABASE_SERVICE_STATUS_TRANS = {
  [FADV_SERVICE_STATUS.COMPLETED]: REVA_SERVICE_STATUS.COMPLETE,
  [FADV_SERVICE_STATUS.BLOCKED]: REVA_SERVICE_STATUS.BLOCKED,
  [FADV_SERVICE_STATUS.IN_PROCESS]: REVA_SERVICE_STATUS.IN_PROCESS,
  [FADV_SERVICE_STATUS.INCOMPLETE]: REVA_SERVICE_STATUS.INCOMPLETE,
};
