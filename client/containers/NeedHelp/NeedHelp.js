/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { sendResetPasswordMail, resetState } from 'redux/modules/needHelp';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { logout } from 'redux/modules/auth';
import { observer, inject } from 'mobx-react';
import { TextBox, Button, ExpandableCard, CardActions, FormattedMarkdown } from 'components';

import DefaultAppBar from 'custom-components/AppBar/DefaultAppBar';
import { cf, g } from './NeedHelp.scss';
@connect(
  state => ({
    resetPasswordError: state.needHelp.resetPasswordError,
    resetPasswordSuccess: state.needHelp.resetPasswordSuccess,
  }),
  dispatch =>
    bindActionCreators(
      {
        sendResetPasswordMail,
        resetState,
        logout,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class NeedHelp extends Component {
  static propTypes = {
    resetPasswordError: PropTypes.string,
    resetPasswordSuccess: PropTypes.bool,
    sendResetPasswordMail: PropTypes.func,
    resetState: PropTypes.func,
    logout: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      isForgotPasswordExpanded: true,
      isMissingActivationEmailExpanded: false,
      isMissingInvitationEmailExpanded: false,
      emailInitialValue: props.params.email || '',
    };
  }

  componentDidMount = () => this.refs.txtEmail && this.refs.txtEmail.focus();

  componentWillUnmount = () => this.props.resetState();

  submitResetPassword = () => {
    const email = this.refs.txtEmail.getValue();
    this.setState({ isForgotPasswordExpanded: true });
    this.props.sendResetPasswordMail(email);
    this.props.logout();
  };

  cancelResetPassword = () =>
    this.setState({
      emailInitialValue: '',
      isForgotPasswordExpanded: false,
    });

  returnToLogin = () => this.props.leasingNavigator.navigateToHome();

  getCardContent = (resetPasswordError, resetPasswordSuccess, emailInitialValue) => {
    if (resetPasswordSuccess) {
      return (
        <div data-content-card-label="reset-password-success" className={cf('success')}>
          <FormattedMarkdown>{t('RESET_PASSWORD_SUCCESS_MESSAGE_MARKDOWN')}</FormattedMarkdown>
        </div>
      );
    }
    return (
      <div className={cf('card-content')}>
        <p data-content-card-label="forgot-password" className={cf('description')}>
          {' '}
          {t('FORGOT_PASSWORD_DESCRIPTION')}{' '}
        </p>

        <TextBox
          id="forgotPasswordTxtEmail"
          ref="txtEmail"
          type="email"
          forceLowerCase
          value={emailInitialValue}
          autoFocus={true}
          label={t('EMAIL')}
          errorMessage={resetPasswordError ? t(resetPasswordError) : ''}
        />
      </div>
    );
  };

  render = () => {
    const { resetPasswordError, resetPasswordSuccess } = this.props;
    const { isForgotPasswordExpanded, isMissingInvitationEmailExpanded, emailInitialValue } = this.state;

    return (
      <div className="view-element need-help">
        <DefaultAppBar />
        <div className={cf(g('view-content'), 'need-help-wrapper')}>
          <h4 className="display1">{t('NEED_HELP_HEADER')}</h4>
          <div className={cf('cards')}>
            <ExpandableCard
              className={cf('card')}
              title={t(resetPasswordSuccess ? 'EMAIL_SENT' : 'FORGOT_PASSWORD_TITLE')}
              expanded={isForgotPasswordExpanded}
              cucumberExpandableCardId="forget-password">
              {this.getCardContent(resetPasswordError, resetPasswordSuccess, emailInitialValue)}
              <CardActions textAlign="right" position={'relative'}>
                {!resetPasswordSuccess && (
                  <Button type="flat" btnRole="secondary" onClick={this.cancelResetPassword} data-button-label="Cancel" label={t('CANCEL')} />
                )}
                <Button
                  type="flat"
                  data-button-label={t(resetPasswordSuccess ? 'Done' : 'Continue')}
                  onClick={resetPasswordSuccess ? this.returnToLogin : this.submitResetPassword}
                  label={t(resetPasswordSuccess ? 'DONE' : 'CONTINUE')}
                />
              </CardActions>
            </ExpandableCard>
            <ExpandableCard className={cf('card')} title={t('MISSING_ACTIVATION_EMAIL_TITLE')} expanded={isMissingInvitationEmailExpanded} />
            <ExpandableCard className={cf('card')} title={t('MISSING_INVITATION_TITLE')} expanded={isMissingInvitationEmailExpanded} />
          </div>
        </div>
      </div>
    );
  };
}
