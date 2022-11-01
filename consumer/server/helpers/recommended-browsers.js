/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { join } from 'path';
import { withCachedPromise } from '../../../common/helpers/with-cached-promise';
import { read } from '../../../common/helpers/xfs';
import { HTML_REPLACE_MATCHER } from '../../../common/regex';

const readHTML = withCachedPromise(async () => await read(join(__dirname, './resources/recommended-browsers.html')));

export const renderRecommendedBrowsersPage = async args => {
  const text = await readHTML();

  const getValueFromArgs = token => {
    const val = args[token];
    if (!val) return `MISSING_TOKEN_${token}`;
    return val;
  };

  return text.replace(HTML_REPLACE_MATCHER, (_, token) => getValueFromArgs(token));
};
