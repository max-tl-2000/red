/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { tenant } from '../../../../../server/testUtils/setupTestGlobalContext';
import { refreshApplicantReports, processNextIncomingApplicantReport } from '../applicant-report.ts';
import { createInitialApplicantData } from '../../../test-utils/applicant-report-helper';
import { createApplicantReport, getApplicantReportById } from '../../../dal/applicant-report-repo';
import { createApplicantReportRequestTracking, updateApplicantReportRequestTracking } from '../../../dal/applicant-report-request-tracking-repo';
import { now } from '../../../../../common/helpers/moment-utils';
import { ApplicantReportNames, ApplicantReportStatus } from '../../../../../common/enums/screeningReportTypes';
import nullish from '../../../../../common/helpers/nullish';
import { LA_TIMEZONE } from '../../../../../common/date-constants';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';

const context = { tenantId: tenant.id };

describe('Applicant Report', () => {
  describe('when refreshApplicantReports is Called', () => {
    const assertApplicantReports = (applicantReports, numberOfReports, applicantDataId, commonAssertFn) => {
      expect(applicantReports.length, 'number of reports').to.equal(numberOfReports);
      expect(
        applicantReports.every(ar => ar.applicantDataId === applicantDataId),
        'same applicantDataId',
      ).to.be.true;
      expect(
        applicantReports.every(ar => nullish(ar.obsoletedBy)),
        'obsoletedBy is nullish for all',
      ).to.be.true;
      commonAssertFn && applicantReports.map(commonAssertFn);
    };

    describe('and there is not any record for the given person', () => {
      it('should create 2 reports, if all the reports are available for a resident', async () => {
        const { applicantDataIds, personId } = await createInitialApplicantData();
        const applicantReports = await refreshApplicantReports(context, personId);

        assertApplicantReports(applicantReports, 2, applicantDataIds[0], report => {
          expect(report.status).to.equal(ApplicantReportStatus.COMPILING);
          expect(report.reportName).to.be.oneOf([ApplicantReportNames.CREDIT, ApplicantReportNames.CRIMINAL]);
          expect(report.obsoletedBy).to.be.null;
        });
      });

      it('should create 2 reports in complete status for international address, if all the reports are available for a resident', async () => {
        const { applicantDataIds, personId } = await createInitialApplicantData({ haveInternationalAddress: true });
        const applicantReports = await refreshApplicantReports(context, personId);

        // TODO: CPM-12594 add more assertions based on the international scenario
        assertApplicantReports(applicantReports, 2, applicantDataIds[0], report => {
          expect(report.status).to.equal(ApplicantReportStatus.COMPLETED);
          expect(report.reportName).to.be.oneOf([ApplicantReportNames.CREDIT, ApplicantReportNames.CRIMINAL]);
          expect(report.obsoletedBy).to.be.null;
        });
      });

      it('should create 1 report, if only crimial reports are available for a resident', async () => {
        const { applicantDataIds, personId } = await createInitialApplicantData({
          applicationSettings: {
            traditional: {
              resident: {
                creditReportRequiredFlag: false,
              },
            },
          },
        });
        const applicantReports = await refreshApplicantReports(context, personId);

        assertApplicantReports(applicantReports, 1, applicantDataIds[0], report => {
          expect(report.status).to.equal(ApplicantReportStatus.COMPILING);
          expect(report.reportName).to.equal(ApplicantReportNames.CRIMINAL);
          expect(report.obsoletedBy).to.be.null;
        });
      });
    });

    describe('and there is a previous record in compiling status for the given person', () => {
      const setupCompilingScenarios = async (createdAt, createRequest = false) => {
        const { applicantDataIds, personId, propertyId } = await createInitialApplicantData({
          numberOfApplicantDataRecords: 2,
          applicationSettings: {
            traditional: {
              resident: {
                creditReportRequiredFlag: false,
              },
            },
          },
        });
        const previousApplicantReport = await createApplicantReport(context, {
          personId,
          reportName: ApplicantReportNames.CRIMINAL,
          applicantDataId: applicantDataIds[0],
          status: ApplicantReportStatus.COMPILING,
        });

        if (createRequest) {
          const { id } = await createApplicantReportRequestTracking(context, {
            personId,
            reportName: previousApplicantReport.reportName,
            requestApplicantId: getUUID(),
            applicantReportId: previousApplicantReport.id,
            propertyId,
            requestType: FadvRequestTypes.NEW,
          });
          createdAt && (await updateApplicantReportRequestTracking(context, id, { created_at: createdAt }));
        }
        const [applicantReport] = await refreshApplicantReports(context, personId);

        return { applicantReport, previousApplicantReport, applicantDataId: applicantDataIds[1] };
      };

      it('should create 1 report in pending status (previous compiling on time), if only crimial reports are available for a resident', async () => {
        const { previousApplicantReport, applicantReport, applicantDataId } = await setupCompilingScenarios();
        const previousReport = await getApplicantReportById(context, previousApplicantReport.id);

        assertApplicantReports([applicantReport], 1, applicantDataId, report => {
          expect(report.status).to.equal(ApplicantReportStatus.PENDING);
          expect(report.reportName).to.equal(ApplicantReportNames.CRIMINAL);
          expect(report.obsoletedBy).to.be.null;
        });
        expect(previousReport.status).to.equal(ApplicantReportStatus.COMPILING);
        expect(previousReport.obsoletedBy).to.be.null;
      });

      it('should create 1 report in compiling status (previous compiling out of time), if only crimial reports are available for a resident', async () => {
        const { previousApplicantReport, applicantReport, applicantDataId } = await setupCompilingScenarios(
          now({ timezone: LA_TIMEZONE }).add(-60, 'seconds').toJSON(),
          true,
        );
        const previousReport = await getApplicantReportById(context, previousApplicantReport.id);

        assertApplicantReports([applicantReport], 1, applicantDataId, report => {
          expect(report.status).to.equal(ApplicantReportStatus.COMPILING);
          expect(report.reportName).to.equal(ApplicantReportNames.CRIMINAL);
        });
        expect(previousReport.status).to.equal(ApplicantReportStatus.CANCELED);
        expect(previousReport.obsoletedBy).to.be.equal(applicantReport.id);
      });
    });

    describe('and there is a previous record in pending status for the given person', () => {
      it('should create 1 report in pending status, if only crimial reports are available for a resident', async () => {
        const { applicantDataIds, personId } = await createInitialApplicantData({
          numberOfApplicantDataRecords: 2,
          applicationSettings: {
            traditional: {
              resident: {
                creditReportRequiredFlag: false,
              },
            },
          },
        });
        const previousApplicantReport = await createApplicantReport(context, {
          personId,
          reportName: ApplicantReportNames.CRIMINAL,
          applicantDataId: applicantDataIds[0],
          status: ApplicantReportStatus.PENDING,
        });
        const applicantReports = await refreshApplicantReports(context, personId);
        const previousReport = await getApplicantReportById(context, previousApplicantReport.id);

        assertApplicantReports(applicantReports, 1, applicantDataIds[1], report => {
          expect(report.status).to.equal(ApplicantReportStatus.PENDING);
          expect(report.reportName).to.equal(ApplicantReportNames.CRIMINAL);
          expect(report.obsoletedBy).to.be.null;
        });
        expect(previousReport.status).to.equal(ApplicantReportStatus.PENDING);
        expect(previousReport.obsoletedBy).to.be.null;
      });
    });
  });

  describe('when processNextIncomingApplicantReport is Called', () => {
    it('should mark as canceled all the pending reports minus the last one', async () => {
      const { applicantDataIds, personId } = await createInitialApplicantData({
        numberOfApplicantDataRecords: 3,
        applicationSettings: {
          traditional: {
            resident: {
              creditReportRequiredFlag: false,
            },
          },
        },
      });
      await createApplicantReport(context, {
        personId,
        reportName: ApplicantReportNames.CRIMINAL,
        applicantDataId: applicantDataIds[0],
        status: ApplicantReportStatus.COMPLETED,
      });
      const firstPendingReport = await createApplicantReport(context, {
        personId,
        reportName: ApplicantReportNames.CRIMINAL,
        applicantDataId: applicantDataIds[1],
        status: ApplicantReportStatus.PENDING,
      });

      const [thirdApplicantReport] = await refreshApplicantReports(context, personId);
      expect(thirdApplicantReport.status).to.equal(ApplicantReportStatus.PENDING);

      const applicantReport = await processNextIncomingApplicantReport(context, personId, ApplicantReportNames.CRIMINAL);
      const previousReport = await getApplicantReportById(context, firstPendingReport.id);

      expect(previousReport.status).to.equal(ApplicantReportStatus.CANCELED);
      expect(previousReport.obsoletedBy).to.equal(applicantReport.id);
      expect(applicantReport.id).to.equal(thirdApplicantReport.id);
      expect(applicantReport.applicantDataId).to.equal(applicantDataIds[2]);
      expect(thirdApplicantReport.obsoletedBy).to.be.null;
      expect(applicantReport.status).to.equal(ApplicantReportStatus.COMPILING);
      expect(applicantReport.reportName).to.equal(ApplicantReportNames.CRIMINAL);
    });
  });
});
