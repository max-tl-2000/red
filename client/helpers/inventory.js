/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import capitalize from 'lodash/capitalize';
import { getShortFormatRentableItem } from '../../common/helpers/quotes';
import { getHighValueAmenityNames, getQuoteLayoutSummary, formatLayout, formatNumBedrooms, getPolicyStatement } from '../../common/helpers/inventory';
// Max characters length
const AMENITIES_MAX_LENGTH = 275;

function getAmenityObject(unit, amenity) {
  const exists = unit.amenities.some(a => a.id === amenity.id);
  return {
    label: amenity.displayName,
    category: amenity.category,
    checked: exists,
  };
}

function groupAmenitiesByCategory(allAmenities) {
  return allAmenities.reduce((amenities, amenity) => {
    amenities[amenity.category] = amenities[amenity.category] || [];
    amenities[amenity.category].push(amenity);
    return amenities;
  }, {});
}

const getAmenitiesAvailablePerUnit = (unit, amenities) => {
  const amenitiesPerUnit = amenities.map(amenity => getAmenityObject(unit, amenity));
  return groupAmenitiesByCategory(amenitiesPerUnit);
};

// Unit 1701, Building 209, Serenity at Larkspur
const getUnitInformation = inventory => {
  // TODO: fix this, use UnitSearch view
  const { property, building, name } = inventory;
  return t('LEASE_FORM_QUOTE_SUMMARY', {
    unitName: name,
    buildingName: building.displayName,
    propertyName: property.displayName,
  });
};

// "4 beds, 3.5 baths (swparkme-102-124) unit"
const getLayoutSummary = inventory => {
  const { numBathrooms, numBedrooms } = inventory.layout;

  const formattedLayoutInfo = formatLayout({
    numBathrooms,
    numBedrooms,
    type: inventory.type,
  });
  return `${formattedLayoutInfo} (${getShortFormatRentableItem(inventory)})`;
};

const getPartialQualifiedName = inventory => {
  const inventoryPropertyName = inventory.propertyName || '';
  const inventoryBuildingName = inventory.buildingName || '';

  return `${inventoryPropertyName}-${inventoryBuildingName}${inventoryBuildingName && '-'}`;
};

const formatFloorInfo = (layout, building, floorLevel) => {
  const floorCount =
    layout.floorCount < 2
      ? ''
      : `${t('INVENTORY_FLOOR_COUNT', {
          count: layout.floorCount,
          plural: 's',
        })}`;
  const floorLevelInfo =
    !floorLevel || (floorLevel < 2 && building.floorCount < 2)
      ? ''
      : t('INVENTORY_FLOOR_COUNT', {
          count: `${floorLevel}/${building.floorCount}`,
        });
  return floorCount || floorLevelInfo ? `${floorCount} ${floorLevelInfo}` : '';
};

export const formatFloorLayout = ({ layout, building, floor: floorLevel }) =>
  [
    layout.displayName,
    formatNumBedrooms(layout.numBedrooms),
    t('QUOTE_DRAFT_NUM_BATHS', { count: layout.numBathrooms }),
    t('QUOTE_DRAFT_AREA', { count: layout.surfaceArea }),
    formatFloorInfo(layout, building, floorLevel),
  ]
    .filter(value => value)
    .join(', ');

const formatStateAndPostalAddress = (state, postalCode) => (state && postalCode ? `${state} - ${postalCode}` : state || postalCode);

export const formatAddress = inventory =>
  [
    `${capitalize(inventory.type)} ${inventory.name}`,
    `${inventory.address.addressLine1} ${inventory.address.addressLine2}`,
    `${inventory.address.city}`,
    formatStateAndPostalAddress(inventory.address.state, inventory.address.postalCode),
  ]
    .filter(Boolean)
    .join(', ');

const isQuotedInventoryEqualsToUnit = (quote, unit) => quote.inventory.id === unit.id;
const isQuotedUnit = ({ quotes, unit }) => quotes && quotes.some(quote => isQuotedInventoryEqualsToUnit(quote, unit));
const isHeldUnit = ({ unit }) => unit && unit.isInventoryOnHold;
const isThereAnyAppointmentForThatUnit = ({ appointments, unit }) =>
  appointments && appointments.some(appointment => appointment.metadata.inventories.some(inv => inv.id === unit.id));
const isFavoritedUnit = ({ favoritedUnits, unit }) => favoritedUnits && favoritedUnits.some(u => u === unit.id);

/* Each key of this object represents a type of tag and its translation.
   The value is the validation function to execute in order to determinate if the tag applies or not
*/
const tagsValidationMap = {
  QUOTED: isQuotedUnit,
  ON_HOLD: isHeldUnit,
  TOURED: isThereAnyAppointmentForThatUnit,
  FAVORITED: isFavoritedUnit,
};

const getAdditionalTagList = (unit, quotes, appointments, favoritedUnits) =>
  Object.keys(tagsValidationMap).reduce((additionalTags, tag) => {
    const validate = tagsValidationMap[tag];

    if (validate({ unit, quotes, appointments, favoritedUnits })) additionalTags.push(t(tag));
    return additionalTags;
  }, []);

export const enhanceAdditionalTag = (units, appointments, quotes, favoritedUnits) =>
  units.map(unit => ({
    ...unit,
    additionalTag: getAdditionalTagList(unit, quotes, appointments, favoritedUnits),
  }));

export const updateInventoryHolds = (currentInventoryHolds, inventoryOnHold, hold) => {
  const holdExists = currentInventoryHolds.some(ih => ih.id === inventoryOnHold.id);
  if (!holdExists) return [...currentInventoryHolds, inventoryOnHold];

  return currentInventoryHolds.reduce((result, inventoryHold) => {
    if (inventoryHold.id !== inventoryOnHold.id) return [...result, inventoryHold];
    return hold ? [...result, inventoryOnHold] : result;
  }, []);
};

export const INVENTORY_STEPPER_COLLAPSED_INDEX = -1;
export const INITIAL_INVENTORY_STEPPER_COLLAPSED_INDEX = 2;
export const INVENTORY_STEPPER_SELECT_PROPERTY_STEP = 0;
export const INVENTORY_STEPPER_SELECT_AMENITIES_STEP = 1;

export {
  getAmenitiesAvailablePerUnit,
  getShortFormatRentableItem,
  getUnitInformation,
  getQuoteLayoutSummary,
  getLayoutSummary,
  getHighValueAmenityNames,
  AMENITIES_MAX_LENGTH,
  getPolicyStatement,
  getPartialQualifiedName,
};
