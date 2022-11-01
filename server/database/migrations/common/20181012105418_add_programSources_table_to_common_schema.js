/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { prepareRawQuery } from '../../../common/schemaConstants';
import { DALTypes } from '../../../../common/enums/DALTypes';

exports.up = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
  INSERT INTO db_namespace."ProgramSources" ("name", "type") VALUES
      ('agent',	'${DALTypes.SourceType.AGENT}'),
      ('businessCard-agent',	'${DALTypes.SourceType.AGENT}'),
      ('transfer-agent',	'${DALTypes.SourceType.AGENT}'),
      ('email-direct', '${DALTypes.SourceType.DIRECT_MARKETING}'),
      ('phone-direct', '${DALTypes.SourceType.DIRECT_MARKETING}'),
      ('postalMail-direct', '${DALTypes.SourceType.DIRECT_MARKETING}'),
      ('sms-direct', '${DALTypes.SourceType.DIRECT_MARKETING}'),
      ('social-direct',	'${DALTypes.SourceType.DIRECT_MARKETING}'),
      ('display', '${DALTypes.SourceType.DISPLAY_ADVERTISING}'),
      ('event', '${DALTypes.SourceType.EVENT}'),
      ('abodo-ils',	'${DALTypes.SourceType.ILS}'),
      ('apartmentList-ils',	'${DALTypes.SourceType.ILS}'),
      ('apartmentRatings-ils', '${DALTypes.SourceType.ILS}'),
      ('apartmentSearch-ils',	'${DALTypes.SourceType.ILS}'),
      ('apartmentShowcase-ils',	'${DALTypes.SourceType.ILS}'),
      ('aptLivingGuide-ils',	'${DALTypes.SourceType.ILS}'),
      ('costar-ils',	'${DALTypes.SourceType.ILS}'),
      ('craigslist-ils', '${DALTypes.SourceType.ILS}'),
      ('facebookMarketplace-ils', '${DALTypes.SourceType.ILS}'),
      ('forRent-ils',	'${DALTypes.SourceType.ILS}'),
      ('ils',	'${DALTypes.SourceType.ILS}'),
      ('move-ils', '${DALTypes.SourceType.ILS}'),
      ('myNewPlace-ils', '${DALTypes.SourceType.ILS}'),
      ('padFinders-ils',	'${DALTypes.SourceType.ILS}'),
      ('radPad-ils',	'${DALTypes.SourceType.ILS}'),
      ('rentBits-ils', '${DALTypes.SourceType.ILS}'),
      ('rentCafe-ils',	'${DALTypes.SourceType.ILS}'),
      ('rentHello-ils',	'${DALTypes.SourceType.ILS}'),
      ('rentHop-ils',	'${DALTypes.SourceType.ILS}'),
      ('rentJungle-ils',	'${DALTypes.SourceType.ILS}'),
      ('rentLinx-ils',	'${DALTypes.SourceType.ILS}'),
      ('rentPath-ils',	'${DALTypes.SourceType.ILS}'),
      ('yelp-ils',	'${DALTypes.SourceType.ILS}'),
      ('zillow-ils',	'${DALTypes.SourceType.ILS}'),
      ('zumper-ils',	'${DALTypes.SourceType.ILS}'),
      ('website-partner',	'${DALTypes.SourceType.PARTNER}'),
      ('website-partnerPaid',	'${DALTypes.SourceType.PARTNER}'),
      ('pr',	'${DALTypes.SourceType.PR}'),
      ('propertyPhone',	'${DALTypes.SourceType.PROPERTY_PHONE}'),
      ('broker-referral',	'${DALTypes.SourceType.REFERRAL}'),
      ('referral',	'${DALTypes.SourceType.REFERRAL}'),
      ('bing-search',	'${DALTypes.SourceType.SEARCH_ORGANIC}'),
      ('google-search',	'${DALTypes.SourceType.SEARCH_ORGANIC}'),
      ('search',	'${DALTypes.SourceType.SEARCH_ORGANIC}'),
      ('yahoo-search',	'${DALTypes.SourceType.SEARCH_ORGANIC}'),
      ('bing-searchPaid',	'${DALTypes.SourceType.SEARCH_PAID}'),
      ('google-searchPaid',	'${DALTypes.SourceType.SEARCH_PAID}'),
      ('yahoo-searchPaid',	'${DALTypes.SourceType.SEARCH_PAID}'),
      ('facebook-social',	'${DALTypes.SourceType.SOCIAL_ORGANIC}'),
      ('instagram-social',	'${DALTypes.SourceType.SOCIAL_ORGANIC}'),
      ('pinterest-social',	'${DALTypes.SourceType.SOCIAL_ORGANIC}'),
      ('twitter-social',	'${DALTypes.SourceType.SOCIAL_ORGANIC}'),
      ('youtube-social',	'${DALTypes.SourceType.SOCIAL_ORGANIC}'),
      ('facebook-socialPaid',	'${DALTypes.SourceType.SOCIAL_PAID}'),
      ('instagram-socialPaid',	'${DALTypes.SourceType.SOCIAL_PAID}'),
      ('pinterest-socialPaid',	'${DALTypes.SourceType.SOCIAL_PAID}'),
      ('twitter-socialPaid',	'${DALTypes.SourceType.SOCIAL_PAID}'),
      ('youtube-socialPaid',	'${DALTypes.SourceType.SOCIAL_PAID}'),
      ('outdoor-traditional',	'${DALTypes.SourceType.TRADITIONAL_ADVERTISING}'),
      ('print-traditional',	'${DALTypes.SourceType.TRADITIONAL_ADVERTISING}'),
      ('radio-traditional',	'${DALTypes.SourceType.TRADITIONAL_ADVERTISING}'),
      ('tv-traditional',	'${DALTypes.SourceType.TRADITIONAL_ADVERTISING}'),
      ('website-property',	'${DALTypes.SourceType.WEBSITE}'),
      ('goSection8-ils',	'${DALTypes.SourceType.ILS}'),
      ('socialPaid', '${DALTypes.SourceType.SOCIAL_PAID}'),
      ('social', '${DALTypes.SourceType.SOCIAL_ORGANIC}'),
      ('searchPaid',	'${DALTypes.SourceType.SEARCH_PAID}'),
      ('residentServices',	'${DALTypes.SourceType.RESIDENT_SERVICES}'),
      ('chat',	'${DALTypes.SourceType.SOCIAL_ORGANIC}'),
      ('chat-partner',	'${DALTypes.SourceType.SOCIAL_ORGANIC}');
   `,
      tenantId,
    ),
  );
};

exports.down = async () => {};
