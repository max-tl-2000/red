/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import { HeadlineOneButton, HeadlineTwoButton } from 'draft-js-buttons';
import { cf } from './HeadlinesButton.scss';

class HeadlinesPicker extends Component {
  componentDidMount() {
    setTimeout(() => {
      window.addEventListener('click', this.onWindowClick);
    });
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onWindowClick);
  }

  onWindowClick = () => this.props.onOverrideContent(undefined);

  render() {
    const buttons = [
      ['headline-one', HeadlineOneButton],
      ['headline-two', HeadlineTwoButton],
    ];
    return (
      <div>
        {buttons.map(([id, Button]) => (
          <Button key={`headline-button-${id}`} {...this.props} />
        ))}
      </div>
    );
  }
}

export default class HeadlinesButton extends Component {
  onMouseDown = event => event.preventDefault();

  onClick = e => {
    e.preventDefault();
    this.props.onOverrideContent(HeadlinesPicker);
  };

  render() {
    return (
      <div onMouseDown={this.onMouseDown} className={cf('headlineButtonWrapper')}>
        <button type="button" onClick={this.onClick} className={cf('headlineButton')}>
          H
        </button>
      </div>
    );
  }
}
