/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mime from 'mime-types';
import { error, log } from 'clix-logger/logger';
import { mapSeries } from 'bluebird';
import { getTenantByName } from '../../services/tenantService';
import { updateMetadata } from './s3';
import { getAssetsBucket, getKeyPrefixForAssets } from './uploadUtil';
import { getPhysicalAssets } from '../../dal/assetsRepo';

const logErrors = failures => {
  if (!failures.length) return;

  error('List of errors updating content type:');
  failures.map((failure, idx) =>
    error(`${idx + 1}. ${failure.error.message}`, {
      position: failure.position,
      fileName: failure.fileName,
      key: failure.key,
    }),
  );
};

const main = async () => {
  const tenantName = process.argv[2];
  const { id: tenantId } = (await getTenantByName(tenantName)) || {};
  if (!tenantId) {
    throw Error('Invalid tenant name');
  }

  const keyPrefix = getKeyPrefixForAssets(tenantId);

  const s3Bucket = getAssetsBucket();
  const physicalAssets = await getPhysicalAssets({ tenantId });

  const failures = [];
  await mapSeries(physicalAssets, async ({ id, fileName }, idx, arrayLength) => {
    const key = `${keyPrefix}/${id}`;
    const contentType = mime.contentType(fileName);
    log(`Updating ${idx + 1} from ${arrayLength}`);
    await updateMetadata({ tenantId }, s3Bucket, key, { contentType, acl: 'public-read' }).catch(err => {
      error('An error ocurred while updating asset', { fileName, key, err });
      failures.push({ key, fileName, position: idx + 1, error: err });
    });
  });
  logErrors(failures);
};

if (require.main === module) {
  main()
    // eslint-disable-next-line no-process-exit
    .then(() => process.exit(0))
    .catch(e => {
      error('An error ocurred while updating assets content type', e);
			process.exit(1); // eslint-disable-line
    });
}
