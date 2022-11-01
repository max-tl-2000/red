/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import urlParser from 'url';
import config from '../config';
import loggerModule from '../../common/helpers/logger';
import { ServiceError } from '../common/errors';
import { getURLShortenerBucket } from '../workers/upload/uploadUtil';
import { headObject, saveEmptyObject } from '../workers/upload/s3';
import { removeToken } from '../../common/helpers/strings';

const { urlShortener } = config;
const logger = loggerModule.child({ subType: 'urlShortener' });

// For shortener S3 bucket architecture go to:
// https://aws.amazon.com/blogs/compute/build-a-serverless-private-url-shortener
// The architecture varies slightly to the article as the lambda function
// is handled directly by the app. (CPM-3831)
const s3Bucket = getURLShortenerBucket();
const OBJECT_NOT_FOUND = 'NotFound';
const TEXT_CONTENT_TYPE = 'text/plain';

const getShortIdFunction = () =>
  'xxxxxxx'.replace(/x/g, () =>
    // eslint-disable-next-line no-bitwise
    ((Math.random() * 36) | 0).toString(36),
  );

let getShortId = getShortIdFunction;
export const setGetShortId = func => (getShortId = func);

const createObjectKey = async () => {
  let key;
  let create = false;
  let attempts = 4;

  do {
    try {
      key = getShortId();
      await headObject(s3Bucket, key);
    } catch (error) {
      if (error.code === OBJECT_NOT_FOUND) {
        create = true;
      } else {
        logger.error({ error }, 'createObjectKey error');
      }
    }
  } while (!create && --attempts > 0);

  return { create, key };
};

export const sendUrltoShortener = async (ctx, urls) => {
  if (process.env.NODE_ENV === 'integration') {
    return urls.map(urlToShorten => {
      const parsedUrl = urlParser.parse(urlToShorten);
      if (!parsedUrl || !parsedUrl.hostname) {
        throw new ServiceError(`Shortener error: Could not create shortener object for url: ${urlToShorten}`);
      }
      return `https://${urlShortener.cdn_prefix}/${getShortId()}`;
    });
  }

  return await Promise.all(
    urls.map(async url => {
      const shortenerData = {
        url_long: url,
        cdn_prefix: urlShortener.cdn_prefix,
      };

      logger.info({ ctx }, `About to put shortened url for ${removeToken(url)}`);

      const result = await createObjectKey();
      const key = result.key;
      if (result.create) {
        try {
          await saveEmptyObject(ctx, s3Bucket, key, {
            redirectLocation: shortenerData.url_long,
            contentType: TEXT_CONTENT_TYPE,
          });
        } catch (error) {
          logger.error({ ctx, error, urls }, 'Shortener error putting S3 object');
          throw new ServiceError(error.message);
        }
      } else {
        logger.error({ ctx }, 'Shortener error: Could not create shortener object');
        throw new ServiceError('Shortener error: Could not create shortener object');
      }

      return `https://${shortenerData.cdn_prefix}/${key}`;
    }),
  );
};
