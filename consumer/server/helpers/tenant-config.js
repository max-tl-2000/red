/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { request } from '../../../common/helpers/httpUtils';
import config from '../../config';

export const getTenantAndPropertyIds = async path => {
  const pathSplit = path.split('/');
  const possibleTenantName = pathSplit[1] ? pathSplit[1] : '';
  const possiblePropertyName = pathSplit[2] ? pathSplit[2] : '';

  return request(`https://${possibleTenantName}.${config.domain}/api/getTenantAndPropertyIds`, {
    query: { tenant: possibleTenantName, propertyName: possiblePropertyName },
  });
};
