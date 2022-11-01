/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenant } from './tenantService';
import { getLeaseTypeByPartyId } from '../dal/partyRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import {
  areOccupantsAllowedOnParty,
  isCorporateParty,
  isResident,
  isOccupant,
  isGuarantor,
  isPartyLevelGuarantorOnTraditionalParty,
  isEmergencyTaskAllowedOnParty,
} from '../../common/helpers/party-utils';

export const getPartySettings = async ctx => {
  const { partySettings = {} } = await getTenant(ctx);
  return partySettings;
};

export const areOccupantsAllowed = async (ctx, leaseType) => {
  const partySettings = await getPartySettings(ctx);
  return areOccupantsAllowedOnParty({ leaseType }, partySettings);
};

export const isPartyLevelGuarantor = async ctx => {
  const partySettings = await getPartySettings(ctx);
  return isPartyLevelGuarantorOnTraditionalParty(partySettings);
};

export const shouldShowEmergencyContactTask = async (ctx, leaseType) => {
  const partySettings = await getPartySettings(ctx);
  return isEmergencyTaskAllowedOnParty({ leaseType }, partySettings);
};

export const getAllowedMemberTypes = async (ctx, partyId, partyType) => {
  const leaseType = !partyType ? await getLeaseTypeByPartyId(ctx, partyId) : partyType;

  const guarantorsAllowed = !isCorporateParty({ leaseType });
  const occupantsAllowed = await areOccupantsAllowed(ctx, leaseType);
  const validators = [isResident];
  occupantsAllowed && validators.push(isOccupant);
  guarantorsAllowed && validators.push(isGuarantor);

  return Object.values(DALTypes.MemberType).filter(type => validators.some(isValidType => isValidType(type)));
};
