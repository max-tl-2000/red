/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { tenant, chan } from '../../../../server/testUtils/setupTestGlobalContext';
import { createScreeningTestData } from '../../test-utils/screening-test-helper';
import { sendPaymentNotification } from '../../test-utils/api-helper';
import { setupConsumers } from '../../../../server/workers/consumer';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { waitForQueueIdle } from '../../../../server/testUtils/queueHelper';
import { createAParty, createAPartyMember, createAQuotePromotion, createAUser } from '../../../../server/testUtils/repoHelper';
import { getApplicationSummaryForParty } from '../utils';
import { applicationSummaryStatus } from '../../../common/application-constants';
import { updatePersonApplicationStatus, getPersonApplication } from '../../services/person-application';
import { markAllScreeningRequestsForPartyAsObsolete } from '../../services/screening';

const context = { tenantId: tenant.id };

const sendPaymentNotifications = async (personApplications, invoices) => {
  await personApplications.map(async (pa, index) => {
    await sendPaymentNotification(invoices[index].id, pa.id);
  });

  await waitForQueueIdle();
};

const setupTestForApplicationSummary = async () => {
  const applicationData = await createScreeningTestData({
    memberSettings: { numberOfResidents: 1, numberOfGuarantors: 0 },
    quoteSettings: { numberOfQuotes: 1, numberOfLeaseTerms: 1 },
  });
  await setupConsumers(chan(), null /* matcher */, ['screening']);
  const { personApplications, invoices } = applicationData;
  await sendPaymentNotifications(personApplications, invoices);
  return applicationData;
};

const setupTestForPromotionWithoutApplication = async leaseType => {
  const user = await createAUser();
  const party = await createAParty({ userId: user.id, leaseType });
  await createAPartyMember(party.id, {
    fullName: 'Luke Skywalker',
    memberType: DALTypes.MemberType.RESIDENT,
  });
  await createAQuotePromotion(party.id, DALTypes.PromotionStatus.PENDING_APPROVAL);
  return party;
};

describe('Application summary for party', () => {
  const assertPersonApplicationStatus = async (personApplications, applicationStatus) => {
    const personApplication = await getPersonApplication(context, personApplications[0].id);
    expect(personApplications).to.have.lengthOf(1);
    expect(personApplication.applicationStatus).to.equal(applicationStatus);
  };

  const assertApplicationSummaryForParty = async (partyId, { applicationsCompleted, screeningsCompleted, applicationStatus, screeningStatus }) => {
    const applicationSummary = await getApplicationSummaryForParty(context, partyId);
    expect(applicationSummary.applicationsCompleted).to.equal(applicationsCompleted);
    expect(applicationSummary.screeningsCompleted).to.equal(screeningsCompleted);
    expect(applicationSummary.applicationStatus).to.equal(applicationStatus);
    expect(applicationSummary.screeningStatus).to.equal(screeningStatus);
  };

  describe('when is a corporate Party', () => {
    it('should return NULL as application summary', async () => {
      const corporateParty = await setupTestForPromotionWithoutApplication(DALTypes.PartyTypes.CORPORATE);

      const applicationSummary = await getApplicationSummaryForParty(context, corporateParty.id);
      expect(applicationSummary).to.be.null;
    });
  });

  describe('when is a traditional Party', () => {
    describe('when there is a quote promotion without application', () => {
      it('should return INCOMPLETE as application and INCOMPLETE as screening status', async () => {
        const party = await setupTestForPromotionWithoutApplication(DALTypes.PartyTypes.TRADITIONAL);

        await assertApplicationSummaryForParty(party.id, {
          applicationsCompleted: false,
          screeningsCompleted: false,
          applicationStatus: applicationSummaryStatus.NO_DATA,
          screeningStatus: applicationSummaryStatus.INCOMPLETE,
        });
      });
    });

    describe('when the application is in PAID status', () => {
      describe('and have screening', () => {
        it('should return INCOMPLETE as application and COMPLETE as screening status', async () => {
          const { party, personApplications } = await setupTestForApplicationSummary();

          await assertPersonApplicationStatus(personApplications, DALTypes.PersonApplicationStatus.PAID);
          await assertApplicationSummaryForParty(party.id, {
            applicationsCompleted: false,
            screeningsCompleted: true,
            applicationStatus: applicationSummaryStatus.INCOMPLETE,
            screeningStatus: applicationSummaryStatus.COMPLETE,
          });
        });
      });

      describe('and does not have screening', () => {
        it('should return INCOMPLETE as application and INCOMPLETE as screening status', async () => {
          const { party, personApplications } = await setupTestForApplicationSummary();
          await markAllScreeningRequestsForPartyAsObsolete(context, party.id);

          await assertPersonApplicationStatus(personApplications, DALTypes.PersonApplicationStatus.PAID);
          await assertApplicationSummaryForParty(party.id, {
            applicationsCompleted: false,
            screeningsCompleted: false,
            applicationStatus: applicationSummaryStatus.INCOMPLETE,
            screeningStatus: applicationSummaryStatus.INCOMPLETE,
          });
        });
      });
    });

    describe('when the application is in COMPLETED status', () => {
      describe('and have screening', () => {
        it('should return COMPLETE as application and COMPLETE as screening status', async () => {
          const { party, personApplications } = await setupTestForApplicationSummary();
          await updatePersonApplicationStatus(context, personApplications[0].id, DALTypes.PersonApplicationStatus.COMPLETED);

          await assertPersonApplicationStatus(personApplications, DALTypes.PersonApplicationStatus.COMPLETED);
          await assertApplicationSummaryForParty(party.id, {
            applicationsCompleted: true,
            screeningsCompleted: true,
            applicationStatus: applicationSummaryStatus.COMPLETE,
            screeningStatus: applicationSummaryStatus.COMPLETE,
          });
        });
      });

      describe('and does not have screening', () => {
        it('should return COMPLETE as application and INCOMPLETE as screening status', async () => {
          const { party, personApplications } = await setupTestForApplicationSummary();
          await updatePersonApplicationStatus(context, personApplications[0].id, DALTypes.PersonApplicationStatus.COMPLETED);
          await markAllScreeningRequestsForPartyAsObsolete(context, party.id);

          await assertPersonApplicationStatus(personApplications, DALTypes.PersonApplicationStatus.COMPLETED);
          await assertApplicationSummaryForParty(party.id, {
            applicationsCompleted: true,
            screeningsCompleted: false,
            applicationStatus: applicationSummaryStatus.COMPLETE,
            screeningStatus: applicationSummaryStatus.INCOMPLETE,
          });
        });
      });
    });
  });
});
