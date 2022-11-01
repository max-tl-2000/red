/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import i18next from 'i18next';

export const initTrans = (i18nOptions, renderCallback) => {
  window.i18next = i18next;
  i18next.t = i18next.t.bind(i18next);
  i18next.init(i18nOptions, renderCallback);

  if (process.env.NODE_ENV === 'development') {
    // this is a helper method to reload the translations
    // it is only exposed in development mode
    window.__reloadTrans = async () => {
      const { lng } = i18nOptions;
      const $ = require('jquery'); // eslint-disable-line
      // couldn't use the api-client instance, as that is different per each
      // project and this module was intended to be used to configure the i18next module
      // in the clients. $.ajax is the lower common denominator
      const newTrans = await Promise.resolve($.ajax({ url: `/trans/${lng}` }));
      i18next.store.data[lng].trans = newTrans;

      // we had a reference to the renderCallback
      // so we can used it to trigger the re render
      // of the components when we reload the translations
      renderCallback && renderCallback();
      console.log('>>> i18n reloaded!');
    };
  }
};
