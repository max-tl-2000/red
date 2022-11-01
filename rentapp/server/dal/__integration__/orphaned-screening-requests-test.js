/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import config from '../../../config';
import { toMoment, now } from '../../../../common/helpers/moment-utils';
import { ctx, createAPartyApplication, createASubmissionRequest, createASubmissionResponse } from '../../test-utils/repo-helper.js';
import { getOrphanedScreeningRequests, updateSubmissionRequest, updateSubmissionResponse } from '../fadv-submission-repo';
import '../../../../server/testUtils/setupTestGlobalContext';
import { ScreeningDecision } from '../../../../common/enums/applicationTypes';
import { FadvRequestTypes } from '../../../../common/enums/fadvRequestTypes';

const { minOrphanedScreeningResponseAge } = config.fadv;
const orphanedResponseAge = minOrphanedScreeningResponseAge * 60 + 10;

describe('dal/fadv-submission-repo - orphaned screening requests', () => {
  const createSubmissionRequest = async isAlerted => {
    const propertyId = newId();
    const partyApplication = await createAPartyApplication(newId(), newId());
    const submissionRequest = {
      partyApplicationId: partyApplication.id,
      requestType: FadvRequestTypes.NEW,
      rawRequest: '',
      propertyId,
      applicantData: {},
      isAlerted,
    };
    return createASubmissionRequest(submissionRequest);
  };

  const createSubmissionResponse = async (submissionRequestId, options = { hasError: false, incomplete: false, isResponseInOrphanedTimeFrame: true }) => {
    const { hasError, incomplete, isResponseInOrphanedTimeFrame } = options;
    const submissionResponse = {
      submissionRequestId,
      rawResponse: '',
      applicationDecision: hasError ? ScreeningDecision.ERROR_OTHER : 'APPROVED',
      applicantDecision: [],
      externalId: '12345',
      status: incomplete ? 'Incomplete' : 'Complete',
    };

    const latestResponseCreatedAtTime = isResponseInOrphanedTimeFrame ? now().add(-orphanedResponseAge, 'seconds') : now();
    const { id: responseId } = await createASubmissionResponse(submissionResponse);
    const [response] = await updateSubmissionResponse(ctx, responseId, {
      created_at: latestResponseCreatedAtTime,
    });

    if (incomplete) {
      const { id: previousResponseId } = await createASubmissionResponse(submissionResponse);
      const previousResponseCreatedAtTime = latestResponseCreatedAtTime.clone().add(-60, 'seconds');
      await updateSubmissionResponse(ctx, previousResponseId, {
        created_at: previousResponseCreatedAtTime,
      });
    }

    return response;
  };

  const initializeScreeningData = async () => {
    const { minTime, maxTime } = config.fadv.screeningValidationInterval;
    const { minTime: longReqMinTime, maxTime: longReqMaxTime } = config.fadv.longRunningScreeningRequestsInterval;

    await Promise.all(
      [
        { orphanedScreening: true, hasError: false, incomplete: false, time: minTime - 2, isAlerted: true }, // not in time frame
        { orphanedScreening: false, hasError: false, incomplete: false, time: minTime - 1, isAlerted: true }, // not orphaned
        { orphanedScreening: true, hasError: false, incomplete: false, time: minTime + 1, isAlerted: true }, // orphaned in time frame
        { orphanedScreening: true, hasError: false, incomplete: false, time: minTime + 10, isAlerted: true }, // orphaned in time frame
        { orphanedScreening: true, hasError: false, incomplete: false, time: maxTime - 10, isAlerted: true }, // orphaned in time frame
        { orphanedScreening: false, hasError: false, incomplete: false, time: maxTime - 1, isAlerted: true }, // not orphaned
        { orphanedScreening: true, hasError: false, incomplete: false, time: maxTime + 1, isAlerted: true }, // orphaned not in time frame
        { orphanedScreening: true, hasError: true, incomplete: false, time: minTime + 1, isAlerted: true }, // ophaned in time frame with error
        { orphanedScreening: true, hasError: true, incomplete: false, time: maxTime + 2, isAlerted: true }, // ophaned not in time frame with error
        { orphanedScreening: true, hasError: false, incomplete: true, time: minTime + 1, isAlerted: true }, // ophaned in time frame by incomplete results
        { orphanedScreening: true, hasError: false, incomplete: true, time: minTime - 2, isAlerted: true }, // ophaned not in time frame by incomplete results
        { orphanedScreening: true, hasError: false, incomplete: true, time: minTime + 1, isAlerted: true, isResponseInOrphanedTimeFrame: false }, // ophaned in time frame by incomplete results but response not in orphaned state
        { orphanedScreening: true, hasError: false, incomplete: false, time: longReqMinTime - 1, timeFrame: 'minutes' }, // long request not in time frame
        { orphanedScreening: true, hasError: false, incomplete: false, time: longReqMinTime + 2, timeFrame: 'minutes' }, // long request in time frame
        { orphanedScreening: true, hasError: false, incomplete: false, time: longReqMaxTime - 2, timeFrame: 'minutes' }, // long request in time frame
        { orphanedScreening: true, hasError: false, incomplete: false, time: longReqMaxTime, timeFrame: 'minutes', isAlerted: true }, // long request in time frame but alerted
        { orphanedScreening: true, hasError: false, incomplete: false, time: longReqMaxTime + 1, timeFrame: 'minutes', isAlerted: true }, // long request not in time frame
        { orphanedScreening: true, hasError: true, incomplete: false, time: longReqMinTime + 2, timeFrame: 'minutes' }, // long request in time frame with error
        { orphanedScreening: true, hasError: true, incomplete: false, time: longReqMaxTime + 2, timeFrame: 'minutes' }, // long request outside of time frame with error
        { orphanedScreening: true, hasError: true, incomplete: false, time: longReqMinTime + 2, timeFrame: 'minutes', isAlerted: true }, // long request in time frame with error but alerted
        { orphanedScreening: true, hasError: false, incomplete: true, time: longReqMinTime + 3, timeFrame: 'minutes' }, // long request in time frame with incomplete results
        { orphanedScreening: true, hasError: false, incomplete: true, time: longReqMaxTime + 3, timeFrame: 'minutes' }, // long request not in time frame with incomplete results
        { orphanedScreening: true, hasError: false, incomplete: true, time: longReqMinTime + 3, timeFrame: 'minutes', isAlerted: true }, // long request in time frame with incomplete results but alerted
        { orphanedScreening: true, hasError: false, incomplete: true, time: longReqMinTime + 3, timeFrame: 'minutes', isResponseInOrphanedTimeFrame: false }, // long request in time frame with incomplete results but response not in orphaned state
      ].map(async ({ orphanedScreening, hasError, incomplete, time, timeFrame = 'hours', isAlerted = false, isResponseInOrphanedTimeFrame = true }) => {
        const options = { isResponseInOrphanedTimeFrame, hasError, incomplete };
        const createdAt = toMoment(new Date()).add(-time, timeFrame);
        const { id: submissionRequestId } = await createSubmissionRequest(isAlerted);
        if (orphanedScreening) {
          const [submissionRequest] = await updateSubmissionRequest(ctx, submissionRequestId, {
            created_at: createdAt.toDate(),
          });

          return hasError || incomplete ? await createSubmissionResponse(submissionRequestId, options) : submissionRequest;
        }
        return createSubmissionResponse(submissionRequestId);
      }),
    );
  };

  describe('given a request to get the orphaned screening requests in a interval of time', () => {
    it('should return orphaned request', async () => {
      await initializeScreeningData();
      const { minTime, maxTime } = config.fadv.screeningValidationInterval;
      const orphanedSreeningResults = await getOrphanedScreeningRequests(ctx, { minTime, maxTime });
      expect(orphanedSreeningResults.length).to.be.equal(5);
    });
  });

  describe('given a request to get long running unalerted screening requests', () => {
    it('should return long running submission requests', async () => {
      await initializeScreeningData();
      const { minTime, maxTime } = config.fadv.longRunningScreeningRequestsInterval;
      const unalertedScreeningRequests = await getOrphanedScreeningRequests(ctx, { minTime, maxTime, timeFrame: 'minutes' }, true);
      expect(unalertedScreeningRequests.length).to.be.equal(4);
    });
  });
});
