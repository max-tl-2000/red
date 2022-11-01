/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';

import '../client/helpers/position';
import './helpers/font-loader.scss';
import '../client/helpers/checks/flexbox';
import '../client/helpers/checks/use-gemini-fix';
import '../client/helpers/window-resize';
import '../client/helpers/focus-fix';

import '../client/sass/red.scss';

import i18next from 'i18next';

window.i18next = i18next;

i18next.t = i18next.t.bind(i18next);
i18next.init({});

const res = require.context('./stories/', false, /\.js/);
res.keys().forEach(moduleName => {
  require( `./${ path.join( 'stories/', moduleName ) }` ); // eslint-disable-line
});
