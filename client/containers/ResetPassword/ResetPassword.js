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
import { t } from 'i18next';
import { validateResetToken } from 'redux/modules/tokens';
import { resetUserPassword } from 'redux/modules/auth';
import { Card, TextBox, Button, Field, Form, ErrorMessage, Typography } from 'components';
import DefaultAppBar from 'custom-components/AppBar/DefaultAppBar';
import { observer, inject } from 'mobx-react';
import { cf } from './ResetPassword.scss';
import Status from '../../components/Status/Status';
import TokenExpiredError from './TokenExpiredError';

const { SubHeader } = Typography;

@connect(
  state => ({
    userData: state.tokens.userData,
    validateTokenError: state.tokens.validateTokenError,
    user: state.auth.user,
    error: state.auth.resetPasswordError,
    loading: state.auth.resetPasswordInProgress,
  }),
  dispatch =>
    bindActionCreators(
      {
        resetUserPassword,
        validateResetToken,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ResetPassword extends Component {
  static propTypes = {
    params: PropTypes.object,
    userData: PropTypes.object,
    user: PropTypes.object,
    error: PropTypes.string,
    resetUserPassword: PropTypes.func,
    validateResetToken: PropTypes.func,
    validateTokenError: PropTypes.string,
    logout: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      password: '',
      errorMessage: '',
    };
  }

  componentWillMount() {
    this.props.validateResetToken(this.props.params.resetToken);
  }

  handlePasswordChange = args =>
    this.setState({
      password: args.value,
    });

  isRegisterMode = () => {
    const { query } = this.props.location;
    return query.mode === 'register';
  };

  handleSubmit = async event => {
    event.preventDefault();
    const password = this.state.password;
    if (password === '') {
      this.setState({ errorMessage: 'PASSWORD_REQUIRED' });
      return;
    }
    const email = this.props.userData.email;
    const token = this.props.params.resetToken;

    await this.props.resetUserPassword(email, password, token, this.isRegisterMode());

    this.props.leasingNavigator.navigateToDashboard();
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.error) {
      this.setState({ errorMessage: nextProps.error });
    }
  }

  render() {
    const { userData, validateTokenError, loading } = this.props;
    const errorMessage = this.state.errorMessage;

    return (
      <div>
        <DefaultAppBar />
        {!validateTokenError && userData && (
          <div className={cf('page')}>
            <Card className={cf('card')}>
              <Status processing={loading} />
              <Form className={cf('form')}>
                <div>
                  <Field fullWidth>
                    <SubHeader>{this.isRegisterMode() ? t('REGISTER_A_PASSWORD') : t('RESET_PASSWORD_TITLE')}</SubHeader>
                  </Field>
                  <Field fullWidth>
                    <TextBox
                      label={t('PASSWORD')}
                      placeholder={t('REGISTER_A_PASSWORD')}
                      wide
                      required
                      requiredMark={''}
                      type="password"
                      id="txtPassword"
                      disabled={loading}
                      onEnterPress={this.handleSubmit}
                      errorMessage={errorMessage ? t(errorMessage) : ''}
                      onChange={this.handlePasswordChange}
                    />
                  </Field>
                  <Field fullWidth noMargin>
                    <ErrorMessage message={errorMessage ? t(errorMessage) : ''} />
                    <div className={cf('form-actions')}>
                      <Button
                        disabled={loading}
                        id="btnSignIn"
                        label={this.isRegisterMode() ? t('REGISTER') : t('RESET_PASSWORD')}
                        btnRole="primary"
                        onClick={this.handleSubmit}
                      />
                    </div>
                  </Field>
                </div>
              </Form>
            </Card>
          </div>
        )}
        {validateTokenError && <TokenExpiredError email={(userData || {}).email} />}
      </div>
    );
  }
}
