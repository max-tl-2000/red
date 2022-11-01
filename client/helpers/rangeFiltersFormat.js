/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const INCREMENTAL_VALUE_RANGE = 250;

export function roundRoomsNumber(value) {
  const fractionalDigits = value % 1 === 0 ? 0 : 1;
  const result = parseFloat(value).toFixed(fractionalDigits);
  return parseFloat(result);
}

function sortNumber(a, b) {
  return a - b;
}

function roundAndSort(values) {
  const roundValues = values.map(roundRoomsNumber);
  return Array.from(new Set(roundValues)).sort(sortNumber);
}

export function getNumBedroomRange(filterValues) {
  return roundAndSort(filterValues.map(v => v.numBedrooms));
}

export function getNumBathroomRange(filterValues) {
  return roundAndSort(filterValues.map(v => v.numBathrooms));
}

function selectAreasRange(areas) {
  if (!areas || !areas.length) {
    return [];
  }

  const resultAreas = [];
  const floor = parseFloat(areas[0]);
  const ceil = parseFloat(areas[areas.length - 1]);
  const firstStep = INCREMENTAL_VALUE_RANGE - ((floor + INCREMENTAL_VALUE_RANGE) % INCREMENTAL_VALUE_RANGE);

  resultAreas.push(floor);
  for (let i = floor + firstStep; i < ceil; i += INCREMENTAL_VALUE_RANGE) {
    resultAreas.push(i);
  }

  resultAreas.push(ceil);
  return resultAreas;
}

export function getAreaRange(filterValues) {
  const areas = filterValues.map(v => v.surfaceArea);
  const ranges = Array.from(new Set(areas)).sort(sortNumber);
  return selectAreasRange(ranges);
}
