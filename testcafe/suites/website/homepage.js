/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import Homepage from '../../pages/website/homepage';
import { getWebsiteURL, expectVisible } from '../../helpers/helpers';
import { setHooks } from '../../helpers/hooks';

setHooks(fixture('Homepage'), {
  skipDatabaseRestore: true,
  beforeEach: async t => {
    await t.navigateTo(getWebsiteURL('/'));
  },
});

test('TEST-1332: Check the suggestions that are being returned by the homepage search endpoint', async t => {
  const homepage = new Homepage(t);
  const stateDropDownItemText = 'California';
  const cityDropDownItemText = 'San Francisco';

  await homepage.isDisplayed();

  // Search by state name
  await homepage.typeIntoSearch(stateDropDownItemText);
  await homepage.resultExists(stateDropDownItemText);

  // Search by state alias
  await homepage.clearSearch();
  await homepage.typeIntoSearch('Cal');
  await homepage.resultExists(stateDropDownItemText);

  // Search by city
  await homepage.clearSearch();
  await homepage.typeIntoSearch(cityDropDownItemText);
  await homepage.resultExists(cityDropDownItemText);

  // Search by city alias
  await homepage.clearSearch();
  await homepage.typeIntoSearch('oakland');
  await homepage.resultExists(cityDropDownItemText);
});

test('TEST-1340:Check the structure of the suggestions from the homepage search endpoint', async t => {
  const homepage = new Homepage(t);
  await homepage.isDisplayed();

  // Search by part of a neighborhood, a city and a community name at the same time
  await homepage.typeIntoSearch('si');

  const expectedSuggestions = [
    'NEIGHBORHOOD',
    'SierraNeighborhood, Sioux Falls, South Dakota',
    'CITIES',
    'Sioux Falls, South Dakota',
    'COMMUNITIES',
    'Sierra Norte, Sioux Falls, South Dakota',
  ];

  await mapSeries(expectedSuggestions, async expSg => await homepage.resultExistsBound(expSg));
});

test('TEST-1333:Check the lists of regions that are being displayed in the homepage footer', async t => {
  const homepage = new Homepage(t);
  await homepage.isDisplayed();
  await expectVisible(t, { selector: '#navigation' });

  const footerItemExists = async (tst, item) => {
    const footerElem = await $('#navigation a').withText(item.state.toUpperCase()).with({ boundTestRun: t });

    await tst.expect(footerElem.visible).eql(true);
    const regions = (item.regions || []).split(',');
    await mapSeries(regions, async region => await tst.expect(footerElem.sibling('ul').child('li').child('a').withText(region).visible).eql(true));
  };

  const expectedFooterItems = [
    {
      state: 'CALIFORNIA',
      regions: 'Bay Area',
    },
    {
      state: 'SOUTH DAKOTA',
      regions: 'North-Central US',
    },
  ];

  await mapSeries(expectedFooterItems, async item => await footerItemExists(t, item));
});
