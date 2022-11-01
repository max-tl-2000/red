/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { request } from '../../common/helpers/httpUtils';
import config from '../config';

export const getTenantConfig = async host => {
  const possibleTenantName = host.split('.')[0];

  // in prod the load balancer check if the app is alive by hitting `/`
  // the problem is that it doesn't use a domain that contain a valid tenant
  // it just checks the ip:port/ which makes the app to fail at detecting the
  // tenant name.
  //
  // Since the response to the check is not 200 the loadbalancer believes the app
  // is not up and refuse to forward the requests.
  //
  // The following fix will just return an empty object if the `possibleTenantName`
  // is just numbers
  if (possibleTenantName.match(/^\d+$/) || possibleTenantName === 'health') {
    return {};
  }

  return request(`http://${config.apiHost}:${config.apiPort}/api/config`, {
    query: { tenant: possibleTenantName },
  });
};
