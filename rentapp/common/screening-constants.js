/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const FADV_RESPONSE_STATUS = {
  COMPLETE: 'Complete',
  INCOMPLETE: 'Incomplete',
  ERROR: 'Error',
  INCOMPLETE_INCORRECT_MEMBERS: 'Incomplete incorrect members',
};

export const FADV_ERROR_DESCRIPTION = {
  WRONG_ADDRESS: 'Unable to parse address node.',
};

export const APPLICATION_EXPIRATION_DAYS = 30;

export const PARSE_ERROR = 'PARSE_ERROR';

export const PARTY_CREDIT_REPORT_EXPIRED_BANNER = `<div style=" padding: 5px; background-color: #f44336; color: white;">
<strong>The content of this report expired on {expiredDate}</strong>
</div>`;
