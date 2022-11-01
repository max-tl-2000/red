/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import Icon from '../Icon/Icon';
import { cf } from './badgeCount.scss';

import { Text } from '../Typography/Typography';

export default class BadgeCount extends Component {
  static propTypes = {
    displayedCount: PropTypes.number,
  };

  render() {
    const { displayedCount } = this.props;

    return (
      <div>
        <Icon name={'recording'} className={cf('icon', { 'icon-red': displayedCount })} />
        <Text className={cf('count', { 'count-light': displayedCount })}>{displayedCount}</Text>
      </div>
    );
  }
}
