/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const CommunicationContext = {
  PREFER_SMS: 'PREFER_SMS',
  PREFER_EMAIL: 'PREFER_EMAIL',
  PREFER_EMAIL_AND_SMS: 'PREFER_EMAIL_AND_SMS',
  REQUIRE_SMS: 'REQUIRE_SMS',
  REQUIRE_EMAIL: 'REQUIRE_EMAIL',
  REQUIRE_EMAIL_AND_SMS: 'REQUIRE_EMAIL_AND_SMS',
  REQUIRE_EMAIL_OR_SMS: 'REQUIRE_EMAIL_OR_SMS',
  NO_PREFERENCE: 'NO_PREFERENCE',
};

export const CommunicationContextError = {
  CONTACT_INFO_UNAVAILABLE: 'CONTACT_INFO_UNAVAILABLE',
  REQUIRED_PHONE_NUMBER_UNAVAILABLE: 'REQUIRED_PHONE_NUMBER_UNAVAILABLE',
  REQUIRED_EMAIL_UNAVAILABLE: 'REQUIRED_EMAIL_UNAVAILABLE',
  RENDER_TEMPLATE_FAILED: 'RENDER_TEMPLATE_FAILED',
};
