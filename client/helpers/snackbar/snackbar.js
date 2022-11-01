/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// snackbar
import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { Snackbar } from 'components';
import $ from 'jquery';
import typeOf from 'helpers/type-of';

let $mountPoint;
const getMountPoint = () => {
  if ($mountPoint === undefined) {
    $mountPoint = $('<div id="snackbar" />').appendTo('body');
  }
  return $mountPoint;
};

const messageQueue = {
  get currentDescriptor() {
    const $mp = getMountPoint();
    return $mp.find('[data-component="snackbar"]')[0];
  },
  pendingQueue: [],

  renderMessage(descriptor) {
    const $mp = getMountPoint();

    if (!descriptor) {
      unmountComponentAtNode($mp[0]);
      return;
    }

    const handleHide = () => {
      descriptor.onHide && descriptor.onHide();
      this.shift();
    };

    render(
      <Snackbar
        key={descriptor.id}
        text={descriptor.text}
        duration={descriptor.duration}
        buttonLabel={descriptor.buttonLabel}
        onButtonClick={descriptor.onButtonClick}
        sticky={descriptor.sticky}
        onHide={handleHide}
      />,
      $mp[0],
    );
  },

  push(descriptor) {
    if (!this.currentDescriptor) {
      this.renderMessage(descriptor);
    } else {
      this.pendingQueue.push(descriptor);
    }
  },

  shift() {
    const descriptor = this.pendingQueue.shift();
    this.renderMessage(descriptor);
  },
};

let counter = 0;

const snackbar = {
  show(text, buttonLabel, duration, onButtonClick) {
    let sticky;
    let onHide;
    if (typeOf(text) === 'object') {
      duration = text.duration;
      buttonLabel = text.buttonLabel;
      onButtonClick = text.onButtonClick;
      onHide = text.onHide;
      sticky = text.sticky;
      text = text.text; // override the text with the property text
    }

    messageQueue.push({
      id: counter++,
      text,
      buttonLabel,
      duration,
      onButtonClick,
      sticky,
      onHide,
    });
  },
};

export { snackbar as default };
