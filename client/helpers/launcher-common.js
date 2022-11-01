/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'mobx-react';

import './checks/flexbox';
import './focus-fix';

import cfg from './cfg';

import '../../rentapp/client/sass/global.scss';

import { initTrans } from '../../common/helpers/i18n-client';
import { overrideClick } from '../modules/click-override';
import { screen } from '../../common/client/screen';

overrideClick();

export const renderContent = async (Component, { target, getStores }) => {
  const i18nOptions = cfg('i18nOptions');

  const providerProps = {
    ...(getStores ? getStores() : {}),
    screen,
  };

  initTrans(i18nOptions, () => {
    render(<Provider {...providerProps}>{<Component />}</Provider>, target);
  });
};
