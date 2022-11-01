/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { isCorporateParty } from '../../../../common/helpers/party-utils';
import trim from '../../../../common/helpers/trim';
import { getGuestCardMoveInDate, getFirstAndLastName, getPropertyExternalId } from '../../common-export-utils';
import { mapDataToFields, formatDateForMRI, MAX_LENGTH_FIRST_NAME, MAX_LENGTH_LAST_NAME, DEFAULT_EXTERNAL_UNIQUE_ID } from './utils';
import { formatPhoneNumberForExport } from '../../helpers/export';

const isPrimary = (primaryTenant, partyMember) => primaryTenant.id === partyMember.id;

const ApplicantStatus = {
  Active: 'Active',
  OtherResident: 'Other Resident',
  CoResident: 'Co-Resident',
};

const getApplicantStatus = (primaryTenant, partyMember) => {
  if (isPrimary(primaryTenant, partyMember)) return ApplicantStatus.Active;

  if (partyMember.memberType === DALTypes.MemberType.OCCUPANT || partyMember.type === DALTypes.AdditionalPartyMemberType.CHILD) {
    return ApplicantStatus.OtherResident;
  }

  return ApplicantStatus.CoResident;
};

const trimFirstName = name => trim(name).substring(0, MAX_LENGTH_FIRST_NAME);
const trimLastName = name => trim(name).substring(0, MAX_LENGTH_LAST_NAME);

const fields = {
  NameID: {
    fn: ({ externals, partyMember }) => {
      const externalInfo = externals && externals.find(e => (e.partyMemberId === partyMember.id || e.childId === partyMember.id) && !e.endDate);
      return externalInfo && externalInfo.externalId;
    },
  },
  FirstName: {
    fn: ({ party, partyMember, companyName, primaryTenant }) => {
      if (isCorporateParty(party) && isPrimary(primaryTenant, partyMember)) return trimFirstName(companyName);

      const { firstName } = getFirstAndLastName(partyMember);
      return trimFirstName(firstName);
    },
    isMandatory: true,
  },
  LastName: {
    fn: ({ party, partyMember, companyName, primaryTenant }) => {
      if (isCorporateParty(party) && isPrimary(primaryTenant, partyMember)) return trimLastName(companyName);

      const { lastName } = getFirstAndLastName(partyMember);
      return trimLastName(lastName);
    },
    isMandatory: true,
  },
  PropertyId: {
    fn: ({ property }) => getPropertyExternalId({ property }),
    isMandatory: true,
  },
  Notes: '',
  PrimaryMarketingSource: {
    // TODO: implement mapping  between campaing and pmrm_residentialmarketingsources
    // a default marketing source should be used if no program is set on the party
    // fn: ({ sourceName }) =>  sourceName,
    fn: () => DEFAULT_EXTERNAL_UNIQUE_ID,
    isMandatory: true,
  },
  LeasingConsultant: {
    fn: ({ userExternalUniqueId, teamMemberExternalId, shouldExportExternalUniqueIdForAgent }) => {
      if (!shouldExportExternalUniqueIdForAgent) return DEFAULT_EXTERNAL_UNIQUE_ID;
      if (teamMemberExternalId) return teamMemberExternalId;
      return userExternalUniqueId;
    },
    isMandatory: true,
  },
  Email: {
    fn: ({ partyMember }) => partyMember.contactInfo && partyMember.contactInfo.defaultEmail,
  },
  Phone: {
    fn: ({ partyMember }) => partyMember.contactInfo && formatPhoneNumberForExport(partyMember.contactInfo.defaultPhone),
  },
  Type: {
    fn: ({ partyShouldBeExportedAsApplicant }) => (partyShouldBeExportedAsApplicant ? 'A' : 'P'),
  },
  PrimaryNameID: {
    fn: ({ primaryTenant, externalInfo }) => {
      if (!primaryTenant || primaryTenant.endDate) return '';
      return externalInfo.externalId;
    },
  },
  ApplicantStatus: {
    fn: ({ primaryTenant, partyMember }) => getApplicantStatus(primaryTenant, partyMember),
    isMandatory: true,
  },
  Guarantor: {
    fn: ({ partyMember }) => (partyMember.memberType === DALTypes.MemberType.GUARANTOR ? 'Y' : ''),
  },
  ProspectiveTenant: {
    fn: data =>
      mapDataToFields(data, {
        DesiredMoveInDate: {
          fn: ({ lease, party, property }) => formatDateForMRI(getGuestCardMoveInDate(lease, party, property.timezone), property.timezone),
          isMandatory: true,
        },
        PropertyPreference: {
          fn: ({ appointmentInventory }) => appointmentInventory?.property?.externalId,
        },
        UnitTypePreference: {
          fn: ({ appointmentInventory }) => (!appointmentInventory?.inventorygroup?.inactive ? appointmentInventory?.inventorygroup?.externalId : ''),
        },
        VisitDate: {
          fn: ({ party, property }) => formatDateForMRI(get(party, 'metadata.firstContactedDate', party.created_at), property.timezone),
        },
      }),
    isMandatory: true,
  },
};

export const createGuestCardMapper = data => [mapDataToFields(data, fields)];
