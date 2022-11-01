/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import update from 'immutability-helper';
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';
import flatten from 'lodash/flatten';
import partition from 'lodash/partition';
import { toMoment, isValidMoment } from 'helpers/moment-utils';
import { createSelector } from 'reselect';
import { isNumber, isObject } from 'helpers/type-of';
import { DALTypes } from '../../common/enums/DALTypes';
import { SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../common/date-constants';
import { formatNumBedrooms as formatBedrooms } from '../../common/helpers/inventory';

export function getShortHand(shorthand) {
  return shorthand || '';
}

export default function getUnitShortName(unit) {
  const propertySH = getShortHand(unit.property.displayName);
  const buildingSH = getShortHand(unit.building.displayName);
  const layoutSH = getShortHand(unit.layout.displayName);

  if (!propertySH && !buildingSH && !layoutSH) {
    return `${unit.name}`;
  }

  return `${propertySH}${buildingSH}${layoutSH} - ${unit.name}`;
}

export function formatUnitCardInfo(unit) {
  const formattedNumBedrooms = formatBedrooms(unit.layoutNoBedrooms, 'UNIT_DETAILS_BEDROOMS');
  const formattedNumBathrooms = t('UNIT_DETAILS_BATHROOMS', {
    count: unit.layoutNoBathrooms,
  });

  const formatArea = t('UNIT_DETAILS_AREA', {
    area: unit.layoutSurfaceArea,
  });

  return {
    unitDetails: `${formattedNumBedrooms}, ${formattedNumBathrooms}`,
    area: `${formatArea}`,
  };
}

export const array2DataSource = (items, object) => items.map(item => ({ id: item, text: t(object[item]) }));
export const bedroomsArray2DataSource = items => Object.keys(items).map(item => ({ id: item, text: t(item) }));

export function formattedNumBedroomsForFilters(numBedrooms) {
  if (isNumber(numBedrooms)) return numBedrooms;

  const numBedroomsOptions = DALTypes.QualificationQuestions.BedroomOptions;
  const numBedroomsItems = Object.keys(numBedroomsOptions).map(idx => ({
    id: idx,
    text: t(idx),
  }));
  return numBedroomsItems.reduce((acc, item) => {
    if (numBedrooms.includes(item.id)) {
      return acc ? `${acc}, ${item.text}` : `${item.text}`;
    }
    return acc;
  }, '');
}

export const updateUnitsFilter = (filters, filterName, value) =>
  update(filters, {
    [filterName]: {
      $set: value,
    },
  });

const sortByName = (a, b) => (a.name > b.name ? 1 : -1);

const sortByFloorNumbers = (a, b) => a - b;

export const getAmenitiesForProperties = properties => {
  if (!properties.length) return [];
  const allAmenities = flatten(properties.map(p => p.amenities)).sort(sortByName);
  const [highAmenities, otherAmenities] = partition(allAmenities, 'isHighValue');
  const uniqueAmenities = uniqBy(highAmenities.concat(otherAmenities), 'name');
  return uniqueAmenities.map(a => ({ id: a.name, text: a.name, highValue: a.isHighValue }));
};

export const getFloorsForProperties = properties => {
  if (!properties.length) return [];
  const allFloors = properties.map(p => p.floors);
  return uniq(flatten(allFloors))
    .sort(sortByFloorNumbers)
    .map(f => ({ id: f, text: f }));
};

export const formatFloorLevels = floors => floors.map(f => (isObject(f) ? { ...f, text: `${t('LABEL_FLOOR')} ${f.text}` } : `${t('LABEL_FLOOR')} ${f}`));

export const getMoveInDateSummary = (range, { timezone } = {}) => {
  if (!range) {
    return '';
  }

  const { min, max } = range;

  const minDate = min ? toMoment(min, { timezone }) : undefined;
  const maxDate = max ? toMoment(max, { timezone }) : undefined;

  const validMinDate = isValidMoment(minDate);
  const validMaxDate = isValidMoment(maxDate);

  if (validMinDate && validMaxDate) {
    const isSameYear = minDate.isSame(maxDate, 'year');

    const minDateFormatted = minDate.format(isSameYear ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT);
    const maxDateFormatted = maxDate.format(MONTH_DATE_YEAR_FORMAT);

    return `${minDateFormatted} - ${maxDateFormatted}`;
  }

  if (validMinDate) {
    return `${t('FROM_LABEL')} ${minDate.format(MONTH_DATE_YEAR_FORMAT)}`;
  }

  if (validMaxDate) {
    return `${t('UNTIL_LABEL')} ${maxDate.format(MONTH_DATE_YEAR_FORMAT)}`;
  }

  return '';
};

const isValidLeaseUnitDate = (inventoryId, lease) => lease.status === DALTypes.LeaseStatus.EXECUTED && lease.baselineData.quote.inventoryId === inventoryId;

export const getInventoryLeaseSelector = createSelector(
  s => s.dataStore.get('leases'),
  (s, props) => {
    if (props.params && props.params.inventoryId) {
      return props.params.inventoryId;
    }
    if (props.inventory && props.inventory.id) {
      return props.inventory.id;
    }
    return undefined;
  },
  (leases, inventoryId) => leases.filter(l => isValidLeaseUnitDate(inventoryId, l)),
);

const FLOOR_MULTIPLE = 500;
const CEIL_MULTIPLE = 500;

export const floorAmountToClosestMultiple = min => Math.floor(min / FLOOR_MULTIPLE) * FLOOR_MULTIPLE;
export const ceilAmountToClosestMultiple = max => Math.ceil(max / CEIL_MULTIPLE) * CEIL_MULTIPLE;

export const getSortedAndFormattedNumBedroomsForFilters = numBedrooms => {
  if (!numBedrooms || !numBedrooms.length) {
    return '';
  }

  const bedroomsNames = ['STUDIO', 'ONE_BED', 'TWO_BEDS', 'THREE_BEDS', 'FOUR_PLUS_BEDS'];
  const sortedBedrooms = numBedrooms.map(bedroom => bedroomsNames.indexOf(bedroom)).sort();
  return sortedBedrooms
    .map(numBedroom => {
      if (numBedroom === 4) {
        return '4+';
      }
      if (numBedroom === 0) {
        return t('STUDIO');
      }
      return numBedroom;
    })
    .join(', ');
};

export const getSortedAndFormattedFloorForFilters = floors => {
  if (!floors || !floors.length) {
    return '';
  }

  const sortedFloors = floors.sort();
  const suffix = ['st', 'nd', 'rd', 'th'];
  return sortedFloors.map(f => `${f}${suffix[f - 1] || 'th'}`).join(', ');
};
