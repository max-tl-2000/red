/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import { loadParty } from '../dal/partyRepo';
import { getPersonById } from '../dal/personRepo';
import { getInventoryById } from '../dal/inventoryRepo';
import { getPartyLeases } from '../dal/leaseRepo';
import { getPropertyById } from '../dal/propertyRepo';
import { statesTranslationKeys } from '../../common/enums/inventoryStates';
import { getDisplayName } from '../../common/helpers/person-helper';

export const enhanceNavigationHistoryElement = async (ctx, element) => {
  let enhancedElem = {
    type: element.entity_type,
    date: element.visited_at,
  };

  switch (element.entity_type) {
    case DALTypes.NavigationHistoryType.PARTY: {
      const party = await loadParty(ctx, element.entity_id);
      const storedUnitsFilters = party.storedUnitsFilters;
      const leases = await getPartyLeases(ctx, party.id);
      const property = await getPropertyById(ctx, party.assignedPropertyId);
      const [activeLease] = leases.filter(l => l.state !== DALTypes.LeaseStatus.VOIDED);
      const baselineData = activeLease && activeLease.baselineData;
      const quote = (baselineData || {}).quote;
      const isLeaseOrFutureResident = party.state === DALTypes.PartyStateType.LEASE || party.state === DALTypes.PartyStateType.FUTURERESIDENT;
      const moveInDateRange = (storedUnitsFilters || {}).moveInDate;
      const moveInDate = isLeaseOrFutureResident ? moveInDateRange : (quote && quote.moveInDate) || '';

      enhancedElem.entity = {
        id: party.id,
        state: party.state,
        moveInDateRange,
        moveInDate,
        timezone: property && property.timezone,
        propertyName: (property && property.displayName) || '',
        leaseMoveInDate: baselineData || '',
        partyMembers: party.partyMembers,
        endDate: party.endDate,
        qualificationQuestions: party.qualificationQuestions,
        score: party.score,
        archiveDate: party.archiveDate,
      };
      break;
    }
    case DALTypes.NavigationHistoryType.PERSON: {
      const person = await getPersonById(ctx, element.entity_id);
      // TODO: this should be getDisplayName
      const fullName = getDisplayName(person);
      enhancedElem.entity = {
        id: person.id,
        fullName,
      };
      break;
    }
    case DALTypes.NavigationHistoryType.UNIT: {
      const unit = await getInventoryById(ctx, {
        id: element.entity_id,
        expand: true,
      });
      enhancedElem.entity = {
        id: unit.id,
        name: unit.name,
        type: unit.type,
        state: statesTranslationKeys[unit.state],
        layoutNoBathrooms: unit.layout.numBathrooms,
        layoutNoBedrooms: unit.layout.numBedrooms,
        layoutSurfaceArea: unit.layout.surfaceArea,
      };
      break;
    }
    default:
      enhancedElem = element;
  }

  return enhancedElem;
};
