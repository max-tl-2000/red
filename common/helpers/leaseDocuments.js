/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const contains = (str, toInclude) => str.toUpperCase().includes(toInclude.toUpperCase());

export const LeaseDocuments = {
  CORE_AGREEMENT: 'Core Agreement',
  GUARANTEE_OF_LEASE: 'Guarantee of Lease',
  PET_AGREEMENT_ADDENDUM: 'Pet Agreement Addendum',
  PET_ADDENDUM: 'Pet addendum',
  ANIMAL_ADDENDUM: 'Animal Addendum',
  RENT_CONCESSION_AGREEMENT: 'Rent Concession Agreement',
  RENT_CONCESSION_ADDENDUM: 'Rent Concession Addendum',
  SFSU_LEASE_ADDENDUM: 'SFSU lease addendum',
  STUDENT_EARLY_TERMINATION_LEASE_ADDENDUM: 'Student Option for Early Termination Addendum',
  STUDENT_2022_OFFER_LEASE_ADDENDUM: 'Summer 2022 Student Offer Addendum',
  BOOKLET: 'BOOKLET',
  HANDBOOK: 'Resident Handbook',
  MARIN_COUNTY_RIGHTS: 'Marin county tenant rights',
  PARKING_ADDENDUM: 'Parking addendum',
  PARKING_ADDENDUM_2: 'Parking addendum 2',
  PARKING_ADDENDUM_3: 'Parking addendum 3',
  PARKING_ADDENDUM_4: 'Parking addendum 4',
  PARKING_ADDENDUM_5: 'Parking addendum 5',
  OCCUPANT_ADDENDUM: 'Occupant authorization addendum',
  STORAGE_ADDENDUM: 'Storage addendum',
  INSPECTION_CHECKLIST_ADDENDUM: 'Inspection checklist addendum',
  EMPLOYEE_HOUSING_ADDENDUM: 'Employee housing addendum',
  CORPORATE_LEASE_ADDENDUM: 'Corporate lease addendum',
};
