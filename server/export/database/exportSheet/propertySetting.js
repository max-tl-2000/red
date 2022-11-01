/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertySettingsToExport } from '../../../dal/propertyRepo';
import { getPrograms } from '../../../dal/programsRepo';
import { buildDataPumpFormat } from '../../helpers/export';

const buildPropertySettings = (properties, programs) =>
  properties.map(property => {
    const settings = property.settings;
    return {
      property: property.name,
      'quote\nexpirationPeriod': (settings.quote || {}).expirationPeriod,
      'quote\nrenewalLetterExpirationPeriod': (settings.quote || {}).renewalLetterExpirationPeriod,
      'quote\npolicyStatement': (settings.quote || {}).policyStatement,
      'quote\nprorationStrategy': (settings.quote || {}).prorationStrategy,
      'inventory\nhideStateFlag': (settings.inventory || {}).hideStateFlag,
      'lease\nallowRentableItemSelection': (settings.lease || {}).allowRentableItemSelection,
      'lease\nallowPartyRepresentativeSelection': (settings.lease || {}).allowPartyRepresentativeSelection,
      'lease\nresidentSignatureTypes': (settings.lease || {}).residentSignatureTypes,
      'lease\nguarantorSignatureTypes': (settings.lease || {}).guarantorSignatureTypes,
      'lease\nusername': (settings.lease || {}).username,
      'lease\npassword': (settings.lease || {}).password,
      'lease\npropertyName': (settings.lease || {}).propertyName,
      'screening\npropertyName': (settings.screening || {}).propertyName,
      'screening\nincomePolicyRoommates': (settings.screening || {}).incomePolicyRoommates,
      'screening\nincomePolicyGuarantors': (settings.screening || {}).incomePolicyGuarantors,
      'payment\npropertyName': (settings.payment || {}).propertyName,
      'application\nurlPropPolicy': (settings.application || {}).urlPropPolicy,
      'calendar\nteamSlotDuration': (settings.calendar || {}).teamSlotDuration,
      'appointment\nenableSelfServiceEdit': (settings.appointment || {}).enableSelfServiceEdit,
      'appointment\neditUrl': (settings.appointment || {}).editUrl,
      'appointment\ntourTypesAvailable': (settings.appointment || {}).updatedTemplateWithEditLink,
      'marketing\ncity': (settings.marketing || {}).city,
      'marketing\ncityAliases': (settings.marketing || {}).cityAliases,
      'marketing\nstate': (settings.marketing || {}).state,
      'marketing\nstateAliases': (settings.marketing || {}).stateAliases,
      'marketing\nregion': (settings.marketing || {}).region,
      'marketing\nregionAliases': (settings.marketing || {}).regionAliases,
      'marketing\nneighborhood': (settings.marketing || {}).neighborhood,
      'marketing\nneighborhoodAliases': (settings.marketing || {}).neighborhoodAliases,
      'marketing\ntestimonials': (settings.marketing || {}).testimonials,
      'marketing\ntags': (settings.marketing || {}).tags,
      'marketing\npropertyAmenities': (settings.marketing || {}).propertyAmenities,
      'marketing\nlayoutAmenities': (settings.marketing || {}).layoutAmenities,
      'marketing\nselfServeDefaultLeaseLengthsForUnits': (settings.marketing || {}).selfServeDefaultLeaseLengthsForUnits,
      'marketing\nselfServeAllowExpandLeaseLengthsForUnits': (settings.marketing || {}).selfServeAllowExpandLeaseLengthsForUnits,
      'marketing\nselfServeMaxLeaseStartDate': (settings.marketing || {}).selfServeMaxLeaseStartDate,
      'marketing\nincludedInListings': (settings.marketing || {}).includedInListings,
      'marketing\nmaxVacantReadyUnits': (settings.marketing || {}).maxVacantReadyUnits,
      'marketing\nmaxUnitsInLayout': (settings.marketing || {}).maxUnitsInLayout,
      'marketing\nmapZoomLevel': (settings.marketing || {}).mapZoomLevel,
      'marketing\nenableScheduleTour': (settings.marketing || {}).enableScheduleTour,
      'marketing\nmapPlaces': (settings.marketing || {}).mapPlaces,
      'marketing\nfacebookURL': (settings.marketing || {}).facebookURL,
      'marketing\ninstagramURL': (settings.marketing || {}).instagramURL,
      'marketing\ngoogleReviewsURL': (settings.marketing || {}).googleReviewsURL,
      'marketing\nofficeHours': (settings.marketing || {}).officeHours,
      'marketing\nenableHeroListingHighlight': (settings.marketing || {}).enableHeroListingHighlight,
      'comms\ndefaultPropertyProgram': programs.find(p => p.id === settings?.comms?.defaultPropertyProgram)?.name,
      'comms\ndefaultOutgoingProgram': programs.find(p => p.id === settings?.comms?.defaultOutgoingProgram)?.name,
      'comms\ndaysToRouteToALPostMoveout': (settings.comms || {}).daysToRouteToALPostMoveout,
      'renewals\nrenewalCycleStart': (settings.renewals || {}).renewalCycleStart,
      'renewals\nskipOriginalGuarantors': (settings.renewals || {}).skipOriginalGuarantors,
      'marketingLocation\naddressLine1': (settings.marketing || {}).marketingLocationAddressLine1,
      'marketingLocation\naddressLine2': (settings.marketing || {}).marketingLocationAddressLine2,
      'marketingLocation\ncity': (settings.marketing || {}).marketingLocationCity,
      'marketingLocation\nstate': (settings.marketing || {}).marketingLocationState,
      'marketingLocation\npostalCode': (settings.marketing || {}).marketingLocationPostalCode,
      'marketing\n3DAssets': (settings.marketing || {})['3DAssets'],
      'marketing\nvideoAssets': (settings.marketing || {}).videoAssets,
    };
  });

export const exportPropertySettings = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const properties = await getPropertySettingsToExport(ctx, propertyIdsToExport);
  const programs = await getPrograms(ctx);
  const propertySettings = buildPropertySettings(properties, programs);

  return buildDataPumpFormat(propertySettings, columnHeadersOrdered);
};
