/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getWebsiteURL, clearTextElement, expectNotVisible, clickOnElement } from '../../helpers/helpers';
import Homepage from '../../pages/website/homepage';
import SearchResultsPage from '../../pages/website/searchResultsPage';
import { PropertyNames, ProgramNames, StateNames, RegionNames, CityNames, lifestylesFilters } from '../../helpers/websiteConstants';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Search results'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

test('TEST-1338: Click on a suggestion from the homepage search endpoint - search by state', async t => {
  const searchResultsPage = new SearchResultsPage(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  // Search by state
  await homepage.typeIntoSearch(StateNames.California);
  await homepage.clickOnResult(StateNames.California);

  const californiaPropertyNames = [PropertyNames.Cove, PropertyNames.Serenity, PropertyNames.Parkmerced, PropertyNames.Acme];

  await searchResultsPage.checkSearchResultsPage([PropertyNames.Parkmerced], californiaPropertyNames);
});

test('TEST-1338: Click on a suggestion from the homepage search endpoint - search by city', async t => {
  const searchResultsPage = new SearchResultsPage(t);
  const homepage = new Homepage(t);
  // Search by city
  await homepage.typeIntoSearch(CityNames.SanFrancisco);
  await homepage.clickOnResult(CityNames.SanFrancisco);

  const sanFranciscoPropertyNames = [PropertyNames.Parkmerced, PropertyNames.Acme];
  await searchResultsPage.checkSearchResultsPage(sanFranciscoPropertyNames, sanFranciscoPropertyNames);
});

test('TEST-1339: Click on a state from the homepage footer', async t => {
  const homepage = new Homepage(t);
  const searchResultsPage = new SearchResultsPage(t);
  await homepage.isDisplayed();

  await homepage.clickOnNavigationStateItemByText(StateNames.California.toUpperCase());

  const californiaPropertyNames = [PropertyNames.Cove, PropertyNames.Serenity, PropertyNames.Parkmerced, PropertyNames.Acme];

  await searchResultsPage.checkSearchResultsPage([PropertyNames.Parkmerced], californiaPropertyNames);
});

test('TEST-1339: Click on a region from the homepage footer', async t => {
  const homepage = new Homepage(t);
  const searchResultsPage = new SearchResultsPage(t);
  await homepage.isDisplayed();

  await homepage.clickOnNavigationItemByText(RegionNames.BayArea);
  const bayAreaPropertyNames = [PropertyNames.Cove, PropertyNames.Serenity, PropertyNames.Parkmerced, PropertyNames.Acme];

  await searchResultsPage.checkSearchResultsPage([PropertyNames.Parkmerced], bayAreaPropertyNames);
});

test('TEST-1344:Check the infos from the property cards from the search result page', async t => {
  const searchResultsPage = new SearchResultsPage(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  await homepage.clickOnNavigationItemByText(RegionNames.NorthCentralUS);

  const sierraNortePropertyCardData = [
    {
      title: PropertyNames.SierraNorte,
      expectedDetails: ['1 bed – 3 beds', '570 – 1,362 sq ft', 'Starting $1,040', '3118 E Bragstad Dr', 'Sioux Falls, CA 57103'],
      campaignPhoneNumber: '650-468-0504',
      program: ProgramNames.SierraNorteWebsite,
    },
  ];

  await searchResultsPage.checkPropertyCards(sierraNortePropertyCardData);
});

test('TEST-1344:Check the infos from the property cards from the search result page - multiple properties in results', async t => {
  const searchResultsPage = new SearchResultsPage(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  await homepage.clickOnNavigationItemByText(RegionNames.BayArea);

  const expectedCards = [
    {
      title: PropertyNames.Serenity,
      expectedDetails: ['1 bed – 2 beds', '708 – 1,096 sq ft', 'Starting $2,450', '700 Lincoln Village Cir', 'Larkspur, CA 94939'],
      campaignPhoneNumber: '650-468-0502',
      program: ProgramNames.SerenityWebsite,
    },
    {
      title: PropertyNames.Cove,
      expectedDetails: ['1 bed – 3 beds', '595 – 2,610 sq ft', 'Starting $3,249', '50 Barbaree Way', 'Tiburon, CA 94920'],
      campaignPhoneNumber: '650-468-0503',
      program: ProgramNames.CoveWebsite,
    },
  ];

  await searchResultsPage.checkPropertyCards(expectedCards);
});

test('TEST-1342:Check the filters from the search result page', async t => {
  const searchResultsPage = new SearchResultsPage(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  // Search by region
  await homepage.typeIntoSearch('Bay Area');
  await homepage.clickOnResult('Bay Area, California');

  // Check the filters titles
  const filtersCategoriesTitles = ['Floorplan type', 'Lifestyles', 'Price'];
  await searchResultsPage.checkFiltersCategoriesTitles(t, filtersCategoriesTitles);

  const floorplanFilters = ['1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4 Bedrooms'];
  await searchResultsPage.checkFloorplanFiltersVisible(t, floorplanFilters);

  const lifestylesFiltersList = [
    lifestylesFilters.Gym,
    lifestylesFilters.BikeFriendly,
    lifestylesFilters.CloseToParks,
    lifestylesFilters.ClubHouse,
    lifestylesFilters.PetFriendly,
    lifestylesFilters.WaterFront,
    lifestylesFilters.NightLife,
    lifestylesFilters.CloseToCenter,
    lifestylesFilters.CloseToTransit,
    lifestylesFilters.FamilyFriendly,
    lifestylesFilters.RentControlled,
  ];

  await searchResultsPage.checkLifestylesFiltersVisible(t, lifestylesFiltersList);

  await searchResultsPage.checkPriceFilterVisible();

  // Check the property cards for the lowest rent value filtering
  await searchResultsPage.typeIntoPriceBox('1156');

  const propertiesWithRentLowerThan1156 = [PropertyNames.Acme];
  await searchResultsPage.checkPropertyCardsArePresent(t, propertiesWithRentLowerThan1156);

  const propertiesWithRentHigherThan1156 = [PropertyNames.Parkmerced, PropertyNames.Cove, PropertyNames.Serenity];
  await searchResultsPage.checkPropertyCardsAreNotPresent(t, propertiesWithRentHigherThan1156);

  // Check the property cards for the highest rent value filtering
  await searchResultsPage.clearPriceFilter();
  await searchResultsPage.typeIntoPriceBox('3249');

  const propertiesWithRentLowerThan3249 = [PropertyNames.Parkmerced, PropertyNames.Serenity, PropertyNames.Acme];
  await searchResultsPage.checkPropertyCardsArePresent(t, propertiesWithRentLowerThan3249);

  // Check the property cards for the "1 bedroom" filtering
  await clickOnElement(t, { selector: searchResultsPage.selectors.SingleBedroomCheckBox });

  const propertiesWithSingleBedroomApts = [PropertyNames.Serenity, PropertyNames.Cove];
  const propertiesWithoutSingleBedroomApts = [PropertyNames.Parkmerced, PropertyNames.Acme];
  await searchResultsPage.checkPropertyCardsArePresent(t, propertiesWithSingleBedroomApts);
  await searchResultsPage.checkPropertyCardsAreNotPresent(t, propertiesWithoutSingleBedroomApts);

  // Check the property cards for the "1 bedroom" + "Active night life" filtering
  await clickOnElement(t, { selector: searchResultsPage.selectors.ActiveNightLifeCheckBox });
  const propertiesWithActiveNightlife = [PropertyNames.Serenity];
  const propertiesWithoutActiveNightlife = [PropertyNames.Cove, PropertyNames.Parkmerced, PropertyNames.Acme];
  await searchResultsPage.checkPropertyCardsArePresent(t, propertiesWithActiveNightlife);
  await searchResultsPage.checkPropertyCardsAreNotPresent(t, propertiesWithoutActiveNightlife);

  // Check the property cards for the case where we don't have any active filters-including the search filter
  await clickOnElement(t, { selector: searchResultsPage.selectors.SingleBedroomCheckBox });
  await clickOnElement(t, { selector: searchResultsPage.selectors.ActiveNightLifeCheckBox });
  await searchResultsPage.clearPriceFilter();
  await searchResultsPage.clearRegionFromSearch();

  const allProperties = [PropertyNames.Parkmerced, PropertyNames.Cove, PropertyNames.Serenity, PropertyNames.Acme, PropertyNames.SierraNorte];
  await searchResultsPage.checkPropertyCardsArePresent(t, allProperties);
});

test('TEST-1343: Check the map from the search result page', async t => {
  const searchResultsPage = new SearchResultsPage(t);
  const homepage = new Homepage(t);
  const { mapFlagSrcValuesLast16, selectors } = searchResultsPage;
  await homepage.typeIntoSearch(CityNames.SanFrancisco);
  await homepage.clickOnResult(CityNames.SanFrancisco);

  const sanFranciscoPropertyNames = [PropertyNames.Acme, PropertyNames.Parkmerced];
  await searchResultsPage.checkSearchResultsPage(sanFranciscoPropertyNames, sanFranciscoPropertyNames);

  const acmeApartmentsSelector = await searchResultsPage.getPropertyCardByTitle(PropertyNames.Acme);
  await searchResultsPage.hoverElement(acmeApartmentsSelector);

  await searchResultsPage.checkMapFlagSrcLast16(selectors.AcmeMapFlag, mapFlagSrcValuesLast16.HoveredFlagSrc);

  await clickOnElement(t, { selector: selectors.Map });
  await searchResultsPage.hoverElement(selectors.AcmeMapFlag);
  await searchResultsPage.checkMapFlagSrcLast16(selectors.AcmeMapFlag, mapFlagSrcValuesLast16.HoveredFlagSrc);

  await clickOnElement(t, { selector: selectors.AcmeMapFlag });
  await searchResultsPage.checkMapFlagSrcLast16(selectors.AcmeMapFlag, mapFlagSrcValuesLast16.HoveredFlagSrc);
  await searchResultsPage.checkMapInfoBoxDetails(PropertyNames.Acme);

  await clickOnElement(t, { selector: selectors.Map, offsetX: 1, offsetY: 1 });
  await expectNotVisible(t, { selector: selectors.InfoBoxCard });

  await clickOnElement(t, { selector: searchResultsPage.selectors.Map });
  await searchResultsPage.checkMapFlagSrcLast16(selectors.AcmeMapFlag, mapFlagSrcValuesLast16.HoveredFlagSrc);

  await searchResultsPage.clickOnZoomOutBotton(t);
  await searchResultsPage.clickOnZoomOutBotton(t);
  await searchResultsPage.clickOnZoomOutBotton(t);

  await searchResultsPage.checkMapFlagSrcLast16(selectors.CollapsedMapFlag, mapFlagSrcValuesLast16.ColapsedFlagsSrc);

  await clickOnElement(t, { selector: selectors.CollapsedMapFlag });

  await searchResultsPage.areMapFlagsVisible(sanFranciscoPropertyNames);

  await clearTextElement(t, { selector: selectors.SearchBox });

  const allPropertyNames = [PropertyNames.Cove, PropertyNames.Serenity, PropertyNames.Parkmerced, PropertyNames.Acme, PropertyNames.SierraNorte];
  await searchResultsPage.arePropertyCardsVisible(allPropertyNames);
});

test('TEST-1389:Check the empty state for the search result page', async t => {
  const searchResultsPage = new SearchResultsPage(t);
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  await homepage.typeIntoSearch('Bay Area');
  await homepage.clickOnResult('Bay Area, California');

  await searchResultsPage.checkMatchFoundState();

  await searchResultsPage.typeIntoPriceBox('1155');
  await clickOnElement(t, { selector: searchResultsPage.selectors.SingleBedroomCheckBox });

  const bayAreaPropertyNames = [PropertyNames.Cove, PropertyNames.Serenity, PropertyNames.Parkmerced, PropertyNames.Acme];
  await searchResultsPage.checkNoMatchFoundState(bayAreaPropertyNames);

  await searchResultsPage.clearPriceFilter();
  await clickOnElement(t, { selector: searchResultsPage.selectors.SingleBedroomCheckBox });
  await clickOnElement(t, { selector: searchResultsPage.selectors.ThreeBedroomsCheckBox });
  await clickOnElement(t, { selector: searchResultsPage.selectors.ActiveNightLifeCheckBox });

  await searchResultsPage.checkNoMatchFoundState(bayAreaPropertyNames);

  await clickOnElement(t, { selector: searchResultsPage.selectors.ThreeBedroomsCheckBox });
  await clickOnElement(t, { selector: searchResultsPage.selectors.ActiveNightLifeCheckBox });
  await clickOnElement(t, { selector: searchResultsPage.selectors.BikeFriendlyCheckBox });
  await searchResultsPage.typeIntoPriceBox('2449');

  await searchResultsPage.checkNoMatchFoundState(bayAreaPropertyNames);
});
