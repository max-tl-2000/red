/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getProperties } from '../../../../server/dal/propertyRepo';
import { TARGET_ACCOUNT_PLURAL_TYPE } from '../../../common/enums/target-account-types';

export { getTargetAccountsForProperty } from '../../../../server/services/properties';

export const getAllTargetAccounts = async ctx => {
  const properties = await getProperties(ctx);
  const accountsGroupedByType = properties.reduce((acc, prop) => {
    const { aptexx = {} } = prop.paymentProvider || {};
    const { accountIds = {} } = aptexx;
    Object.keys(accountIds || {}).forEach(targetType => {
      const objectKey = TARGET_ACCOUNT_PLURAL_TYPE[targetType];
      if (accountIds[targetType] && !acc[objectKey]?.includes(accountIds[targetType])) {
        acc[objectKey] = [...(acc[objectKey] || []), accountIds[targetType]];
      }
    });

    return acc;
  }, {});

  return accountsGroupedByType;
};
