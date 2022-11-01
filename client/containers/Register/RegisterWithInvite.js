/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as authActions from 'redux/modules/auth';
import { t } from 'i18next';
import { TextBox, Button, Card, Field, Form } from 'components';
import { observer, inject } from 'mobx-react';

import DefaultAppBar from 'custom-components/AppBar/DefaultAppBar';
import { cf } from './RegisterWithInvite.scss';

import cfg from '../../helpers/cfg';
import { formatTenantEmailDomain } from '../../../common/helpers/utils';

@connect(
  state => ({
    user: state.auth.user,
    registrationError: state.auth.registrationError,
    validToken: state.auth.validToken,
    validateTokenError: state.auth.validateTokenError,
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
export default class RegisterWithInvite extends Component {
  static propTypes = {
    params: PropTypes.object,
    user: PropTypes.object,
    validToken: PropTypes.object,
    logout: PropTypes.func,
    registerWithInvite: PropTypes.func,
    registrationError: PropTypes.string,
    validateToken: PropTypes.func,
    validateTokenError: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      fullName: '',
      preferredName: '',
      password: '',
      fullNameErrorText: '',
      preferredNameErrorText: '',
      passwordErrorText: '',
    };
  }

  componentWillMount() {
    if (this.props.user) {
      this.props.logout();
    }

    this.props.validateToken(this.props.params.inviteToken);
  }

  doRegister() {
    const { fullName, preferredName, password } = this.state;
    let isMissingRequired = false;
    if (fullName === '') {
      this.setState({
        fullNameErrorText: 'FULL_NAME_REQUIRED',
      });
      isMissingRequired = true;
    }
    if (preferredName === '') {
      this.setState({
        preferredNameErrorText: 'PREFERRED_NAME_REQUIRED',
      });
      isMissingRequired = true;
    }
    if (password === '') {
      this.setState({
        passwordErrorText: 'PASSWORD_REQUIRED',
      });
      isMissingRequired = true;
    }

    if (!isMissingRequired) {
      this.props.registerWithInvite(this.props.params.inviteToken, fullName, preferredName, password);
    }
  }

  handleSubmit = () => {
    // for performance reasons
    // textboxes fire change after 50ms
    // so we need to be sure we have the values in the state
    // so we can perform the registration
    setTimeout(() => {
      this.doRegister();
    }, 100);
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.user) {
      this.props.leasingNavigator.navigateToDashboard();
      return;
    }
  }

  handleFullNameChange = event =>
    this.setState({
      fullName: event.value,
      fullNameErrorText: '',
    });

  handlePreferredNameChange = event =>
    this.setState({
      preferredName: event.value,
      preferredNameErrorText: '',
    });

  handlePasswordChange = event =>
    this.setState({
      password: event.value,
      passwordErrorText: '',
    });

  render() {
    const { user, validToken, logout, registrationError, validateTokenError } = this.props;
    const { fullNameErrorText, preferredNameErrorText, passwordErrorText } = this.state;
    let directEmail = '';

    if (validToken) {
      const domain = formatTenantEmailDomain(validToken.inviteData.tenantName, cfg('emailDomain'));
      directEmail = `${validToken.inviteData.directEmailIdentifier}@${domain}`;
    }

    const containerStyles = user || !validToken ? { background: 'white', zIndex: 1 } : {};

    return (
      <div className="view-element register-view">
        <div className={cf('bg')} style={{ backgroundImage: 'url(/empire-state-building.jpg)' }} />
        <DefaultAppBar />
        <div style={containerStyles}>
          {!user && (
            <div>
              {validToken && (
                <div id="register-form">
                  <Card container={false} className={cf('card')}>
                    <div
                      className={cf('card-img')}
                      style={{
                        backgroundImage: 'url(/empire-state-building.jpg)',
                      }}>
                      <div className={cf('title')}>{t('REGISTER')}</div>
                    </div>
                    <Form className={cf('form')}>
                      <Field>
                        <TextBox
                          id="txtFullName"
                          type="text"
                          wide
                          label={t('FULL_NAME')}
                          onChange={this.handleFullNameChange}
                          errorMessage={fullNameErrorText ? t(fullNameErrorText) : ''}
                        />
                      </Field>
                      <Field>
                        <TextBox
                          id="txtPreferredName"
                          type="text"
                          wide
                          label={t('PREFERRED_NAME')}
                          onChange={this.handlePreferredNameChange}
                          errorMessage={preferredNameErrorText ? t(preferredNameErrorText) : ''}
                        />
                      </Field>
                      <Field>
                        <TextBox
                          id="txtPassword"
                          type="password"
                          wide
                          label={t('PASSWORD')}
                          onChange={this.handlePasswordChange}
                          errorMessage={passwordErrorText ? t(passwordErrorText) : ''}
                        />
                      </Field>
                      <Field>
                        <TextBox id="txtCrmEmail" type="text" wide label={t('DIRECT_EMAIL_ADDRESS')} value={directEmail} disabled={true} />
                      </Field>
                      <Field>
                        <Button type="raised" className={cf('blockButton')} id="btnRegister" onClick={this.handleSubmit} name="action" label={t('REGISTER')} />
                      </Field>
                      {registrationError && <p>{t(registrationError)}</p>}
                    </Form>
                  </Card>
                </div>
              )}
              {!validToken && (
                <div>
                  <p id="tokenErrorMessage">{t(validateTokenError)}</p>
                </div>
              )}
            </div>
          )}
          {user && (
            <div>
              <p>
                {t('LOGIN_NOTIFICATION')}
                {user.fullName}.
              </p>
              <div>
                <button id="btnLogOut" type="button" className="btn btn-danger" onClick={logout}>
                  <i className="fa fa-sign-out" /> {t('LOGOUT')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}
