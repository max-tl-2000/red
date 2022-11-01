/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minimist from 'minimist';
import { success, error, subtle } from 'clix-logger/logger';
import { getTenantByName } from '../../../server/dal/tenantsRepo';
import { admin } from '../../../server/common/schemaConstants';
import { closePool } from '../../../server/database/factory';
import { updateProperty, getPropertyByName } from '../../../server/dal/propertyRepo';
import { getAptexxSettings } from '../../../server/services/properties';
import { getAccounts } from './payment-provider-integration';
import { getAptexxMaintenanceTypes } from '../../../resident/server/services/maintenance';

const getTargetAccountByName = async ({ tenantId, tenantName }, accountName) => {
  subtle(`Fetching target accounts for tenant ${tenantName} account ${accountName}`);
  const associatedAccounts = await getAccounts({
    tenantId,
    tenantName,
  }).catch(err => {
    error({ err }, `Error fetching accounts for ${tenantId} and ${tenantName}`);
    return { accounts: [] };
  });
  subtle(`Got accounts ${JSON.stringify(associatedAccounts)}`);

  return associatedAccounts.accounts.find(
    account =>
      account.name === accountName &&
      // The account must also be active. This is because Aptexx seems to sometimes
      // mistakenly create inactive accounts with the same name...
      account.active,
  );
};

const updatePropertyPaymentProvider = async (ctx, propertyName, accountName) => {
  const [property, targetAccount] = await Promise.all([getPropertyByName(ctx, propertyName), getTargetAccountByName(ctx, accountName)]);

  if (!property) {
    error(`Invalid property ${propertyName}`);
    return;
  }
  if (!targetAccount) {
    error(`Invalid target account ${accountName}`);
    return;
  }
  const maintenanceTypes = await getAptexxMaintenanceTypes(ctx, { clientId: targetAccount.clientId, accountId: targetAccount.id });
  const aptexxSettings = getAptexxSettings({ ...targetAccount, maintenanceTypes });
  await updateProperty(ctx, { id: property.id }, { paymentProvider: { aptexx: aptexxSettings } });
  success(`Payment provider settings for '${property.name}' property was updated to ${JSON.stringify(aptexxSettings)}`);
};

const main = async () => {
  const argv = minimist(process.argv.slice(2));
  const { tenantName, propertyName, accountName } = argv;
  subtle('Input parameters', { tenantName, propertyName, accountName });

  if (!(tenantName && propertyName && accountName)) {
    error('Usage: set-aptexx-property-account.sh [accountName] [-t|--tenant tenantName] [-p|--property propertyName]');
    return;
  }

  const tenant = await getTenantByName({ tenantId: admin.id }, tenantName);
  if (!tenant) {
    error('Invalid tenant');
    return;
  }

  await updatePropertyPaymentProvider({ tenantId: tenant.id, tenantName: tenant.name }, propertyName, accountName);
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
