/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { create } from 'helpers/animator';
import $ from 'jquery';
import { cf } from './snackbar.scss';

import Button from '../Button/Button';
import { Text } from '../Typography/Typography';
import Truncate from '../Truncate/Truncate';
import AutoSize from '../AutoSize/AutoSize';

const animator = create();
export default class Snackbar extends Component {
  static propTypes = {
    text: PropTypes.string,
    buttonLabel: PropTypes.string,
    duration: PropTypes.number,
    sticky: PropTypes.bool,
    onHide: PropTypes.func,
    onButtonClick: PropTypes.func,
  };

  static defaultProps = {
    duration: 5000,
    sticky: false,
  };

  calculateButtonWidth() {
    const { buttonLabel } = this.props;

    if (!buttonLabel) return;

    const $snackbar = $(this.refs.snackbar);
    const $buttonLabel = $snackbar.find('button > span');
    const PADDING = 48; // jquery set the width in px when a unitless value is provided

    let width = $buttonLabel.width() + PADDING;

    if (width < 48) {
      width = 48;
    }

    const $buttonContainer = $snackbar.find(`.${cf('button')}`);
    const $snackbarWrapper = $snackbar.find(`.${cf('snackbar-wrapper')}`);

    $buttonContainer.css('width', width);
    $snackbarWrapper.css('padding-right', width);
  }

  show() {
    animator.show(this.refs.snackbar);
    setTimeout(() => this.calculateButtonWidth(), 30);
  }

  hide = async () => {
    const { onHide, sticky } = this.props;
    if (!sticky) clearTimeout(this.timer);

    await animator.hide(this.refs.snackbar);
    onHide && onHide();
  };

  handleButtonClick = () => {
    const { onButtonClick } = this.props;
    onButtonClick && onButtonClick();
    this.hide();
  };

  componentDidMount() {
    const { duration, sticky } = this.props;

    this.show();
    if (sticky) return;

    this.timer = setTimeout(() => this.hide(), duration);
  }

  render() {
    const { text, buttonLabel } = this.props;

    return (
      <div data-component="snackbar" ref="snackbar" className={cf('snackbar')}>
        <AutoSize className={cf('snackbar-content')}>
          {({ breakpoint }) => {
            const direction = breakpoint === 'small' ? 'vertical' : 'horizontal';
            return (
              <div
                className={cf('snackbar-wrapper', {
                  small: breakpoint === 'small',
                  'no-button': !buttonLabel,
                })}>
                <div className={cf('text')}>
                  <Truncate className={cf('truncate')} iconStyle="light" maxHeight={80} collapsible={true} direction={direction}>
                    <Text lighter data-id="snackbarText">
                      {text}
                    </Text>
                  </Truncate>
                </div>
                {buttonLabel && (
                  <div className={cf('button')}>
                    <Button type="flat" btnRole="secondary" onClick={this.handleButtonClick} label={buttonLabel} className={cf('snackbar-button')} />
                  </div>
                )}
              </div>
            );
          }}
        </AutoSize>
      </div>
    );
  }
}
