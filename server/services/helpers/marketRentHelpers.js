/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getInventoryObject } from '../../dal/searchRepo';
import { getPropertyById, getPropertySettings } from '../../dal/propertyRepo';
import { getLeaseTerms } from '../../dal/leaseTermRepo';
import { getAllConcessionsWithLeaseTerms } from '../../dal/concessionRepo';
import { getAllInventoryAmenities } from '../../dal/inventoryRepo';
import { calculatePartialAdjustedMarketRentWithNonVariableBakedFees } from '../../../common/helpers/quotes';
import { getLeaseTermActiveConcessions } from '../concessions';
import { momentNow } from '../../../common/helpers/moment-utils';
import { getPartyWorkflowByPartyId } from '../../dal/partyRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { shouldUseRmsPricing } from '../rms';

export const isSpecial = concession => !concession.hideInSelfService && !concession.bakedIntoAppliedFeeFlag;

const getMarketRents = (propertySettings, { marketRent, renewalMarketRent, lowestMonthlyRent, renewalLowestMonthlyRent }) =>
  shouldUseRmsPricing(propertySettings) ? { marketRent: lowestMonthlyRent, renewalMarketRent: renewalLowestMonthlyRent } : { marketRent, renewalMarketRent };

const rentByPartyWorkflowMapping = {
  [DALTypes.WorkflowName.RENEWAL]: ({ marketRent, renewalMarketRent, minRentLeaseLength, renewalMinRentLeaseLength }) => {
    if (marketRent && renewalMarketRent) return { isRenewal: true, marketRent: renewalMarketRent, leaseLength: renewalMinRentLeaseLength };

    if (marketRent) return { marketRent, leaseLength: minRentLeaseLength };

    if (renewalMarketRent) return { isRenewal: true, marketRent: renewalMarketRent, leaseLength: renewalMinRentLeaseLength };

    return 0;
  },
  [DALTypes.WorkflowName.NEW_LEASE]: ({ marketRent, renewalMarketRent, minRentLeaseLength, renewalMinRentLeaseLength }) => {
    if (marketRent && renewalMarketRent) return { marketRent, leaseLength: minRentLeaseLength };

    if (marketRent) return { marketRent, leaseLength: minRentLeaseLength };

    if (renewalMarketRent) return { isRenewal: true, marketRent: renewalMarketRent, leaseLength: renewalMinRentLeaseLength };

    return 0;
  },
};

const isEquals = (prop, compareTo) => prop === compareTo;

const doesAmenityBelongsToInventory = isEquals;
const doesAmenityBelongsToBuilding = isEquals;
const doesAmenityBelongsToInventoryGroup = isEquals;
const doesAmenityBelongsToProperty = isEquals;
const doesAmenityBelongsToLayout = isEquals;

const isAmenityRelatedToUnit = (amenity, unit) =>
  doesAmenityBelongsToInventory(amenity.inventoryId, unit.id) ||
  doesAmenityBelongsToBuilding(amenity.buildingId, unit.buildingId) ||
  doesAmenityBelongsToInventoryGroup(amenity.inventoryGroupId, unit.inventoryGroupId) ||
  doesAmenityBelongsToProperty(amenity.propertyId, unit.propertyId) ||
  doesAmenityBelongsToLayout(amenity.layoutId, unit.layoutId);

