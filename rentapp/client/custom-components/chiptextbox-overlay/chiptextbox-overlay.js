/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography as T, TextBox, ChipTextBox, FlyOut, FlyOutOverlay, FlyOutActions, Button } from 'components';

import { findDOMNode } from 'react-dom';
import $ from 'jquery';
import { t } from 'i18next';
import { cf } from './chiptextbox-overlay.scss';

export class ChipTextBoxOverlay extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      isOverlayOpen: false,
    };
  }

  static propTypes = {
    placeholder: PropTypes.string,
    label: PropTypes.string,
    maxNumItems: PropTypes.number,
  };

  static defaultProps = {
    value: [],
  };

  handleOpen = () =>
    this.setState({
      isOverlayOpen: true,
    });

  handleClose = () =>
    this.setState({
      isOverlayOpen: false,
    });

  handleChange = ({ value }) => {
    this.props.value = value;
  };

  get $trigger() {
    if (!this._trigger) {
      this._trigger = $(findDOMNode(this)).find('[data-ref-trigger="true"]');
    }
    return this._trigger;
  }

  handlePosition = args => {
    args.autoPosition = false;
    args.$overlay.css('position', 'fixed');
    args.$overlay.position({
      my: 'left bottom',
      at: 'left bottom+85',
      of: this.$trigger,
    });
  };

  get itemsToString() {
    const { value, placeholder } = this.props;
    let text =
      value && value.length > 0
        ? value.reduce((seq, item) => {
            seq += `, ${item.text}`;
            return seq;
          }, '')
        : placeholder;
    text = text.length > 0 ? text.substring(2, text.length) : text;
    return text;
  }

  render() {
    const { placeholder, label, value, maxNumItems } = this.props;
    const itemsString = this.itemsToString;
    const trigger =
      value.length > 0 ? (
        <TextBox value={itemsString} onClick={this.handleOpen} />
      ) : (
        <Button type="flat" className={cf('trigger-button')} label={placeholder} onClick={this.handleOpen} />
      );

    return (
      <div data-component="chiptextbox-overlay">
        <T.Text secondary data-ref-trigger>
          {label}
        </T.Text>
        {trigger}
        <FlyOut open={this.state.isOverlayOpen} onPosition={this.handlePosition} onOpen={this.handleOpen} onClose={this.handleClose}>
          <FlyOutOverlay container={false} className={cf('overlay')}>
            <div className={cf('overlay-wrapper')}>
              <ChipTextBox onChange={this.props.onChange} value={value} validator={this.props.validator} maxNumItems={maxNumItems} />
            </div>
            <FlyOutActions>
              <Button type="flat" label={t('CANCEL')} btnRole="secondary" data-action="close" />
              <Button type="flat" label={t('DONE')} data-action="close" />
            </FlyOutActions>
          </FlyOutOverlay>
        </FlyOut>
      </div>
    );
  }
}
