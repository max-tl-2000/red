/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import $ from 'jquery';
import Snackbar from '../components/Snackbar/Snackbar';
import mediator from './mediator';

export const notifyVersion = ({ onRefresh, ...options } = {}) => {
  const $dom = $('<div />').appendTo('body');

  const cleanUp = () => {
    unmountComponentAtNode($dom[0]);
    $dom.remove();
  };

  const handleButtonClick = () => {
    cleanUp();
    onRefresh && onRefresh();
  };

  const doRender = () => {
    render(<Snackbar {...options} sticky onButtonClick={handleButtonClick} />, $dom[0]);
  };

  doRender();
};

export const emitServerStarted = ({ version }) => mediator.fire('red-server:start', { version });
