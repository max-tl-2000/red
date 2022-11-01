/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, clickOnElement, doLogoutIfNeeded } from '../../helpers/helpers';
import {
  createAParty,
  completeApplicationPart1,
  completeApplicationPart2,
  waiveApplicationFee,
  createAQuote,
  publishAQuote,
  createPerson,
  setPartyCreationDetails,
} from '../../helpers/rentalApplicationHelpers';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail, LeaseTypes } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import { now } from '../../../common/helpers/moment-utils';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mergeConditions } from '../../helpers/redConstants';
import { selectPartyQualificationQuestions } from '../../helpers/partyAdditionalInfo';
import PartyDetailPage from '../../pages/partyDetailPage';
import WelcomeApplicationPage from '../../pages/welcomeApplicationPage';

setHooks(fixture('Verify an applicant with multiple applications'), {
  fixtureName: 'application list',
  afterEach: t => doLogoutIfNeeded(t),
}).meta({ smoke1: 'true' });

test('TEST-1979: Verify the system shows the list of applications and the user can continue with the last application', async t => {
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', index: 1 };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);

  const { partyInfo, qualificationInfo, qualificationInfoAcme } = mockPartyData;
  const residentEmailAddress = 'qatest+kathejohnson@reva.tech';
  const contactInfo = getMockedContactInfoByEmail(residentEmailAddress);
  const applicantData = getMockedApplicantDataByEmail(residentEmailAddress);
  const parkmercedApartments = partyInfo.properties[0].displayName;
  const empyreanHorizon = partyInfo.properties[2].displayName;
  const userInfoTeam = [
    {
      team: 'Bay Area Call Center',
    },
    {
      team: 'Empyrean Horizon',
    },
  ];
  const hasRequiredSteppers = false;
  const skipSteppers = false;
  const units = {
    quoteInfo1: {
      index: 0,
      baseRent: 2213,
      ...getMockedQuoteDataByUnit('1019', 1),
    },
    quoteInfo2: {
      index: 0,
      leaseTerms: ['12 months'],
      ...getMockedQuoteDataByUnit('100'),
    },
  };

  const currentDate = now({ timezone: parkmercedApartments.timezone }).startOf('day');
  const leaseDates = {
    leaseStartDate: currentDate.clone(),
    leaseMoveInDate: currentDate.clone().add(1, 'day'),
    leaseEndDate: currentDate.clone().add(2, 'day'),
  };
  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName: parkmercedApartments, contactInfo, userInfo: userInfoTeam[0], qualificationInfo });
  await createAQuote(t, units.quoteInfo1, true, { leaseStartDate: leaseDates.leaseStartDate, timezone: parkmercedApartments.timezone });
  await publishAQuote(t, contactInfo);
  // TEST-140:Complete application part 2 without filled up steppers in part 2
  await waiveApplicationFee(t, contactInfo);
  await completeApplicationPart1(t, applicantData, parkmercedApartments.displayName);
  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);

  // Creation party 2
  await t.navigateTo(getTenantURL('/'));
  await setPartyCreationDetails(t, { partyInfo, propertyName: empyreanHorizon, userInfo: userInfoTeam[1], leaseType: LeaseTypes.NEW_LEASE });

  await createPerson(t, contactInfo, {
    mergePersonCondition: mergeConditions.mergeOnlyPersonsDiffProp,
    mergeDialogBody: trans('NO_DUPLICATE_PARTY_FOUND_INFO6'),
  });

  await selectPartyQualificationQuestions(t, qualificationInfoAcme);
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.saveAndContinueBtn });
  await partyDetailPage.clickOnMemberRowApplicationMenu(contactInfo.index, contactInfo.memberType);
  await partyDetailPage.checkVisibleFlyOutList(contactInfo.index, contactInfo.memberType);
  // send email link
  const lastEmailSent = 0;
  await partyDetailPage.clickOnEmailLinkOption(t);
  await partyDetailPage.openEmailSent(t, lastEmailSent);
  await partyDetailPage.clickOnOpenApplicationButton(t);
  const welcomeApplicationPage = new WelcomeApplicationPage(t);
  await welcomeApplicationPage.verifyWelcomeApplicationPageVisible(t);
  const firstName = contactInfo.legalName.split(' ')[0];
  await welcomeApplicationPage.checkPersonVisible(t, firstName);
  await welcomeApplicationPage.verifyPropertyIsPresent(t, empyreanHorizon);
  await welcomeApplicationPage.clickOnContinueBtnByProperty(t, empyreanHorizon);
  await welcomeApplicationPage.verifyWelcomeApplicationPageVisible(t);
  await welcomeApplicationPage.checkPersonVisible(t, contactInfo.preferredName);
});
