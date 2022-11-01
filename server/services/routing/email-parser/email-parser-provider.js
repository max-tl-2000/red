/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { AdoboParser } from './adapters/adobo-parser';
import { ApartmentsParser } from './adapters/aparments-parser';
import { ApartmentGuideParser } from './adapters/apartment-guide-parser';
import { ApartmentSearchParser } from './adapters/apartment-search-parser';
import { ContactUsParser } from './adapters/contact-us-parser';
import { CozyParser } from './adapters/cozy-parser';
import { ForRentParser } from './adapters/for-rent-parser';
import { FoundationHomesParser } from './adapters/foundation-homes-parser';
import { RentBitsParser } from './adapters/rent-bits-parser';
import { RentParser } from './adapters/rent-parser';
import { RespageParser } from './adapters/respage-parser';
import { Room8Parser } from './adapters/room8-parser';
import { YelpParser } from './adapters/yelp-parser';
import { ZapiermailParser } from './adapters/zapiermail-parser';
import { ZendeskParser } from './adapters/zendesk-parser';
import { ZillowParser } from './adapters/zillow-parser';
import { ZumperParser } from './adapters/zumper-parser';
import { ClxMedia } from './adapters/clx-media';

const emailParserProviders = [
  ['abodoapts.com', AdoboParser],
  ['apartments.com', ApartmentsParser],
  ['apartmentguide.com', ApartmentGuideParser],
  ['apartmentsearch.com', ApartmentSearchParser],
  ['contactus', ContactUsParser],
  ['cozy', CozyParser],
  ['forrent.com', ForRentParser],
  ['foundationhomes', FoundationHomesParser],
  ['rentbits.io', RentBitsParser],
  ['rent.com', RentParser],
  ['respage', RespageParser],
  ['room8.io', Room8Parser],
  ['yelp', YelpParser],
  ['zapiermail', ZapiermailParser],
  ['zendesk.com', ZendeskParser],
  ['zillow', ZillowParser],
  ['zumper.com', ZumperParser],
  ['clxmedia.com', ClxMedia],
];

const createEmailParserProvider = (name, EmailParserProvider, validateFunc) => {
  if (!EmailParserProvider) return undefined;
  const emailParserProvider = new EmailParserProvider(name);
  return validateFunc && validateFunc(emailParserProvider) ? emailParserProvider : undefined;
};

const getIlsProvider = (messageData, validateFunc) => {
  for (const [providerName, emailParserHandler] of emailParserProviders) {
    const emailParserProvider = createEmailParserProvider(providerName, emailParserHandler, validateFunc);
    if (emailParserProvider) return emailParserProvider;
  }
  return undefined;
};

export const getEmailParserProvider = messageData => getIlsProvider(messageData, provider => provider.shouldProcessEmailBody(messageData));

export const isInboundEmailOnIlsDomains = messageData => !!getIlsProvider(messageData, provider => provider.belongsToIlsDomain(messageData));
