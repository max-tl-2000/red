/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import path from 'path';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { saveFile, deleteObjects } from '../upload/s3';
import { getPrivateBucket, getDocumentsKeyPrefix, getEncryptionKeyId } from '../upload/uploadUtil';
import { testCtx } from '../../testUtils/repoHelper';

describe('S3 requests', () => {
  let key;
  const bucket = getPrivateBucket();
  const keyPrefix = getDocumentsKeyPrefix(tenant.id);

  beforeEach(() => {
    const id = newId();
    key = `${keyPrefix}/${id}`;
  });

  afterEach(async () => {
    const result = await deleteObjects(testCtx, bucket, [key]);
    expect(result).to.be.ok;
    expect(result.errors).to.be.empty;
  });

  describe('when a file is uploaded', () => {
    describe('and the metadata contains invalid characters', () => {
      it('should succeed', async () => {
        const options = {
          encryptionType: 'aws:kms',
          keyId: getEncryptionKeyId(),
          metadata: {
            uploadingUser: {
              fullName: 'Steve',
              someInvalidData: '•\tKate',
            },
            otherInvalidData: '•\tKate',
          },
        };

        const result = await saveFile(testCtx, bucket, key, path.resolve(__dirname, 'test-asset'), options);

        expect(result).to.be.ok;
        expect(result.ETag).to.not.be.empty;
      });
    });
  });
});
