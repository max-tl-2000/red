/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { partialRawResponse } from '../../../helpers/__tests__/fixtures/screening-helper-test-data';
import { FADV_RESPONSE_CUSTOM_RECORDS } from '../../../screening/fadv/screening-report-parser.ts';

import { ScreeningVersion } from '../../../../../common/enums/screeningReportTypes.ts';

const { mockModules } = require('../../../../../common/test-helpers/mocker').default(jest);

describe('handleScreeningResponseReceived', () => {
  let handleScreeningResponseReceived;

  const defaultMocks = () => ({
    processScreeningResponseV1Received: jest.fn(() => ({ processed: true })),
    processScreeningResponseV2Received: jest.fn(() => ({ processed: true })),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../v1/screening-report-response-handler': {
        processScreeningResponseReceived: mocks.processScreeningResponseV1Received,
      },
      '../v2/screening-report-response-handler': {
        processScreeningResponseReceived: mocks.processScreeningResponseV2Received,
      },
    });
    const screeningResponseHandler = require('../screening-handler-response'); // eslint-disable-line global-require
    handleScreeningResponseReceived = screeningResponseHandler.handleScreeningResponseReceived;
  };

  const buildResponseMessage = version => ({
    tenantId: newId(),
    screeningResponse: {
      ApplicantScreening: {
        ...partialRawResponse.ApplicantScreening,
        CustomRecords: [
          {
            Record: [
              {
                Name: [FADV_RESPONSE_CUSTOM_RECORDS.SCREENING_REQUEST_ID],
                Value: ['ac288d35-d068-4857-be34-62555ce046d7'],
              },
              {
                Name: [FADV_RESPONSE_CUSTOM_RECORDS.TENANT_ID],
                Value: ['ac288d35-d068-4857-be34-62555ce046d7'],
              },
              ...(version
                ? [
                    {
                      Name: [FADV_RESPONSE_CUSTOM_RECORDS.VERSION],
                      Value: [version],
                    },
                  ]
                : []),
            ],
          },
        ],
      },
    },
  });

  describe('when the response is for the v1 reports', () => {
    it('should call processScreeningResponseV1Received, if the version custom record is not available in the response', async () => {
      const mocks = defaultMocks();
      setupMocks(mocks);

      const message = buildResponseMessage();
      const result = await handleScreeningResponseReceived(message);

      expect(mocks.processScreeningResponseV1Received).toHaveBeenCalled();
      expect(result.processed).toEqual(true);
    });

    it('should call processScreeningResponseV1Received, if the version custom record is available in the response', async () => {
      const mocks = defaultMocks();
      setupMocks(mocks);

      const message = buildResponseMessage(ScreeningVersion.V1);
      const result = await handleScreeningResponseReceived(message);

      expect(mocks.processScreeningResponseV1Received).toHaveBeenCalled();
      expect(result.processed).toEqual(true);
    });
  });

  describe('when the response is for the v2 reports', () => {
    it('should call processScreeningResponseV2Received', async () => {
      const mocks = defaultMocks();
      setupMocks(mocks);

      const message = buildResponseMessage(ScreeningVersion.V2);
      const result = await handleScreeningResponseReceived(message);

      expect(mocks.processScreeningResponseV2Received).toHaveBeenCalled();
      expect(result.processed).toEqual(true);
    });
  });
});
