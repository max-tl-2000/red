/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// DB constants length
const NAME_LENGTH = 200;
const ADDRESS_LENGTH = 256;
const PHONE_LENGTH = 20;
const EMAIL_LENGTH = 80;
const STATE_LENGTH = 2;
const CITY_LENGTH = 128;
const POSTAL_CODE_LENGTH = 10;
const GEOFENCE_LENGTH = 256;
const ABBREVIATION_LENGTH = 20;
const TYPE_LENGTH = 80;
const PERIOD_LENGTH = 20;
const ECONOMIC_STATUS_LENGTH = 80;
const EXPERTISE_LENGTH = 200;
const APN_LENGTH = 40;
const MSA_NAME_LENGTH = 60;
const WEB_SITE_LENGTH = 2048;
const NOTE_LENGTH = 512;
const DESCRIPTION = 500;
const INFOGRAPHIC_NAME_LENGTH = 200;
const EXTERNAL_ID_LENGTH = 255;
const TEXT_2KB = 2048;
const PLACES_LENGTH = 180;

const DBColumnLength = {
  Name: NAME_LENGTH,
  Address: ADDRESS_LENGTH,
  Phone: PHONE_LENGTH,
  Email: EMAIL_LENGTH,
  State: STATE_LENGTH,
  City: CITY_LENGTH,
  PostalCode: POSTAL_CODE_LENGTH,
  Geofence: GEOFENCE_LENGTH,
  Abbreviation: ABBREVIATION_LENGTH,
  Type: TYPE_LENGTH,
  Period: PERIOD_LENGTH,
  EconomicStatus: ECONOMIC_STATUS_LENGTH,
  Expertise: EXPERTISE_LENGTH,
  APN: APN_LENGTH,
  MSAName: MSA_NAME_LENGTH,
  WebSite: WEB_SITE_LENGTH,
  Note: NOTE_LENGTH,
  Description: DESCRIPTION,
  InfographicName: INFOGRAPHIC_NAME_LENGTH,
  ExternalId: EXTERNAL_ID_LENGTH,
  Text2KB: TEXT_2KB,
  Places: PLACES_LENGTH,
};

module.exports = DBColumnLength;
