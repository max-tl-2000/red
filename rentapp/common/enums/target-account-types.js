/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const TARGET_ACCOUNT_TYPE = {
  HOLD_ACCOUNT: 'holdAccount',
  APPLICATION_ACCOUNT: 'applicationAccount',
  RENT_ACCOUNT: 'rentAccount',
};

export const TARGET_ACCOUNT_NAME = {
  [TARGET_ACCOUNT_TYPE.HOLD_ACCOUNT]: 'hold',
  [TARGET_ACCOUNT_TYPE.APPLICATION_ACCOUNT]: 'application',
  [TARGET_ACCOUNT_TYPE.RENT_ACCOUNT]: 'rent',
};

export const TARGET_ACCOUNT_PLURAL_TYPE = {
  [TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.HOLD_ACCOUNT]]: 'holdAccounts',
  [TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.APPLICATION_ACCOUNT]]: 'applicationAccounts',
  [TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.RENT_ACCOUNT]]: 'rentAccounts',
};
