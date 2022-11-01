/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, expectVisible, expectNotPresent, clickOnElement } from '../../helpers/helpers';
import { createAParty } from '../../helpers/rentalApplicationHelpers';
import { getMockedContactInfoByEmail, mockPartyData } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import {
  verifyPreferencesSectionIsDisplayed,
  verifyQQSelectionsOnUnitPreferences,
  buildMoveInDateLabelUsingQQ,
  verifyInventoryCardsPrices,
  verifyInventoryPanelPills,
  verifyMatchingInventoryCards,
  verifyClickOnSelectProperty,
  selectAmenity,
  verifyClickOnUpdatePreferences,
} from '../../helpers/partyInventoryPreferencesHelpers';
import { LA_TIMEZONE } from '../../../common/date-constants';

setHooks(fixture('Smoke: Search Inventory').meta({ smoke: 'true', smoke1: 'true' }), {
  fixtureName: 'searchInventory',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

// These are helpers that depend on the test flow
const changePropertySelection = async t => {
  const partyDetailPage = new PartyDetailPage(t);

  const covePropertyCard = partyDetailPage.getPropertyCardSelector('The Cove at Tiburon');
  const acmePropertyCard = partyDetailPage.getPropertyCardSelector('Acme Apartments');

  await clickOnElement(t, { selector: partyDetailPage.getPreferencesStepSelector(trans('LIFESTYLE_PROPERTIES_LABEL')) });

  await expectVisible(t, { selector: covePropertyCard });
  await expectVisible(t, { selector: acmePropertyCard });
  await clickOnElement(t, { selector: covePropertyCard });
  await clickOnElement(t, { selector: acmePropertyCard });
};

const verifyResultsWhenNoPropertyIsSelected = async t => {
  const partyDetailPage = new PartyDetailPage(t);

  await clickOnElement(t, { selector: partyDetailPage.getPropertyCardSelector('Acme Apartments') });
  await expectNotPresent(t, { selector: `[data-id="${trans('LABEL_BEDS')}_inventoryFilterPillText"]` });
  await expectNotPresent(t, { selector: '[data-id="qualifiedName"]' });
};

const selectTwoProperties = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const covePropertyCard = partyDetailPage.getPropertyCardSelector('The Cove at Tiburon');
  const acmePropertyCard = partyDetailPage.getPropertyCardSelector('Acme Apartments');

  await clickOnElement(t, { selector: covePropertyCard });
  await clickOnElement(t, { selector: acmePropertyCard });
};

test('TEST-1171: Create a party, verify the results in the inventory panel based on the selected filters', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Bay Area Call Center' };
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // The Cove at Tiburon

  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });

  // STEP-1
  await verifyPreferencesSectionIsDisplayed(t);

  const moveInDateSummaryLabel = buildMoveInDateLabelUsingQQ(qualificationInfo.moveInTimeQuestionId, LA_TIMEZONE);

  // STEP-2 and STEP-3
  await verifyQQSelectionsOnUnitPreferences(t, { propertyName, qualificationInfo, maxPriceRange: '$7,500', moveInDateSummaryLabel });

  // STEP-4
  await verifyInventoryPanelPills(t, { bedsPillText: `${trans('LABEL_BEDS')}: 4+`, moveInPillText: `${trans('LABEL_DATE')}: ${moveInDateSummaryLabel}` });

  const partyDetailPage = new PartyDetailPage(t);
  // STEP-6
  await clickOnElement(t, { selector: partyDetailPage.selectors.threeBedsPreferencesBtn });
  await verifyInventoryPanelPills(t, { bedsPillText: `${trans('LABEL_BEDS')}: 3, 4+`, moveInPillText: `${trans('LABEL_DATE')}: ${moveInDateSummaryLabel}` });

  // STEP-5 and STEP-7
  await verifyInventoryCardsPrices(t, {
    firstCardId: 'cove-1-009SALT_startingAtPriceText',
    secondCardId: 'cove-1-010SALT_startingAtPriceText',
    firstCardFormattedPrice: '$6,800',
    secondCardFormattedPrice: '$7,200',
  });

  // STEP-8
  await changePropertySelection(t);
  await verifyInventoryPanelPills(t, { bedsPillText: `${trans('LABEL_BEDS')}: 3, 4+`, moveInPillText: `${trans('LABEL_DATE')}: ${moveInDateSummaryLabel}` });

  // STEP-9
  await verifyMatchingInventoryCards(t, { firstUnitCardIdSelector: '[data-id="161_unitNamePrefixText"]', firstUnitCardPrefix: 'acme-4-' });

  // STEP-10 and STEP-11
  await verifyResultsWhenNoPropertyIsSelected(t);

  const covePropertyCard = partyDetailPage.getPropertyCardSelector('The Cove at Tiburon');
  // STEP-12
  await verifyClickOnSelectProperty(t, { propertyCardSelector: covePropertyCard });

  // STEP-13
  await selectTwoProperties(t);
  await clickOnElement(t, { selector: partyDetailPage.getPreferencesStepSelector(trans('UNIT_PREFERENCES_LABEL')) });
  await selectAmenity(t, { amenitySelector: '[data-id="ADA Accessible_checkbox"]' });
  await selectAmenity(t, { amenitySelector: '[data-id="Pointe 4 Bed A/C_checkbox"]' });

  // TEST-14
  await verifyClickOnUpdatePreferences(t);
});
