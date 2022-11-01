/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { loginAs, getTenantURL, getUserPassword, doLogoutIfNeeded, clearTextElement, clickOnElement } from '../../helpers/helpers';
import { createAParty } from '../../helpers/rentalApplicationHelpers';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { mockPartyData, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';
import { setHooks } from '../../helpers/hooks';
import PartyDetailPage from '../../pages/partyDetailPage';
import { knex } from '../../../server/database/factory.js';
import { getPropertyIntegrationImportSettings, getRmsPricingRowsByPropertyId } from '../../helpers/dbQueries';
import { TEST_TENANT_ID } from '../../../common/test-helpers/tenantInfo';
import QuoteDraftPage from '../../pages/quoteDraftPage';
import { getPropertyByName } from '../../../server/dal/propertyRepo';

setHooks(fixture('Pricing LRO AND REVA'), {
  fixtureName: 'checkPrices',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
  afterEach: t => doLogoutIfNeeded(t),
});

const ctx = { tenantId: TEST_TENANT_ID, dbKnex: knex };

test.skip('TEST-287:Integration Settings to get pricing from REVA (value set to FALSE)', async t => {
  const importSettingsSierra = await getPropertyIntegrationImportSettings(ctx, 'sierra');
  await t.expect(importSettingsSierra.unitPricing === false).ok();
  await t.expect(importSettingsSierra.residentData === false).ok();
  await t.expect(importSettingsSierra.inventoryState === true).ok();
  await t.expect(importSettingsSierra.inventoryAvailabilityDate === false).ok();
  const propertyId = (await getPropertyByName(ctx, 'sierra')).id;
  const rmsPricing = await getRmsPricingRowsByPropertyId(ctx, propertyId);

  await mapSeries(rmsPricing, async elem => {
    await t.expect(elem.rmsProvider === 'REVA').ok();
  });
  await t.expect(rmsPricing.length === 5).ok();

  const inventoryRentMatrix = rmsPricing[0].rentMatrix;
  const inventoryStatus = rmsPricing[0].status;
  const startingPrice = rmsPricing[0].minRent;
  await t.expect(inventoryStatus === 'vacantReady').ok();
  const userInfo = {
    user: 'sonya@reva.tech',
    password: getUserPassword(),
    fullName: 'Sonya Smith',
  };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  const { partyInfo, qualificationInfo } = mockPartyData;
  const { displayName: propertyName, timezone } = partyInfo.properties[4].displayName; // Sierra
  const partyDetailPage = new PartyDetailPage(t);
  const contactInfo = getMockedApplicantDataByEmail('qatest+mauricewalker@reva.tech');
  const unitName = '104';
  const completeUnitName = 'sierra-1-104';

  await createAParty(t, {
    partyInfo,
    propertyName,
    contactInfo,
    userInfo,
    qualificationInfo,
    skipPropertySelection: true,
  });
  await clickOnElement(t, { selector: '#inventory-panel' });
  await clearTextElement(t, {
    selector: partyDetailPage.selectors.inventoryFilterInput,
  });
  await partyDetailPage.searchUnitByNameInInventory(unitName);
  await partyDetailPage.checkInventoryStartingPrice(t, startingPrice, completeUnitName);
  await partyDetailPage.existUnitNameInInventory(unitName);
  await clickOnElement(t, {
    selector: partyDetailPage.selectors.inventoryCardQuoteBtn.replace('unitName', unitName),
  });

  const quoteDraftPage = new QuoteDraftPage(t);
  await quoteDraftPage.checkBaseRentPerLength(inventoryRentMatrix, 3, timezone);
});
