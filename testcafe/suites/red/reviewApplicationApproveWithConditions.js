/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, getPathName, expectTextIsEqual } from '../../helpers/helpers';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import {
  createAParty,
  createAQuote,
  publishAQuote,
  completeApplicationPart1,
  completeApplicationPart2,
  payApplicationFee,
  getApplicantDocumentPath,
  backToDashboard,
} from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import { validateDashboardVisible, clickSwitchTodayOnlyToggle } from '../../helpers/dashboardHelpers';
import { requestScreeningApproval, viewAllQuotesMenu, verifyApplicantCard, reviewApplicationByLaaAgent } from '../../helpers/leasingApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import PartyDetailPage from '../../pages/partyDetailPage';
import { forceUsersLogout } from '../../../cucumber/lib/utils/apiHelper';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';

setHooks(fixture('Smoke: Review application approve with conditions').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'reviewApplicationApproveWithConditions',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

// skipping this as it fails on ci suite
test('TEST-173, TEST-175: Review application approve with conditions', async t => {
  // User logs in
  const userInfo = { user: 'felicia@reva.tech', password: getUserPassword(), agentName: 'Felicia Sutton' };
  const isLaa = false;
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  const quoteData = getMockedQuoteDataByUnit('1010', 1);
  const quoteInfo = {
    index: 0,
    leaseStartDate: '1',
    leaseTerms: ['6 months'],
    ...quoteData,
  };

  const documents = [
    {
      iconName: 'file-image',
      removeIconName: 'delete',
      category: DALTypes.DocumentCategories.DOCUMENTS,
      fileName: 'tesla-roadster.jpg',
      filePath: getApplicantDocumentPath('tesla-roadster.jpg'),
    },
  ];
  const applicantData = {
    ...getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech'),
    privateDocuments: documents,
  };
  const hasRequiredSteppers = false;
  const skipSteppers = false;

  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  await createAQuote(t, quoteInfo);
  const quoteDraftPage = new QuoteDraftPage(t);
  await quoteDraftPage.selectLeaseTerms(['24 months']);
  await quoteDraftPage.selectLeaseTerms(['6 months']);
  await publishAQuote(t, contactInfo);

  const location = await getPathName();
  await completeApplicationPart1(t, applicantData, propertyName);
  await payApplicationFee(t, applicantData);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);

  // Back to party details page
  await t.navigateTo(`${getTenantURL()}${location}`);
  await requestScreeningApproval(t, quoteInfo);

  const partyDetailPage = new PartyDetailPage(t);

  // TEST-173 Overflow menu with LA user when application promoted for approval
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.applicationApprovalDateTxt, text: 'Approval requested today' });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.pendingApprovalAmount, text: '$5,160.00' });
  await viewAllQuotesMenu(t, isLaa);

  // Back to dashboard and logout
  await backToDashboard(t);
  await forceUsersLogout({ tenantId: TEST_TENANT_ID });

  // LAA User logs in
  // TEST-175 Review application to Approve
  const userInfo2 = { user: 'josh@reva.tech', password: getUserPassword() };
  await loginAs(t, userInfo2);
  await validateDashboardVisible(t);
  await clickSwitchTodayOnlyToggle(t);

  await verifyApplicantCard(t, userInfo.agentName);
  await viewAllQuotesMenu(t);
  const screeningDecision = ScreeningDecision.APPROVED_WITH_COND;
  const mockTasks = [
    {
      text: trans('NOTIFY_CONDITIONAL_APPROVAL'),
      name: DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL,
    },
    {
      text: trans('SEND_CONTRACT'),
      name: DALTypes.TaskNames.SEND_CONTRACT,
    },
  ];
  await reviewApplicationByLaaAgent(t, quoteData, mockTasks, { screeningDecision });
});