const calculateSpecialsAndAdjustedMarketRent = (ctx, { inventory, marketRent, inventoryLeaseTerms, inventoryAmenities, concessions, timezone }) =>
  inventoryLeaseTerms.reduce(
    (acc, leaseTerm) => {
      const leaseTermConcessions = concessions.filter(concession => concession.LeaseTermId === leaseTerm.id);
      const activeLeaseTermConcessions = getLeaseTermActiveConcessions({
        ctx,
        createdAt: momentNow(),
        leaseTerm,
        concessions: leaseTermConcessions,
        inventoryAmenities,
        inventory,
        timezone,
      });

      const leaserTermWithConcessions = {
        ...leaseTerm,
        concessions: activeLeaseTermConcessions,
      };

      const adjustedMarketRent = calculatePartialAdjustedMarketRentWithNonVariableBakedFees(leaserTermWithConcessions, marketRent);

      if (adjustedMarketRent < acc.adjustedMarketRent) {
        acc.adjustedMarketRent = adjustedMarketRent;
      }
      if (activeLeaseTermConcessions.some(concession => isSpecial(concession))) {
        acc.specials = true;
      }
      return acc;
    },
    { specials: false, adjustedMarketRent: 999999 },
  );

export const getInventoryMarketRentByPartyWorkflow = async (ctx, { propertySettings, propertyId, partyWorkflow, partyId, inventoryObject }) => {
  if (!inventoryObject || (!propertySettings && !propertyId)) return { marketRent: null };

  const settings = propertySettings || (await getPropertySettings(ctx, propertyId));
  const { minRentLeaseLength, renewalMinRentLeaseLength } = inventoryObject;
  const { marketRent, renewalMarketRent } = getMarketRents(settings, inventoryObject);

  if (!partyId && !partyWorkflow) return { marketRent, leaseLength: minRentLeaseLength };

  const workflow = partyWorkflow || (await getPartyWorkflowByPartyId(ctx, partyId));

  const handler = rentByPartyWorkflowMapping[workflow];
  return handler({ marketRent, renewalMarketRent, minRentLeaseLength, renewalMinRentLeaseLength });
};

export const computeInventoryMarketRentByPartyWorkflow = ({ propertySettings, partyWorkflow, inventoryObject }) => {
  if (!inventoryObject || !propertySettings) return { marketRent: null };

  const { minRentLeaseLength, renewalMinRentLeaseLength } = inventoryObject;
  const { marketRent, renewalMarketRent } = getMarketRents(propertySettings, inventoryObject);

  if (!partyWorkflow) return { marketRent, leaseLength: minRentLeaseLength };

  const handler = rentByPartyWorkflowMapping[partyWorkflow];
  return handler({ marketRent, renewalMarketRent, minRentLeaseLength, renewalMinRentLeaseLength });
};

export const getMarketRentInfoForUnit = async (ctx, unit, { property, leaseTerms, inventoryAmenities, concessions, partyId }) => {
  const inventory = {
    ...unit,
    ...(unit.inventorygroup ? { leaseNameId: unit.inventorygroup.leaseNameId } : {}),
    ...(!unit.inventoryObject ? { inventoryObject: await getInventoryObject(ctx, unit.id) } : {}),
  };

  const { timezone, settings: propertySettings } = property || (await getPropertyById(ctx, inventory.propertyId));
  const allLeaseTerms = leaseTerms || (await getLeaseTerms(ctx));
  const concessionsWithLeaseTerms = concessions || (await getAllConcessionsWithLeaseTerms(ctx));
  const amenities = inventoryAmenities || (await getAllInventoryAmenities(ctx));

  const unitAmenities = amenities.filter(amenity => isAmenityRelatedToUnit(amenity, inventory));
  const unitleaseTerms = allLeaseTerms.filter(leaseTerm => leaseTerm.leaseNameId === inventory.leaseNameId);

  const { marketRent, isRenewal, leaseLength } = await getInventoryMarketRentByPartyWorkflow(ctx, {
    propertySettings,
    partyId,
    inventoryObject: inventory.inventoryObject,
  });
  const { specials, adjustedMarketRent } = calculateSpecialsAndAdjustedMarketRent(ctx, {
    inventory,
    marketRent,
    inventoryLeaseTerms: unitleaseTerms,
    inventoryAmenities: unitAmenities,
    concessions: concessionsWithLeaseTerms,
    timezone,
  });

  return { specials, adjustedMarketRent, isRenewal, leaseLength };
};
