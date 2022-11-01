/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { now } from '../../../../common/helpers/moment-utils';
import { ctx, createAPartyApplication, createASubmissionRequest, createASubmissionResponse } from '../../test-utils/repo-helper.js';
import { updateSubmissionRequest, updateSubmissionResponse, getPropertiesWithCompleteScreeningsAndNoPushes } from '../fadv-submission-repo';
import { FadvRequestTypes } from '../../../../common/enums/fadvRequestTypes';
import { createAProperty } from '../../../../server/testUtils/repoHelper';
import { FADV_RESPONSE_STATUS } from '../../../common/screening-constants';
import { ScreeningDecision } from '../../../../common/enums/applicationTypes';
import { ScreeningResponseOrigin } from '../../helpers/applicant-types';

describe('dal/fadv-submission-repo - getPropertiesWithCompleteScreeningsAndNoPushes()', () => {
  const createSubmissionRequest = async propertyId => {
    const partyApplication = await createAPartyApplication(newId(), newId());
    return createASubmissionRequest({
      partyApplicationId: partyApplication.id,
      requestType: FadvRequestTypes.NEW,
      rawRequest: '',
      propertyId,
    });
  };

  const createSubmissionResponses = async (submissionRequestId, isComplete, requestCreatedAt, hasScreeningPush) => {
    const lastSubmissionResponse = {
      submissionRequestId,
      rawResponse: '',
      status: isComplete ? FADV_RESPONSE_STATUS.COMPLETE : FADV_RESPONSE_STATUS.INCOMPLETE,
      origin: hasScreeningPush ? ScreeningResponseOrigin.PUSH : ScreeningDecision.HTTP,
    };

    const { id: firstResponseId } = await createASubmissionResponse({
      ...lastSubmissionResponse,
      status: FADV_RESPONSE_STATUS.INCOMPLETE,
      origin: ScreeningDecision.HTTP,
    });

    const firstResponseCreatedAt = requestCreatedAt.clone().add(30, 'seconds');
    await updateSubmissionResponse(ctx, firstResponseId, {
      created_at: firstResponseCreatedAt,
    });

    const lastResponseCreatedAt = requestCreatedAt.clone().add(45, 'seconds');
    const { id: lastResponseId } = await createASubmissionResponse(lastSubmissionResponse);
    return await updateSubmissionResponse(ctx, lastResponseId, {
      created_at: lastResponseCreatedAt,
    });
  };

  let property1;
  let property2;
  let property3;
  let property4;

  const initializePropertyScreeningData = async properties => {
    const maxTime = 24; // hours

    await Promise.all(
      [
        // did have complete pushes in last 24 hours and also in period > 24 hours
        { propertyId: properties[0], isComplete: true, hasScreeningPush: true, time: maxTime - 1 },
        { propertyId: properties[0], isComplete: true, hasScreeningPush: true, time: maxTime - 12 },
        { propertyId: properties[0], isComplete: true, hasScreeningPush: true, time: maxTime + 10 },
        { propertyId: properties[0], isComplete: true, hasScreeningPush: false, time: maxTime - 5 },
        { propertyId: properties[0], isComplete: false, hasScreeningPush: false, time: maxTime - 8 },

        // did not have complete pushes in last 24 hours but did in period > 24 hours
        { propertyId: properties[1], isComplete: true, hasScreeningPush: false, time: maxTime - 1 },
        { propertyId: properties[1], isComplete: true, hasScreeningPush: true, time: maxTime + 1 },
        { propertyId: properties[1], isComplete: true, hasScreeningPush: true, time: maxTime + 2 },
        { propertyId: properties[1], isComplete: true, hasScreeningPush: false, time: maxTime - 3 },
        { propertyId: properties[1], isComplete: false, hasScreeningPush: false, time: maxTime - 10 },

        // did have complete pushes in last 24 hours but did not in period > 24 hours
        { propertyId: properties[2], isComplete: true, hasScreeningPush: true, time: maxTime - 3 },
        { propertyId: properties[2], isComplete: true, hasScreeningPush: true, time: maxTime - 8 },
        { propertyId: properties[2], isComplete: true, hasScreeningPush: false, time: maxTime + 5 },
        { propertyId: properties[2], isComplete: true, hasScreeningPush: false, time: maxTime + 13 },
        { propertyId: properties[2], isComplete: false, hasScreeningPush: false, time: maxTime - 12 },

        // did not have complete pushes in last 24 hours but did in period > 24 hours
        { propertyId: properties[3], isComplete: true, hasScreeningPush: false, time: maxTime - 10 },
        { propertyId: properties[3], isComplete: true, hasScreeningPush: true, time: maxTime + 12 },
        { propertyId: properties[3], isComplete: true, hasScreeningPush: true, time: maxTime + 10 },
        { propertyId: properties[3], isComplete: false, hasScreeningPush: false, time: maxTime - 12 },
        { propertyId: properties[3], isComplete: false, hasScreeningPush: false, time: maxTime - 10 },
      ].map(async ({ propertyId, isComplete, hasScreeningPush, time, timeFrame = 'hours' }) => {
        const requestCreatedAt = now().add(-time, timeFrame);
        const { id: submissionRequestId } = await createSubmissionRequest(propertyId);
        await updateSubmissionRequest(ctx, submissionRequestId, {
          created_at: requestCreatedAt.toDate(),
        });

        return await createSubmissionResponses(submissionRequestId, isComplete, requestCreatedAt, hasScreeningPush);
      }),
    );
  };

  beforeEach(async () => {
    // will create 4 properties with sample screening data
    [property1, property2, property3, property4] = await Promise.all([createAProperty(), createAProperty(), createAProperty(), createAProperty()]);
    await initializePropertyScreeningData([property1, property2, property3, property4].map(property => property.id));
  });

  describe('given a request to get the properties with complete screenings having no pushed responses', () => {
    it('should return a list of properties with possible screening misconfiguration', async () => {
      let properties = await getPropertiesWithCompleteScreeningsAndNoPushes(ctx);
      expect(properties.length).to.be.equal(2);
      expect(properties.some(({ id }) => id === property2.id)).to.be.true;
      expect(properties.some(({ id }) => id === property4.id)).to.be.true;

      properties = await getPropertiesWithCompleteScreeningsAndNoPushes(ctx, 24, 48);
      expect(properties.length).to.be.equal(1);
      expect(properties[0].id).to.be.equal(property3.id);
    });

    it('should return an empty list of properties in a period with no screening data', async () => {
      const properties = await getPropertiesWithCompleteScreeningsAndNoPushes(ctx, 48, 72);
      expect(properties.length).to.be.equal(0);
    });
  });
});
