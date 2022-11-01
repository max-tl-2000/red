/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { getUnitCode, mapDataToFields, formatPhoneNumberForExport } from './mapUtils';
import { parseFullName, getFirstAndLastName, getPropertyExternalId } from '../../common-export-utils';
import { OccupantType, truncateField } from '../helpers';

const RoommateOccupant = {
  Leesee: 0,
  NonLeesee: -1,
};

const RoommateRelationship = {
  Roommate: 'Roommate',
  Guarantor: 'Guarantor',
  Spouse: 'Spouse',
  Other: 'Other',
};

const getFullName = roommate => (roommate.isChild ? parseFullName(roommate.info.fullName) : getFirstAndLastName(roommate));

const getRoommateRelationship = memberType => (memberType === DALTypes.MemberType.GUARANTOR ? RoommateRelationship.Guarantor : RoommateRelationship.Roommate);

const getRoommateOccupant = (roommate, lease, leaseIsSignedByAllPartyMembers) => {
  if (!lease || !leaseIsSignedByAllPartyMembers) {
    return RoommateOccupant.NonLeesee;
  }
  if (roommate.isChild) return RoommateOccupant.NonLeesee;

  const hasSignedTheLease = lease.signatures.find(signature => signature.partyMemberId === roommate.id);
  const isGuarantor = roommate.memberType === DALTypes.MemberType.GUARANTOR;

  return hasSignedTheLease || isGuarantor ? RoommateOccupant.Leesee : RoommateOccupant.NonLeesee;
};

const getExternalRefId = roommate => roommate.id.substring(0, 20);

const resRoommatesFields = {
  Tenant_Code: {
    fn: ({ externalInfo }) => externalInfo && truncateField(externalInfo.externalId, 8),
    isMandatory: true,
  },
  Ext_Ref_Tenant_Id: '', // if used should be truncated to 250 chars
  Roommate_Code: {
    fn: ({ roommate }) => roommate.externalInfo.externalRoommateId,
    isMandatory: true,
  },
  // eslint-disable-next-line camelcase
  Roommate_PhoneNumber4: {
    fn: ({ roommate }) => !roommate.isChild && truncateField(formatPhoneNumberForExport(roommate.contactInfo.defaultPhone), 20),
  },
  Property_Code: {
    fn: ({ inventory, property }) => truncateField(getPropertyExternalId({ inventory, property }), 8),
    isMandatory: true,
  },
  Unit_Code: {
    fn: ({ inventory }) => truncateField(getUnitCode(inventory), 8),
    isMandatory: true,
  },
  Ext_Ref_Roommate_Id: {
    fn: ({ roommate }) => truncateField(getExternalRefId(roommate), 250),
    isMandatory: true,
  },
  Roommate_LastName: {
    fn: ({ roommate }) => truncateField(getFullName(roommate).lastName, 256),
    isMandatory: true,
  },
  Roommate_FirstName: {
    fn: ({ roommate }) => truncateField(getFullName(roommate).firstName, 50),
    isMandatory: true,
  },
  Roommate_Email: {
    fn: ({ roommate }) => !roommate.isChild && truncateField(roommate.contactInfo.defaultEmail, 80),
  },
  OccupantType: {
    fn: ({ roommate }) => (roommate.isChild ? OccupantType.Minor : OccupantType.Adult),
    isMandatory: true,
  },
  Roommate_Occupant: {
    fn: ({ roommate, lease, leaseIsSignedByAllPartyMembers }) => getRoommateOccupant(roommate, lease, leaseIsSignedByAllPartyMembers),
  },
  Roommate_Relationship: {
    fn: ({ roommate }) => (roommate.isChild ? RoommateRelationship.Other : truncateField(getRoommateRelationship(roommate.memberType), 30)),
    isMandatory: true,
  },
};

const createRoommatesArray = data => {
  const { externals } = data;

  const roommates = data.party.partyMembers
    .filter(pm => pm.id !== data.partyMember.id)
    .map(mate => ({ isChild: false, ...mate, externalInfo: externals.find(e => e.partyMemberId === mate.id) }))
    .sort((a, b) => toMoment(a.created_at).diff(toMoment(b.created_at)));

  const children = data.children.map(child => ({ isChild: true, ...child, externalInfo: externals.find(e => e.childId === child.id) }));

  return roommates.concat(children);
};

export const createResRoommatesMapper = data => {
  const roommates = createRoommatesArray(data);
  if (!roommates.length) return [];

  return roommates.map(roommate => mapDataToFields({ ...data, roommate }, resRoommatesFields));
};
