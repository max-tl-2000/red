/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment, now } from '../../../common/helpers/moment-utils';
import loggerModule from '../../../common/helpers/logger';
import { CommTargetType } from './targetUtils';
import { loadProgramForIncomingCommById } from '../../dal/programsRepo';

const logger = loggerModule.child({ subType: 'comms' });

export const PROGRAM_FALLBACK_NONE = 'NONE';

const isValidProgram = program => {
  const timezone = program?.timezone;
  return (
    program &&
    (!program.endDate ||
      toMoment(program.endDate, { timezone }).isAfter(now({ timezone })) ||
      (toMoment(program.endDate, { timezone }).isSameOrBefore(now({ timezone })) && program.programFallbackId))
  );
};

export const getTargetForProgram = async ({ ctx, program, identifier }) => {
  if (program && program.endDate && toMoment(program.endDate, { timezone: program.timezone }).isSameOrBefore(now({ timezone: program.timezone }))) {
    if (!program.programFallbackId) {
      logger.trace({ ctx, program }, 'Skipping communication process - No fallback program for the inactive program');
      return { type: CommTargetType.PROGRAM, id: program.id, program, shouldIgnore: true };
    }

    const fallbackProgram = await loadProgramForIncomingCommById(ctx, program.programFallbackId, { includeInactive: true });

    if (!isValidProgram(fallbackProgram)) {
      logger.error(
        { ctx, identifier },
        `Invalid fallback program for identifier: ${fallbackProgram?.directEmailIdentifier}, ${fallbackProgram?.directPhoneIdentifier}`,
      );
      return {};
    }

    logger.trace({ ctx, oridinalProgram: program, fallbackProgram }, 'communication forwarded to the fallback program');

    return {
      type: CommTargetType.PROGRAM,
      id: fallbackProgram.id,
      program: fallbackProgram,
      originalProgram: program,
    };
  }

  return {
    type: CommTargetType.PROGRAM,
    id: program.id,
    program,
  };
};

export const shouldIgnoreProgram = contextData => !!contextData.communicationContext.targetContext.shouldIgnore;
