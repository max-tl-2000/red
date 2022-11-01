/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Typography, AppBar, IconButton } from 'components';
import { requestRCAuthUrl, requestRCToken, refreshRCToken, renewRCSubscription } from 'redux/modules/tenantsStore';
import { observer, inject } from 'mobx-react';
import { cf } from './RingCentralTokenRefreshPage.scss';
const { SubHeader } = Typography;

@connect(
  state => ({
    authUser: state.auth.user,
  }),
  dispatch =>
    bindActionCreators(
      {
        requestRCAuthUrl,
        requestRCToken,
        refreshRCToken,
        renewRCSubscription,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class RingCentralTokenRefreshPage extends Component {
  constructor() {
    super();
    this.state = {
      message: '',
    };
  }

  static propTypes = {
    authUser: PropTypes.object,
    requestRCAuthUrl: PropTypes.func,
    requestRCToken: PropTypes.func,
    refreshRCToken: PropTypes.func,
  };

  componentDidMount() {
    const { location, authUser } = this.props;
    const code = location.query && location.query.code;
    if (!code) return;
    this.props.requestRCToken({ tenantId: authUser.tenantId, code }).then(({ error }) => {
      const hasError = !!error;
      this.setState({
        message: hasError ? 'Unable to retrieve token' : 'Login successful',
        token: !hasError,
      });
    });
  }

  refreshRCToken = async () => {
    const { error } = await this.props.refreshRCToken({
      tenantId: this.props.authUser.tenantId,
    });
    this.setState({
      message: error ? 'Unable to refresh token' : 'Token refresh successful',
    });
  };

  renewRCSubscription = async () => {
    const { error } = await this.props.renewRCSubscription({
      tenantId: this.props.authUser.tenantId,
    });
    this.setState({
      message: error ? 'Unable to renew subscription. Try re-sign in or refresh token' : 'Webhook subscription renew successful',
    });
  };

  getRCAuthUrl = async () => {
    const { tenantId } = this.props.authUser;
    const { data: url } = await this.props.requestRCAuthUrl({ tenantId });
    window.location.replace(url);
  };

  render() {
    const hasToken = this.props.authUser.hasRCToken || this.state.token;
    return (
      <div>
        <AppBar
          title="Ring Central"
          icon={<IconButton iconStyle="light" iconName="home" onClick={() => this.props.leasingNavigator.navigateToDashboard()} />}
        />
        <div className={cf('container')}>
          <Button type="raised" className={cf('action-button')} btnRole="primary" label="Sign In" onClick={this.getRCAuthUrl} />

          <Button
            type="raised"
            className={cf('action-button')}
            btnRole="primary"
            label="Refresh existing token"
            disabled={!hasToken}
            onClick={this.refreshRCToken}
          />

          <Button
            type="raised"
            className={cf('action-button')}
            btnRole="primary"
            label="Renew subscription"
            disabled={!hasToken}
            onClick={this.renewRCSubscription}
          />
        </div>
        <div className={cf('container')}>
          <SubHeader> {this.state.message} </SubHeader>
        </div>
      </div>
    );
  }
}
