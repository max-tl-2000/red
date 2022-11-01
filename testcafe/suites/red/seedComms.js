/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, expectVisible } from '../../helpers/helpers';
import { mockPartyData } from '../../helpers/mockDataHelpers';
import { createAParty } from '../../helpers/rentalApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible, clickSwitchTodayOnlyToggle, clickOnCardInDashboard } from '../../helpers/dashboardHelpers';
import { addAResident } from '../../helpers/managePartyHelpers';
import PartyDetailPage from '../../pages/partyDetailPage';
import PartyPhaseOne from '../../pages/partyPhaseOne';

setHooks(fixture('smoke: Seeds: Comms').meta({ smoke: 'true', smoke2: 'true' }), {
  fixtureName: 'seedComms',
});

test('TEST-222:Send a sms/email to multiple residents', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'bill@reva.tech', password: getUserPassword() };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;

  const contactInfo = {
    residentA: {
      legalName: 'Britney Reeves',
      email: 'qatest+britneyreeves@reva.tech',
      phone: '+1 908 555 4621',
      formattedPhone: '(908) 555-4621',
    },
    residentB: {
      legalName: 'Cassie Segal',
      email: 'qatest+cassiesegal@reva.tech',
      phone: '+1 908 555 4622',
      formattedPhone: '(908) 555-4622',
    },
    residentC: {
      legalName: 'Oscar Cage',
      email: 'qatest+oscarCage@reva.tech',
      phone: '+1 908 555 4623',
      formattedPhone: '(908) 555-4623',
    },
  };

  const property = partyInfo.properties[0]; // Parkmerced Apartments

  await createAParty(t, { partyInfo, propertyName: property.displayName, contactInfo: contactInfo.residentA, userInfo, qualificationInfo });

  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();
  await addAResident(t, contactInfo.residentB);
  await addAResident(t, contactInfo.residentC);
  await partyDetailPage.closeManagePartyDetailsPage();
  const partyPhaseOne = new PartyPhaseOne(t);
  const messageMockData = [
    {
      text: 'Test draft SMS for resident C',
      residentName: contactInfo.residentC.legalName,
      index: '1',
      isSms: true,
    },
    {
      text: 'Test draft SMS for resident B',
      residentName: contactInfo.residentB.legalName,
      index: '2',
      isSms: true,
    },
    {
      text: 'Test draft EMAIL for resident A',
      subject: 'EMAIL A',
      residentNotSend: [contactInfo.residentB.legalName, contactInfo.residentC.legalName],
      index: '3',
      residentName: contactInfo.residentA.legalName,
    },
    {
      text: 'Test draft EMAIL for resident C',
      subject: 'EMAIL C',
      residentNotSend: [contactInfo.residentA.legalName, contactInfo.residentB.legalName],
      index: '4',
      residentName: contactInfo.residentC.legalName,
    },
  ];
  await partyPhaseOne.writeAMessage(messageMockData[0]);
  await partyPhaseOne.writeAMessage(messageMockData[1]);

  await partyPhaseOne.clickOnBackButton();
  await validateDashboardVisible(t);
  await clickSwitchTodayOnlyToggle(t);
  await clickOnCardInDashboard(t, '#leads', contactInfo.residentA);

  await partyPhaseOne.checkDraftMessageIsSaved(messageMockData[0]);
  await partyPhaseOne.checkDraftMessageIsSaved(messageMockData[1]);

  await partyPhaseOne.writeAMessage(messageMockData[2]);
  await partyPhaseOne.writeAMessage(messageMockData[3]);
  await partyPhaseOne.clickOnBackButton();

  await validateDashboardVisible(t);
  await clickOnCardInDashboard(t, '#leads', contactInfo.residentA);

  await partyPhaseOne.checkDraftMessageIsSaved(messageMockData[2]);
  await partyPhaseOne.checkDraftMessageIsSaved(messageMockData[3]);
});
