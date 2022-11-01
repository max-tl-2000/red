/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { contains, LeaseDocuments } from '../../../common/helpers/leaseDocuments';
import { formatUnitAddress } from '../../../common/helpers/addressUtils';
const COVE = 'cove';
const LARK = 'lark';
const WOOD = 'wood';
const SWPARKME = 'swparkme';
const SHARON = 'sharon';
const SHORE = 'shore';

const alwaysIncluded = matches => name => matches.find(m => contains(name, m));

// TODO: read this from property settings after import
const propertyLeaseSettings = {
  [COVE]: {
    officeWorkingTime: {
      officeDays1: 'Mon - Sat',
      officeDays2: 'Sun',
      officeDays3: '',
      officeHours1: '9am - 6pm',
      officeHours2: '11am - 5pm',
      officeHours3: '',
    },
    leadDisclosureClause: 'DO NOT',
    asbestosLocations: 'Drywall & Stucco',
    rentDueDay: 'fifth (5th)',
    countersignerDescriptor: "Owner or Owner's Representative",
    barbecuePolicy: 'Barbecue grills are permitted with 1 propane tank weighing no more than 1 pound.',
    alwaysIncluded: alwaysIncluded([]),
    propertyPhone: '',
    unitAddress: formatUnitAddress,
  },
  [LARK]: {
    officeWorkingTime: {
      officeDays1: 'Mon - Sat',
      officeDays2: 'Sun',
      officeDays3: '',
      officeHours1: '10am - 6pm',
      officeHours2: '10am - 5pm',
      officeHours3: '',
    },
    leadDisclosureClause: 'DO NOT',
    asbestosLocations: 'Vinyl flooring, sloped roofing material, roofing mastic and fire doors',
    rentDueDay: 'fifth (5th)',
    countersignerDescriptor: "Owner or Owner's Representative",
    barbecuePolicy:
      'The use of any charcoal burner, liquid petroleum gas fueled or any other open flame cooking device are prohibited in tenant’s unit or on their patio/balcony.',
    alwaysIncluded: alwaysIncluded([]),
    propertyPhone: '',
    unitAddress: formatUnitAddress,
  },
  [WOOD]: {
    officeWorkingTime: {
      officeDays1: 'Mon - Fri',
      officeDays2: 'Sat',
      officeDays3: '',
      officeHours1: '9am - 6pm',
      officeHours2: '10am - 5pm',
      officeHours3: '',
    },
    leadDisclosureClause: 'DO NOT',
    asbestosLocations: 'Walls, Ceilings, Floor Tiles, Wall/Floor Insulation',
    rentDueDay: 'fifth (5th)',
    countersignerDescriptor: "Owner or Owner's Representative",
    barbecuePolicy:
      'The use of any charcoal burner, liquid petroleum gas fueled or any other open flame cooking device are prohibited in tenant’s unit or on their patio/balcony.',
    alwaysIncluded: alwaysIncluded([]),
    propertyPhone: '',
    unitAddress: formatUnitAddress,
  },
  [SWPARKME]: {
    officeWorkingTime: {
      officeDays1: 'Mon - Fri',
      officeDays2: 'Sat',
      officeDays3: '',
      officeHours1: '9am - 6pm',
      officeHours2: '',
      officeHours3: '',
    },
    leadDisclosureClause: '',
    asbestosLocations:
      'in the tile floors on the second through top floors, halls and elevators of all the high-rise apartment buildings; insulation on the piping and heaters in the boiler rooms, laundry rooms and in the basement hallways; insulation for the heating system duct work in garden apartments in the heater closets; and in some apartment kitchen floor coverings',
    rentDueDay: 'first (1st)',
    countersignerDescriptor: "Owner or Owner's Representative",
    barbecuePolicy: '',
    alwaysIncluded: alwaysIncluded([LeaseDocuments.PET_AGREEMENT_ADDENDUM]),
    propertyPhone: '(415) 405-4690',
    unitAddress: formatUnitAddress,
  },
  [SHARON]: {
    officeWorkingTime: {
      officeDays1: 'Mon - Sat',
      officeDays2: 'Sun',
      officeDays3: '',
      officeHours1: '9am - 6pm',
      officeHours2: '10am - 5pm',
      officeHours3: '',
    },
    leadDisclosureClause: 'DO',
    asbestosLocations: 'drywall, stucco, and select floor adhesive',
    rentDueDay: 'first (1st)',
    countersignerDescriptor: "Owner or Owner's Representative",
    barbecuePolicy:
      'The use of any charcoal burner, liquid petroleum gas fueled or any other open flame cooking device are prohibited in tenant’s unit or on their patio/balcony.',
    alwaysIncluded: alwaysIncluded([]),
    propertyPhone: '',
    unitAddress: formatUnitAddress,
  },
  [SHORE]: {
    officeWorkingTime: {
      officeDays1: 'Mon - Sat',
      officeDays2: 'Sun',
      officeDays3: '',
      officeHours1: '9am - 6pm',
      officeHours2: '10am - 5pm',
      officeHours3: '',
    },
    leadDisclosureClause: 'DO',
    asbestosLocations: '',
    rentDueDay: 'first (1st)',
    countersignerDescriptor: "Owner or Owner's Representative",
    barbecuePolicy:
      'The use of any charcoal burner, liquid petroleum gas fueled or any other open flame cooking device are prohibited in tenant’s unit or on their patio/balcony.',
    alwaysIncluded: alwaysIncluded([]),
    propertyPhone: '',
    unitAddress: formatUnitAddress,
  },
};

// TODO: make this editable via UI
const defaultPropertySettings = {
  officeWorkingTime: {
    officeDays1: 'Mon - Fri',
    officeDays2: 'Sat',
    officeDays3: '',
    officeHours1: '9am - 6pm',
    officeHours2: '10am - 5pm',
    officeHours3: '',
  },
  leadDisclosureClause: 'DO NOT',
  asbestosLocations: '',
  rentDueDay: 'fifth (5th)',
  countersignerDescriptor: "Owner or Owner's Representative",
  barbecuePolicy:
    'The use of any charcoal burner, liquid petroleum gas fueled or any other open flame cooking device are prohibited in tenant’s unit or on their patio/balcony.',
  alwaysIncluded: alwaysIncluded([]),
  propertyPhone: '',
  unitAddress: formatUnitAddress,
};

export const naturalGasProvidedProperties = ['11500', '12982'];
export const submeterAddendumProperties = ['13780', '11500', '11501', '12982'];
export const utilityAddendumProperties = ['11190', '14160'];

export const getLeaseSettingsForProperty = propertyName => propertyLeaseSettings[propertyName] || defaultPropertySettings;
