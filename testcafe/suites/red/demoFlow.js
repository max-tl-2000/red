/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import {
  loginAs,
  expectVisible,
  getTenantURL,
  expectDashboardLaneContains,
  clickOnCard,
  expectTextIsEqual,
  addUniqueIdToEmail,
  setButtonBarValues,
  setRadioGroupValues,
  setDropdownValues,
  getUserPassword,
  clickOnElement,
  switchAvailability,
} from '../../helpers/helpers';
import { setHooks } from '../../helpers/hooks';
import { tenant } from '../../../cucumber/support/dbHelper';
import { sendGuestSMS, getProgramByEmailIdentifier } from '../../../cucumber/lib/utils/apiHelper';
import { formatPhoneToDisplay } from '../../../common/helpers/phone/phone-helper';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';

import DashboardPage from '../../pages/dashboardPage';
import PersonCardPage from '../../pages/personCardPage';

const getProgramPhone = async () => {
  const { directPhoneIdentifier } = await getProgramByEmailIdentifier({ tenantId: tenant.id, directEmailIdentifier: 'resident-referral.parkmerced' });
  return directPhoneIdentifier;
};

const f = fixture('DemoFlow');

setHooks(f, { fixtureName: 'demoFlow' });

test('Demo Flow test', async t => {
  const personCardPage = new PersonCardPage(t);
  const dashboardPage = new DashboardPage(t);
  // User logs in
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, { user: 'bill@reva.tech', password: getUserPassword() });

  // toggle availability switch to `available`
  const expectUserStatusIs = (t2, status) =>
    expectVisible(t2, { selector: `[data-id="employee-avatar"] [data-part="badge"] [data-red-icon][name="${status}"]` });
  await switchAvailability(t);
  await expectUserStatusIs(t, 'available');

  await validateDashboardVisible(t);
  await clickOnElement(t, { selector: dashboardPage.selectors.switchToTodayToggle });
  await expectDashboardLaneContains(t, { lane: '#contacts', cardText: 'James Hill' });
  await expectDashboardLaneContains(t, { lane: '#leads', cardText: 'Eli Foster' });
  await expectDashboardLaneContains(t, { lane: '#prospects', cardText: 'George Harrison' });
  await expectDashboardLaneContains(t, { lane: '#applicants', cardText: 'Dylan Butler' });

  // Send a SMS from testing plivo application
  const msg = 'I am looking for an apartment';
  tenant.metadata.plivoGuestPhoneNumber = await sendGuestSMS({ msg, to: await getProgramPhone(), tenantId: tenant.id });

  // A new contact card is created
  await expectDashboardLaneContains(t, { lane: '#contacts', cardText: formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber) });

  // The user goes to person details page
  await clickOnCard(t, { lane: '#contacts', cardText: formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber) });
  await expectVisible(t, { selector: '[data-component="partyPage"][data-phase="phaseI"]' });
  await expectTextIsEqual(t, { selector: '[data-id="taskOwnerName"]', text: 'Bill Smith' });
  await expectTextIsEqual(t, { selector: '[data-id="appBar"] p', text: 'Update party' });

  await expectTextIsEqual(t, { selector: '[data-id="cardTitle"]', text: formatPhoneToDisplay(tenant.metadata.plivoGuestPhoneNumber) });
  await expectTextIsEqual(t, { selector: '[data-id="contactSummary"]', text: '1 phone' });

  // select edit person
  await clickOnElement(t, { selector: dashboardPage.selectors.commonPersonCard });
  await clickOnElement(t, { selector: $('[data-component="list-item"]').withText('Edit contact information') });

  // add a name
  await t.typeText('#txtLegalName', 'John Doe');

  // add an email to the user
  await clickOnElement(t, { selector: personCardPage.selectors.addEmailBtn });
  await t.typeText('#txtNewEmail', addUniqueIdToEmail(t, 'qatest+johndoe@reva.tech'));
  await clickOnElement(t, { selector: personCardPage.selectors.verifyEmailAddressBtn });

  // click save
  await clickOnElement(t, { selector: personCardPage.selectors.createPersonBtn });

  // answer the qualification questions
  await setButtonBarValues(t, { selector: '#bedroomsBar', values: ['FOUR_PLUS_BEDS'] });
  await setRadioGroupValues(t, { selector: '#incomeQuestion', value: 'Yes' });
  await setDropdownValues(t, { id: 'moveInTimeQuestion', values: ['1 - 2 months'] });
  await setDropdownValues(t, { id: 'dropdownLeaseType', values: ['Employee'] });

  // save qualification questions
  await clickOnElement(t, { selector: '#btnSaveAndContinue' });

  await expectTextIsEqual(t, { selector: '[data-id="smsText"]', text: 'I am looking for an apartment' });
});
