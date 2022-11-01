/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';

import CardMenu from 'components/CardMenu/CardMenu';
import CardMenuItem from 'components/CardMenu/CardMenuItem';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { logout } from 'helpers/auth-helper';
import { observer, inject } from 'mobx-react';

@connect(
  state => ({
    user: state.auth.user,
  }),
  dispatch => bindActionCreators({}, dispatch),
)
@inject('leasingNavigator')
@observer
export default class NavigationLinks extends Component {
  goToHelp = () => this.props.leasingNavigator.navigateToNeedHelp();

  handleLogout = () => {
    logout();
  };

  render() {
    const { user, children } = this.props;
    let userItems = [];

    if (user) {
      userItems = userItems.concat([<CardMenuItem key="logout" text={t('LOGOUT_LINK')} onClick={this.handleLogout} />]);
    }

    return (
      <CardMenu id="navigation-links" iconName="dots-vertical" iconStyle="light">
        {children}
        <CardMenuItem text={t('NEED_HELP_LINK')} onClick={this.goToHelp} />
        {userItems}
      </CardMenu>
    );
  }
}
