/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import newId from 'uuid/v4';
import {
  testCtx,
  createAUser,
  createAParty,
  createAPartyMember,
  createAnInventory,
  createAnAmenity,
  addAmenityToInventory,
  createALeaseTerm,
  createALeaseName,
  createAInventoryGroup,
  refreshUnitSearch,
  createAProperty,
  createAFee,
  saveUnitsRevaPricing,
  createALayout,
  createABuilding,
} from './repoHelper';
import { getAuthHeader } from './apiHelper';
import app from '../api/api';
import { now } from '../../common/helpers/moment-utils';
import { DALTypes } from '../../common/enums/DALTypes';

const createQuoteDraft = (inventoryId, partyId) => request(app).post('/quotes').set(getAuthHeader()).send({ inventoryId, partyId });

const patchQuote = (quoteId, leaseTerms, selections, leaseStartDate, propertyTimezone = 'America/Los_Angeles') =>
  request(app).patch(`/quotes/draft/${quoteId}`).set(getAuthHeader()).send({
    leaseTerms,
    selections,
    leaseStartDate,
    propertyTimezone,
  });

const publishQuote = quoteId =>
  request(app)
    .patch(`/quotes/draft/${quoteId}`)
    .set(getAuthHeader())
    .send({
      publishDate: now(),
      expirationDate: now().add(50, 'days').toISOString(),
      propertyTimezone: 'America/Los_Angeles',
    });

const getPublishedQuote = quoteId =>
  request(app).get(`/quotes/published/${quoteId}`).set(getAuthHeader(undefined, undefined, undefined, undefined, { quoteId }));

const createFeeStructureForProperty = async propertyId => {
  const leaseName = await createALeaseName(testCtx, { propertyId });
  const layout = await createALayout({});

  const building = await createABuilding({ propertyId });
  const inventoryGroup = await createAInventoryGroup({
    propertyId,
    leaseNameId: leaseName.id,
  });

  const [leaseTerm, inventory] = await Promise.all([
    createALeaseTerm({ leaseNameId: leaseName.id, propertyId }),
    createAnInventory({
      buildingId: building.id || null,
      layoutId: layout.id,
      propertyId,
      inventoryGroupId: inventoryGroup.id,
    }),
  ]);

  const amenity = await createAnAmenity({
    id: newId(),
    category: 'inventory',
    propertyId,
  });

  await addAmenityToInventory(testCtx, inventory.id, amenity.id);

  return {
    leaseTermId: leaseTerm.id,
    amenityId: amenity.id,
    inventory,
  };
};

export const pricingSetting = { integration: { import: { unitPricing: false } } };

export const createQuotePrerequisites = async (propertySettings = { ...pricingSetting }, partyState, userName) => {
  const user = await createAUser({ name: userName });
  const property = await createAProperty(propertySettings);
  const party = await createAParty({
    userId: user.id,
    assignedPropertyId: property.id,
    state: partyState || DALTypes.PartyStateType.CONTACT,
  });
  const partyMember = await createAPartyMember(party.id, propertySettings.personId && { personId: propertySettings.personId });
  const fee = await createAFee({
    feeType: 'application',
    feeName: 'singleAppFee',
    absolutePrice: 100,
    propertyId: property.id,
  });

  const feeStructureForPropertyResult = await createFeeStructureForProperty(property.id);
  const { inventory } = feeStructureForPropertyResult;
  await saveUnitsRevaPricing([inventory]);
  await refreshUnitSearch();

  return {
    ...feeStructureForPropertyResult,
    property,
    partyId: party.id,
    fee,
    partyMember: {
      id: partyMember.id,
      personId: partyMember.personId,
    },
    user,
    inventoryId: inventory.id,
  };
};

export const setupTestQuote = async quoteData => {
  const quote = (await createQuoteDraft(quoteData.inventoryId, quoteData.partyId)).body;

  const leaseTerms = [
    {
      id: quoteData.leaseTermId,
      concessions: [],
      additionalAndOneTimeCharges: [],
    },
  ];

  const selections = {
    selectedLeaseTerms: [
      {
        id: quoteData.leaseTermId,
        paymentSchedule: [
          {
            timeframe: 'Oct 2016',
            amount: 1000,
          },
        ],
      },
    ],
    concessions: [],
  };

  await patchQuote(quote.id, leaseTerms, selections, now());

  await publishQuote(quote.id);

  const publishedQuote = (await getPublishedQuote(quote.id)).body;

  return {
    ...quoteData,
    publishedQuote,
  };
};
