/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import i18n from '../../common/server/i18n';

let i18nMiddleware = null;

export const getTranslationsMiddleware = ({ config, logger } = {}) => async (req, res, next) => {
  if (!i18nMiddleware) {
    i18nMiddleware = await i18n.getMiddleware({
      debug: config.i18nDebug,
      logger,
      namespaceDir: path.resolve(__dirname, '../../trans/en/'),
      loadPath: path.resolve(__dirname, '../../trans/{{lng}}/{{ns}}.yml'),
    });
  }

  i18nMiddleware(req, res, next);
};
