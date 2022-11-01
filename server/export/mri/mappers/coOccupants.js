/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import trim from '../../../../common/helpers/trim';
import { getFirstAndLastName } from '../../common-export-utils';
import { mapDataToFields, MAX_LENGTH_FIRST_NAME, MAX_LENGTH_LAST_NAME } from './utils';
import { formatPhoneNumberForExport } from '../../helpers/export';

const getResidentStatus = partyMember => {
  if (partyMember.memberType === DALTypes.MemberType.OCCUPANT || partyMember.type === DALTypes.AdditionalPartyMemberType.CHILD) {
    return DALTypes.MriResidentStatus.OtherResident;
  }

  return DALTypes.MriResidentStatus.CoResident;
};

const trimFirstName = name => trim(name).substring(0, MAX_LENGTH_FIRST_NAME);
const trimLastName = name => trim(name).substring(0, MAX_LENGTH_LAST_NAME);

const getSSNFromApplication = (personApplications, partyMember) => {
  const personApplication = (personApplications || []).find(pa => pa.personId === partyMember.person.id);
  return personApplication?.ssn || '';
};

const fields = {
  ResidentID: {
    fn: ({ externals, partyMember }) => {
      const externalInfo = externals && externals.find(e => (e.partyMemberId === partyMember.id || e.childId === partyMember.id) && !e.endDate);
      return externalInfo && externalInfo.externalId;
    },
  },
  FirstName: {
    fn: ({ partyMember }) => {
      const { firstName } = getFirstAndLastName(partyMember);
      return trimFirstName(firstName);
    },
    isMandatory: true,
  },
  LastName: {
    fn: ({ partyMember }) => {
      const { lastName } = getFirstAndLastName(partyMember);
      return trimLastName(lastName);
    },
    isMandatory: true,
  },
  Status: {
    fn: ({ partyMember }) => getResidentStatus(partyMember),
    isMandatory: true,
  },
  PrimaryNameID: {
    fn: ({ primaryTenant, externalInfo }) => {
      if (!primaryTenant || primaryTenant.endDate) return '';
      return externalInfo.externalId;
    },
  },
  PropertyID: {
    fn: ({ inventory }) => inventory.property.externalId,
    isMandatory: true,
  },
  BuildingID: {
    fn: ({ inventory }) => inventory.building.externalId,
    isMandatory: true,
  },
  UnitID: {
    fn: ({ inventory }) => inventory.name,
    isMandatory: true,
  },
  LeaseID: {
    fn: ({ lease }) => lease.externalLeaseId,
    isMandatory: true,
  },
  EMailAddress: {
    fn: ({ partyMember }) => partyMember.contactInfo && partyMember.contactInfo.defaultEmail,
  },
  PhoneNumber: {
    fn: ({ partyMember }) => partyMember.contactInfo && formatPhoneNumberForExport(partyMember.contactInfo.defaultPhone),
  },
  SocialSecurityNumber: {
    fn: ({ personApplications, partyMember }) => getSSNFromApplication(personApplications, partyMember),
  },
  NoSSN: {
    fn: ({ personApplications, partyMember }) => (getSSNFromApplication(personApplications, partyMember) ? 'N' : 'Y'),
  },
  Guarantor: {
    fn: ({ partyMember }) => (partyMember.memberType === DALTypes.MemberType.GUARANTOR ? 'Y' : 'N'),
  },
};

export const createCoOccupantsMapper = data => [mapDataToFields(data, fields)];
