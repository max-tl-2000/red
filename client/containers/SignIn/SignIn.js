/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as authActions from 'redux/modules/auth';
import { t } from 'i18next';
import trim from 'helpers/trim';
import { createModel } from 'helpers/Form/FormModel';
import { observer, inject } from 'mobx-react';
import debounce from 'debouncy';

import { TextBox, ErrorMessage, Button, Tooltip, Status, Form } from 'components';

import DefaultAppBar from 'custom-components/AppBar/DefaultAppBar';
import { isEmailValid } from '../../../common/helpers/validations/email';
import { cf, g } from './SignIn.scss';
import { VALIDATION_TYPES } from '../../helpers/Form/Validation';
import { USER_AUTHORIZATION_ERROR_TOKENS } from '../../../common/enums/error-tokens';
import { location } from '../../../common/helpers/globals';
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
        ...authActions,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class SignIn extends Component {
  constructor(props) {
    super(props);

    const model = (this.model = createModel(
      {
        email: '', // initial value for email
        password: '', // initial value for password
      },
      {
        email: {
          interactive: false,
          errorMessage: t('EMAIL_VALIDATION_MESSAGE'),
          fn: field => field.value === 'admin' || isEmailValid(trim(field.value)),
        },
        password: {
          interactive: false,
          errorMessage: t('PASSWORD_VALIDATION_MESSAGE'),
          validationType: VALIDATION_TYPES.REQUIRED,
        },
      },
    ));

    this.state = {
      model,
    };

    this.handleLogin = debounce(this.handleLogin, 210, this);
  }

  async handleLogin() {
    const { login, onSignIn } = this.props;

    if (this.props.blockedAccount) {
      this.handleHelp();
      return;
    }

    const { model } = this.state;
    await model.validate();

    if (model.valid) {
      const data = model.serializedData;
      try {
        await login(data.email, data.password);
        onSignIn && onSignIn();
      } catch (err) {
        err.__handled = true;
      }
    }
  }

  handleHelp = () => {
    const {
      model: { fields },
    } = this.state;
    const email = fields.email.value;
    this.props.leasingNavigator.navigateToNeedHelp({ email });
  };

  getSecondaryLoginError = loginError =>
    loginError === USER_AUTHORIZATION_ERROR_TOKENS.EMAIL_AND_PASSWORD_MISMATCH && location.hostname.toLowerCase().includes('customernew')
      ? t('CUSTOMERNEW_EMAIL_WARNING')
      : '';

  render() {
    const { blockedAccount, loggingIn } = this.props;
    const { model } = this.state;
    const { email, password } = model.fields;

    let { loginError } = this.props;

    let mainActionLabel = blockedAccount ? t('RESET_PASSWORD') : t('SIGN_IN');

    if (loggingIn) {
      mainActionLabel = t('LOGIN_PROCESSING');
    }

    if (blockedAccount) {
      loginError = t('ACCOUNT_BLOCKED');
    }

    const secondaryLoginError = this.getSecondaryLoginError(loginError);

    return (
      <div className="view-element sign-in-view">
        <div className={cf('bg-signin')} style={{ backgroundImage: 'url(/empire-state-building.jpg)' }} />
        <DefaultAppBar />
        <div className={cf(g('view-content'), 'login-wrapper')}>
          <div className={cf('card')}>
            <div className={cf('card-img')} style={{ backgroundImage: 'url(/empire-state-building.jpg)' }}>
              <div className={cf('title')} id="signInTitle">
                {t('SIGN_IN')}
              </div>
            </div>
            <Status processing={loggingIn} />
            <Form className={cf('form')}>
              <TextBox
                label={t('EMAIL')}
                type="email"
                id="txtEmail"
                forceLowerCase
                disabled={blockedAccount}
                className={cf('form-field')}
                autoComplete="username"
                value={email.value}
                errorMessage={email.errorMessage}
                onChange={({ value }) => email.setValue(value)}
              />
              <TextBox
                label={t('PASSWORD')}
                type="password"
                id="txtPassword"
                disabled={blockedAccount}
                className={cf('form-field')}
                autoComplete="current-password"
                value={password.value}
                onChange={({ value }) => password.setValue(value)}
                errorMessage={password.errorMessage}
                onEnterPress={this.handleLogin}
              />
              <div className={cf('actions')}>
                <ErrorMessage errorMessage={t(loginError)} dataTestId="signInError" />
                {secondaryLoginError && <ErrorMessage errorMessage={secondaryLoginError} dataTestId="secondarySignInError" />}
                <Button id="btnLogin" className={cf('btn-action')} label={mainActionLabel} disabled={loggingIn} onClick={this.handleLogin} />
              </div>
              <div className={cf('actions')}>
                <Tooltip text={t('NEED_HELP_TOOLTIP')}>
                  <Button id="btnHelp" type="flat" onClick={this.handleHelp} label={t('NEED_HELP')} />
                </Tooltip>
              </div>
            </Form>
          </div>
        </div>
      </div>
    );
  }
}
