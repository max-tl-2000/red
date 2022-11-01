/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getWebsiteURL } from '../../helpers/helpers';
import { PropertyNames, ProgramNames } from '../../helpers/websiteConstants';
import { setHooks } from '../../helpers/hooks';
import Homepage from '../../pages/website/homepage';
import PropertyPage from '../../pages/website/propertyPage';

setHooks(fixture('Layout Filter'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

const unitDetails = [
  {
    title: 'BALLANTINE',
    sqft: '1,922',
    bedsNumber: '2',
    bathsNumber: '2.5',
    cardState: 'Available soon',
    price: '$1,837.8',
    apartmentNumber: '350 Arballo-1015',
  },
  {
    title: 'BANDA',
    sqft: '1,275',
    bedsNumber: '2',
    bathsNumber: '2.5',
    cardState: 'Available soon',
    price: '$4,225',
    apartmentNumber: '1-011SALT',
  },
];

test('TEST-1370:Verify system retrieves corresponding units with correct info and order for layouts in group layout', async t => {
  const homepage = new Homepage(t);
  const propertyPage = new PropertyPage(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.SierraNorte);
  await homepage.clickOnResult('Sierra Norte, Sioux Falls, South Dakota');

  await propertyPage.areLayoutFilterContainersDisplayed();

  const SierraNortesDate = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'America/Chicago' });
  await propertyPage.checkMoveInDate(SierraNortesDate);

  await propertyPage.checkLayoutContainer();

  await propertyPage.clickLayoutButton('1 Bedroom');
  await propertyPage.checkMarketingLayoutForAvailableUnit();

  await propertyPage.clickLayoutButton('2 Bedrooms');
  await propertyPage.checkMarketingLayoutContainer(propertyPage.selectors.MarketingLayoutTitleContainer, 'LANGLEY');

  await propertyPage.clickLayoutButton('3 Bedrooms');
  await propertyPage.checkMarketingLayoutForUnavailableUnit(ProgramNames.SierraNorteWebsite);
});

test("TEST-1371:Verify how each unit's state is being reflected in UI", async t => {
  const homepage = new Homepage(t);
  const propertyPage = new PropertyPage(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch(PropertyNames.Parkmerced);
  await homepage.clickOnResult('Parkmerced Apartments, San Francisco, California');

  await propertyPage.clickLayoutButton('2 Bedrooms');
  // For a unit with occupied notice status
  await propertyPage.checkUnitCardContent(unitDetails[0]);

  await propertyPage.clickLayoutButton('4 Bedrooms');
  await propertyPage.checkOnHoldInventorysAreNotDisplayed();

  await propertyPage.clickLayoutButton('2 Bedrooms');
  await propertyPage.checkInventorysWhitoutRmsPricingAreNotDisplayed();

  await propertyPage.clearSearch();
  await propertyPage.typeIntoSearch(PropertyNames.Cove);

  await homepage.clickOnResult('The Cove at Tiburon, Tiburon, California');

  await propertyPage.clickLayoutButton('1 Bedroom');
  await propertyPage.checkVacantMakeReadyReservedInventorysAreNotDisplayed();

  await propertyPage.clickLayoutButton('2 Bedrooms');
  await propertyPage.checkOccupiedInventorysAreNotDisplayed();

  // For a unit with vacant make ready status
  await propertyPage.checkUnitCardContent(unitDetails[1]);
  await propertyPage.checkVacantDownInventorysAreNotDisplayed();

  await propertyPage.clickLayoutButton('1 Bedroom');
  await propertyPage.checkModelInventorysAreNotDisplayed();
});
