/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../enums/DALTypes';
import { now } from './moment-utils';

export const normalizeFilters = (filters = {}) => {
  const newFilters = {
    propertyIds: filters.propertyIds || [],
    numBedrooms: filters.numBedrooms || [],
    moveInDate: filters.moveInDate || { min: null, max: null },
    marketRent: filters.marketRent || { min: null, max: null },
    lifestyles: filters.lifestyles || [],
    amenities: filters.amenities || [],
    floor: filters.floor || [],
    // unitName: filters.unitName, to get by unitName%. this uses "LIKE"
    // withoutLimit: filters.withoutLimit || false, to get results without the default limit (20 items)
    // query: filters.query || '', to get results using a query, this use globalSearchVector, this will avoid unitName filter
    // inventoryStates: filters.inventoryStates || [], to get units by state like ['model', 'vacantReady']
  };
  if (filters.favoriteUnits) {
    newFilters.favoriteUnits = filters.favoriteUnits;
  }

  return newFilters;
};

export const addPropertyToFilters = (propertyId, filters = {}) => {
  if (!propertyId) return filters;

  const propertyIds = filters.propertyIds || [];
  return {
    ...filters,
    propertyIds: Array.from(new Set([...propertyIds, propertyId])),
  };
};

const addMonthsToDateInTimezone = timezone => monthsToAdd => now({ timezone }).startOf('day').add(monthsToAdd, 'months');

export const createMoveInFilter = (moveInTimeId, { timezone } = {}) => {
  const addMonthsToDate = addMonthsToDateInTimezone(timezone);

  switch (moveInTimeId) {
    case DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS:
      return { min: addMonthsToDate(0), max: addMonthsToDate(1) };
    case DALTypes.QualificationQuestions.MoveInTime.NEXT_2_MONTHS:
      return { min: addMonthsToDate(1), max: addMonthsToDate(2) };
    case DALTypes.QualificationQuestions.MoveInTime.NEXT_4_MONTHS:
      return { min: addMonthsToDate(2), max: addMonthsToDate(4) };
    case DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS:
      return { min: addMonthsToDate(4), max: '' };
    case DALTypes.QualificationQuestions.MoveInTime.I_DONT_KNOW:
    case null:
      return { min: '', max: '' };
    default:
      throw new Error('Invalid key for Move in time filter.');
  }
};

export const getMoveInTimeQuestionFromDate = (moveInDate, { timezone, defaultAnswer = DALTypes.QualificationQuestions.MoveInTime.I_DONT_KNOW } = {}) => {
  const addMonthsToDate = addMonthsToDateInTimezone(timezone);
  if (!moveInDate || moveInDate.isBefore(addMonthsToDateInTimezone(0))) return defaultAnswer;

  if (moveInDate.isAfter(addMonthsToDate(4))) return DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS;
  if (moveInDate.isAfter(addMonthsToDate(2))) return DALTypes.QualificationQuestions.MoveInTime.NEXT_4_MONTHS;
  if (moveInDate.isAfter(addMonthsToDate(1))) return DALTypes.QualificationQuestions.MoveInTime.NEXT_2_MONTHS;

  return DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS;
};

export const updateNumBedroomsToFilters = (numBedrooms, filters) => {
  if (!numBedrooms) return filters;
  return {
    ...filters,
    numBedrooms: Array.from(new Set([...numBedrooms])),
  };
};
