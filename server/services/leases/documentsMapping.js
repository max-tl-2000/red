/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { contains, LeaseDocuments } from '../../../common/helpers/leaseDocuments';

const isPetAddendum = documentDisplayName => contains(documentDisplayName, LeaseDocuments.PET_AGREEMENT_ADDENDUM);

export const documentsMapping = (
  { documents },
  { guarantors = [], pets = [], hasConcessions, hasPets, publishedLease, quote, occupants = [], children = [], isRenewalLease, isCorporateParty, isEmployee },
  { alwaysIncluded },
) => {
  const defaultValuesForCustomDocuments = Object.keys(documents).reduce((acc, c) => {
    const displayName = documents[c].displayName || c;
    const guaranteeLease = contains(displayName, LeaseDocuments.GUARANTEE_OF_LEASE);
    const concessionAgreement = contains(displayName, LeaseDocuments.RENT_CONCESSION_AGREEMENT);
    const concessionAddendum = contains(displayName, LeaseDocuments.RENT_CONCESSION_ADDENDUM);
    const mainForm = contains(displayName, LeaseDocuments.CORE_AGREEMENT);
    const sfsuAddendum = contains(displayName, LeaseDocuments.SFSU_LEASE_ADDENDUM);
    const studentEarlyTerminationAddendum = contains(displayName, LeaseDocuments.STUDENT_EARLY_TERMINATION_LEASE_ADDENDUM);
    const student2022OfferAddendum = contains(displayName, LeaseDocuments.STUDENT_2022_OFFER_LEASE_ADDENDUM);
    const booklet = contains(displayName, LeaseDocuments.BOOKLET);
    const handbook = contains(displayName, LeaseDocuments.HANDBOOK);
    const marinCountyTenantRights = contains(displayName, LeaseDocuments.MARIN_COUNTY_RIGHTS);
    const parkingAddendum1 = contains(displayName, LeaseDocuments.PARKING_ADDENDUM);
    const parkingAddendum2 = contains(displayName, LeaseDocuments.PARKING_ADDENDUM_2);
    const parkingAddendum3 = contains(displayName, LeaseDocuments.PARKING_ADDENDUM_3);
    const parkingAddendum4 = contains(displayName, LeaseDocuments.PARKING_ADDENDUM_4);
    const parkingAddendum5 = contains(displayName, LeaseDocuments.PARKING_ADDENDUM_5);
    const storageAddendum = contains(displayName, LeaseDocuments.STORAGE_ADDENDUM);
    const occupantAddendum = contains(displayName, LeaseDocuments.OCCUPANT_ADDENDUM);
    const employeeAddendum = contains(displayName, LeaseDocuments.EMPLOYEE_HOUSING_ADDENDUM);
    const corporateAddendum = contains(displayName, LeaseDocuments.CORPORATE_LEASE_ADDENDUM);
    const inspectionChecklistAddendum = contains(displayName, LeaseDocuments.INSPECTION_CHECKLIST_ADDENDUM);

    const noOfParkingSpots = ((quote && quote.parkingSpaces) || []).length;
    const noOfStorageSpaces = ((quote && quote.storageSpaces) || []).length;
    const petRentQuantity = quote && quote.petRentQuantity;
    const serviceAnimalQuantity = quote?.serviceAnimalQuantity;

    const sfsuAddendumIncluded = publishedLease?.sfsuAddendumIncluded;
    const studentEarlyTerminationAddendumIncluded = publishedLease?.studentEarlyTerminationAddendumIncluded;
    const student2022OfferAddendumIncluded = publishedLease?.student2022OfferAddendumIncluded;

    const isIncluded = () => {
      if (guaranteeLease) {
        return !!guarantors[0];
      }
      if (isPetAddendum(displayName)) {
        return !!pets[0] || hasPets || petRentQuantity > 0 || serviceAnimalQuantity > 0;
      }
      if (concessionAgreement || concessionAddendum) {
        return hasConcessions;
      }
      if (sfsuAddendum) {
        return !!sfsuAddendumIncluded;
      }
      if (studentEarlyTerminationAddendum) {
        return !!studentEarlyTerminationAddendumIncluded;
      }
      if (student2022OfferAddendum) {
        return !!student2022OfferAddendumIncluded;
      }
      if (parkingAddendum5) {
        return noOfParkingSpots > 4;
      }
      if (parkingAddendum4) {
        return noOfParkingSpots > 3;
      }
      if (parkingAddendum3) {
        return noOfParkingSpots > 2;
      }
      if (parkingAddendum2) {
        return noOfParkingSpots > 1;
      }
      if (parkingAddendum1) {
        return noOfParkingSpots > 0;
      }
      if (storageAddendum) {
        return noOfStorageSpaces > 0;
      }
      if (occupantAddendum) {
        return !!occupants[0] || !!children[0];
      }
      if (inspectionChecklistAddendum) {
        return !isRenewalLease;
      }
      if (corporateAddendum) {
        return isCorporateParty;
      }
      if (employeeAddendum) {
        return isEmployee;
      }

      return true;
    };

    acc[c] = {
      mandatory: false,
      isIncluded: isIncluded() || alwaysIncluded(displayName),
      guarantorOnly: guaranteeLease,
      mainForm,
      booklet,
      handbook,
      marinCountyTenantRights,
      displayName,
      fields: documents[c].fields || [],
      formId: documents[c].formId,
    };
    return acc;
  }, {});

  return defaultValuesForCustomDocuments;
};
