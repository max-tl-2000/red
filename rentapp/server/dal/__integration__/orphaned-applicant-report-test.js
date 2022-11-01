/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { expect } from 'chai';
import config from '../../../config';
import { now } from '../../../../common/helpers/moment-utils';
import { ctx, createApplicantReportResponse, createApplicantReportData } from '../../test-utils/repo-helper.js';
import { getOrphanedApplicantReports } from '../applicant-report-repo';
import { updateApplicantReportRequestTracking } from '../applicant-report-request-tracking-repo';
import { FADV_RESPONSE_STATUS } from '../../../common/screening-constants';

describe('dal/applicant-report-repo/getOrphanedApplicantReports()', () => {
  /* creates 10 applicants with criminal & credit reports for each */
  const initializeScreeningData = async () => {
    const { minTime, maxTime } = config.fadv.pollScreeningUnreceivedResponsesInterval;

    await Promise.all(
      [
        { orphanedReport: true, hasResponse: true, requestTime: minTime - 2 }, // orphaned not in time frame
        { orphanedReport: false, hasResponse: true, requestTime: minTime - 1 }, // not orphaned
        { orphanedReport: true, hasResponse: false, requestTime: minTime + 1 }, // orphaned in time frame
        { orphanedReport: false, hasResponse: true, requestTime: minTime + 1 }, // not orphaned
        { orphanedReport: true, hasResponse: false, requestTime: maxTime - 1 }, // orphaned in time frame
        { orphanedReport: true, hasResponse: false, requestTime: maxTime + 1 }, // orphaned not in time frame
        { orphanedReport: true, hasResponse: true, requestTime: maxTime - 1, isResponseInOrphanedTimeFrame: false }, // orphaned in time frame but response not orphaned
        { orphanedReport: true, hasResponse: true, requestTime: minTime + 1, isResponseInOrphanedTimeFrame: false }, // orphaned in time frame but response not orphaned
        { orphanedReport: true, hasResponse: true, requestTime: minTime + 3, isResponseInOrphanedTimeFrame: false }, // orphaned in time frame but response not orphaned
        { orphanedReport: true, hasResponse: true, requestTime: minTime + 3 }, // orphaned in time frame
      ].map(
        async ({
          orphanedReport,
          hasResponse,
          requestTime,
          timeFrame = 'hours',
          isResponseInOrphanedTimeFrame = true,
          responseStatus = orphanedReport ? FADV_RESPONSE_STATUS.INCOMPLETE : FADV_RESPONSE_STATUS.COMPLETE,
        }) => {
          const applicantReportRequests = await createApplicantReportData(orphanedReport);
          const responseOptions = { isResponseInOrphanedTimeFrame };
          return await mapSeries(applicantReportRequests, async ({ id: screeningRequestId }) => {
            if (orphanedReport) {
              const applicantReportRequest = await updateApplicantReportRequestTracking(ctx, screeningRequestId, {
                created_at: now().add(-requestTime, timeFrame).toDate(),
              });

              return hasResponse ? await createApplicantReportResponse(screeningRequestId, responseStatus, responseOptions) : applicantReportRequest;
            }

            return createApplicantReportResponse(screeningRequestId, responseStatus, responseOptions);
          });
        },
      ),
    );
  };

  beforeEach(async () => {
    await initializeScreeningData();
  });

  describe('given a request to get the orphaned screening requests in a time interval', () => {
    it('should return orphaned requests if orphaned requests exist in the give time interval', async () => {
      const { minTime, maxTime } = config.fadv.pollScreeningUnreceivedResponsesInterval;
      const orphanedSreeningResults = await getOrphanedApplicantReports(ctx, { minTime, maxTime });
      expect(orphanedSreeningResults.length).to.be.equal(6);
    });

    it('should return no orphaned requests if no orphaned requests exist in the given time interval', async () => {
      const orphanedSreeningResults = await getOrphanedApplicantReports(ctx, { minTime: 72, maxTime: 96 });
      expect(orphanedSreeningResults.length).to.be.equal(0);
    });
  });
});
