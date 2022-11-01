/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { autoLogin } from 'redux/modules/auth';
import { replace } from 'helpers/navigator';
import { t } from 'i18next';
import debounce from 'debouncy';

import { ErrorMessage, Status } from 'components';

import DefaultAppBar from 'custom-components/AppBar/DefaultAppBar';
import { cf, g } from './SignIn.scss';
@connect(
  state => ({
    user: state.auth.user,
    loginError: state.auth.loginError,
    loggingIn: state.auth.loggingIn,
    blockedAccount: state.auth.blockedAccount,
  }),
  dispatch =>
    bindActionCreators(
      {
        autoLogin,
      },
      dispatch,
    ),
)
export default class AutoLogin extends Component {
  constructor(props) {
    super(props);
    this.handleLogin = debounce(this.handleLogin, 210, this);
    this.handleLogin();
  }

  async handleLogin() {
    const { onSignIn } = this.props;

    try {
      await this.props.autoLogin(this.props.location.query.autoLogin);
      replace('/');
      onSignIn && onSignIn();
    } catch (err) {
      err.__handled = true;
    }
  }

  render() {
    const { blockedAccount, loggingIn } = this.props;

    let { loginError } = this.props;

    if (blockedAccount) {
      loginError = t('ACCOUNT_BLOCKED');
    }

    return (
      <div className="view-element sign-in-view">
        <div className={cf('bg-signin')} style={{ backgroundImage: 'url(/empire-state-building.jpg)' }} />
        <DefaultAppBar />
        <div className={cf(g('view-content'), 'login-wrapper')}>
          <div className={cf('title')} id="waitForSignin">
            {t('PLEASE_WAIT_FOR_SIGNIN')}
          </div>
        </div>
        <Status processing={loggingIn} />
        <div className={cf('actions')}>
          <ErrorMessage errorMessage={t(loginError)} dataTestId="signInError" />
        </div>
      </div>
    );
  }
}
