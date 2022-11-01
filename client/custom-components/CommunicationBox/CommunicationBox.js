/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { IconButton, FlyOut, FlyOutOverlay, AutoSize } from 'components';
import injectProps from 'helpers/injectProps';
import { cf, g } from './CommunicationBox.scss';

export default class CommunicationBox extends Component {
  static propTypes = {
    className: PropTypes.string,
    onCall: PropTypes.func,
    onMessage: PropTypes.func,
    onMail: PropTypes.func,
    iconsStyle: PropTypes.string,
  };

  @injectProps
  renderLoose(props) {
    const boxStyle = cf({ commBox: !props.noAutoSize }, g(props.commBoxClassName));
    return (
      <div className={boxStyle}>
        <IconButton iconName="phone" className="commButton" disabled={props.callDisabled} iconStyle={props.iconsStyle} onClick={props.onCall} />
        <IconButton iconName="message-text" className="commButton" disabled={props.messageDisabled} iconStyle={props.iconsStyle} onClick={props.onMessage} />
        <IconButton iconName="email" className="commButton" disabled={props.mailDisabled} iconStyle={props.iconsStyle} onClick={props.onMail} />
      </div>
    );
  }

  @injectProps
  renderCompact(props) {
    return (
      <div className={cf({ commBox: !props.noAutoSize }, g(props.commBoxClassName))}>
        <IconButton iconName="phone" className="commButton" disabled={props.callDisabled} iconStyle={props.iconsStyle} onClick={props.onCall} />
        <FlyOut expandTo="bottom" overTrigger>
          <IconButton className={cf('affordance')} iconStyle={props.iconsStyle} iconName="menu-down" />
          <FlyOutOverlay container={false} contentClassName={cf('dropdown')}>
            <IconButton iconName="message-text" className="commButton" disabled={props.messageDisabled} onClick={props.onMessage} />
            <IconButton iconName="email" className="commButton" disabled={props.mailDisabled} onClick={props.onMail} />
          </FlyOutOverlay>
        </FlyOut>
      </div>
    );
  }

  @injectProps
  render({ className, noAutoSize, compact }) {
    if (noAutoSize) {
      if (compact) {
        return this.renderCompact();
      }
      return this.renderLoose();
    }

    const theClasses = cf('wrapper', g(className));
    return (
      <AutoSize breakpoints={false} className={theClasses}>
        {({ width }) => (width < 200 ? this.renderCompact() : this.renderLoose())}
      </AutoSize>
    );
  }
}
