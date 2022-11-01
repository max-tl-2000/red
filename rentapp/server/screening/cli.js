/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minimist from 'minimist';
import { success, error, warn, subtle } from 'clix-logger/logger';
import { getTenantByName, updateTenant } from '../../../server/dal/tenantsRepo';
import { admin } from '../../../server/common/schemaConstants';
import { closePool } from '../../../server/database/factory';
import { updateProperty, getPropertyByName } from '../../../server/dal/propertyRepo';

const devSettings = {
  dev: {
    screening: {
      password: 'Winter2016',
      username: 'RedisruptOne',
      originatorId: 100025,
    },
    propertyId: {
      swparkme: 132660,
      cove: 132665,
      lark: 132666,
      harris: 132667,
    },
  },
  dev1: {
    screening: {
      password: 'Winter2016',
      username: 'RedisruptThree',
      originatorId: 100026,
    },
    propertyId: {
      swparkme: 132664,
      cove: 132665,
      lark: 132666,
      harris: 132667,
    },
  },
  dev2: {
    screening: {
      password: 'Winter2016',
      username: 'RedisruptOne',
      originatorId: 100025,
    },
    propertyId: {
      swparkme: 132660,
      cove: 132661,
      lark: 132662,
      harris: 132663,
    },
  },
  dev3: {
    screening: {
      password: 'Winter2016',
      username: 'Redisruptfive',
      originatorId: 100028,
    },
    propertyId: {
      swparkme: 132668,
      cove: 132669,
      lark: 132670,
      harris: 132671,
    },
  },
  dev4: {
    screening: {
      password: 'Winter2016',
      username: 'RedisruptSeven',
      originatorId: 100029,
    },
    propertyId: {
      swparkme: 132672,
      cove: 132673,
      lark: 132674,
      harris: 132675,
    },
  },
  prod: {
    screening: {
      password: process.env.FADV_PROD_PASSWORD,
      username: 'Maximus',
      originatorId: 100016,
    },
    propertyId: {
      // swparkme: 148546, // really serenity's property id
      lark: 148546,
      cove: 148543,
    },
  },
};

const updateTenantSettings = async ({ id, settings }, endPoint) => {
  const context = { tenantId: admin.id };
  const newSettings = {
    ...settings,
    ...devSettings[endPoint],
  };

  await updateTenant(context, id, { settings: newSettings });
  success('screening settings in Tenant updated');
};

const updatePropertySettings = async (tenantId, endPoint) => {
  const properties = devSettings[endPoint].propertyId;
  if (!properties) {
    error(`Unable to find property ${endPoint}`);
    return;
  }
  const propertyNames = Object.keys(properties);
  for (let i = 0; i < propertyNames.length; i++) {
    const propertyName = propertyNames[i];
    const { id, settings } = (await getPropertyByName({ tenantId }, propertyName)) || {};
    if (id) {
      const updatedSettings = settings || {};
      updatedSettings.screening = updatedSettings.screening || {};
      updatedSettings.screening.propertyName = properties[propertyName];

      await updateProperty({ tenantId }, { id }, { settings: updatedSettings });
    } else {
      warn(`Unable to find property ${propertyName}`);
    }
  }
  success('screening settings in Properties updated');
};

const main = async () => {
  const argv = minimist(process.argv.slice(2));
  const { tenantName, endPoint } = argv;
  subtle('Input parameters', { tenantName, endPoint });

  if (!tenantName || !endPoint) {
    error('Usage: set-fadv-dev.sh [tenantName] [endPoint]');
    return;
  }
  if (!devSettings[endPoint]) {
    error('Invalid endpoint');
    return;
  }

  const tenant = await getTenantByName({ tenantId: 'admin' }, tenantName);

  if (!tenant) {
    error('Invalid tenant');
    return;
  }

  await updateTenantSettings(tenant, endPoint);
  await updatePropertySettings(tenant.id, endPoint);
};

if (require.main === module) {
  main()
    .then(closePool)
    .catch(e => {
      error(e.message);
      error(e.stack);
      closePool();
    });
}
