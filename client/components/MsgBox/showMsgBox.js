/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import {
  render, // eslint-disable-line
  unmountComponentAtNode,
} from 'react-dom';
import $ from 'jquery';
import { observable, autorun, action } from 'mobx';
import MsgBox from './MsgBox';

class MsgBoxModel {
  @observable
  open = true;

  @action
  close = () => {
    this.open = false;
  };
}

export const showMsgBox = (content, { onClose, onCloseRequest, ...options } = {}) => {
  const $dom = $('<div />').appendTo('body');
  let state = new MsgBoxModel();

  const cleanUp = () => {
    state = null;
    unmountComponentAtNode($dom[0]);
    $dom.remove();
    onClose && onClose();
  };

  const closer = () => state && state.close();

  const doRender = () => {
    render(
      <MsgBox {...options} open={state.open} onCloseRequest={onCloseRequest || state.close} onClose={cleanUp}>
        <div>{content}</div>
      </MsgBox>,
      $dom[0],
    );
  };

  autorun(() => {
    doRender();
  });

  return closer;
};
