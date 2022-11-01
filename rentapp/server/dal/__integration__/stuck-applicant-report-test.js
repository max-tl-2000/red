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
import { getStuckApplicantReports } from '../applicant-report-repo';
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
        { orphanedReport: true, hasResponse: false, requestTime: minTime + 1 }, // orphaned in time frame but not stuck
        { orphanedReport: false, hasResponse: true, requestTime: minTime + 1 }, // not orphaned
        { orphanedReport: true, hasResponse: true, requestTime: maxTime - 1, serviceStatusesComplete: true }, // orphaned in time frame but not stuck
        { orphanedReport: true, hasResponse: false, requestTime: maxTime + 1 }, // orphaned not in time frame
        { orphanedReport: true, hasResponse: true, requestTime: maxTime - 1, isResponseInOrphanedTimeFrame: false }, // orphaned in time frame but response not orphaned
        { orphanedReport: true, hasResponse: true, requestTime: minTime + 1, isResponseInOrphanedTimeFrame: false }, // orphaned in time frame but response not orphaned
        { orphanedReport: true, hasResponse: true, requestTime: minTime + 3, isResponseInOrphanedTimeFrame: false, serviceStatusesComplete: true }, // orphaned in time frame but response not orphaned
        { orphanedReport: true, hasResponse: true, requestTime: minTime + 3, serviceStatusesComplete: true }, // orphaned in time frame and stuck
      ].map(
        async ({
          orphanedReport,
          hasResponse,
          requestTime,
          timeFrame = 'hours',
          serviceStatusesComplete = false,
          isResponseInOrphanedTimeFrame = true,
          responseStatus = orphanedReport ? FADV_RESPONSE_STATUS.INCOMPLETE : FADV_RESPONSE_STATUS.COMPLETE,
        }) => {
          const applicantReportRequests = await createApplicantReportData(orphanedReport);
          const responseOptions = { isResponseInOrphanedTimeFrame, serviceStatusesComplete };
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

  describe('given a request to get the stuck requests in a time interval', () => {
    it('should return stuck requests if they exist in a give time interval', async () => {
      const { minTime, maxTime } = config.fadv.pollScreeningUnreceivedResponsesInterval;
      const stuckScreeningResults = await getStuckApplicantReports(ctx, { minTime, maxTime });
      expect(stuckScreeningResults.length).to.be.equal(4);
    });

    it('should return no stuck requests if there are none in a given time interval', async () => {
      const stuckScreeningResults = await getStuckApplicantReports(ctx, { minTime: 72, maxTime: 96 });
      expect(stuckScreeningResults.length).to.be.equal(0);
    });
  });
});
