/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ScreeningVersion } from '../../../common/enums/screeningReportTypes.ts';
import { processNextScreeningAction as processNextScreeningV1Action } from './v1/screening-actions';
import { processNextScreeningAction as processNextScreeningV2Action } from './v2/screening-actions.ts';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'workflow' });

export const performNextScreeningAction = async (ctx, message, options = {}) => {
  const { version = ScreeningVersion.V1, eventType } = options;
  logger.trace({ ctx, version, screeningMessage: message, eventType }, 'performNextScreeningAction');

  const actionResult = await (version === ScreeningVersion.V2
    ? processNextScreeningV2Action(ctx, message)
    : processNextScreeningV1Action(ctx, message, eventType));

  logger.trace('Leaving performNextScreeningAction');

  return actionResult;
};
