/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';

import AppBar from 'components/AppBar/AppBar';
import AppBarActions from 'components/AppBar/AppBarActions';
import IconButton from 'components/IconButton/IconButton';

import { t } from 'i18next';
import { inject, observer } from 'mobx-react';
import NavigationLinks from '../NavigationLinks/NavigationLinks';

@inject('leasingNavigator')
@observer
export default class DefaultAppBar extends Component {
  static defaultProps = {
    title: 'APP_NAME',
    unit: '',
  };

  static propTypes = {
    title: PropTypes.string,
    unit: PropTypes.string,
  };

  navigateToDashboard = () => {
    const { props } = this;
    props.leasingNavigator.navigateToDashboard();
  };

  render({ title, unit } = this.props) {
    const shownTitle = unit ? t(title, { unitShortHand: unit }) : t(title);
    return (
      <AppBar title={shownTitle} icon={<IconButton iconStyle="light" iconName="home" onClick={this.navigateToDashboard} />}>
        <AppBarActions>
          <NavigationLinks />
        </AppBarActions>
      </AppBar>
    );
  }
}
