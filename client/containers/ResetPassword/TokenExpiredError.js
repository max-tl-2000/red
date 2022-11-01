/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Icon, Button, Typography } from 'components';
import { sendResetPasswordMail } from 'redux/modules/needHelp';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { cf } from './ResetPassword.scss';

const { SubHeader, Headline } = Typography;

@connect(
  state => ({
    loggedInUser: state.auth.user,
    resetPasswordSuccess: state.needHelp.resetPasswordSuccess,
    resetPasswordError: state.needHelp.resetPasswordError,
  }),
  dispatch =>
    bindActionCreators(
      {
        sendResetPasswordMail,
      },
      dispatch,
    ),
)
export default class TokenExpiredError extends Component {
  static propTypes = {
    email: PropTypes.string,
    resetPasswordSuccess: PropTypes.bool,
    resetPasswordError: PropTypes.string,
  };

  handleNewInvite = () => {
    this.props.sendResetPasswordMail(this.props.email);
  };

  renderPage = ({ title, subtitle1, subtitle2, email }) => {
    const { resetPasswordSuccess } = this.props;
    return (
      <div className={cf('error-wrapper')}>
        <div className={cf('body')}>
          {resetPasswordSuccess ? <Icon name="check" style={{ width: 45, height: 45 }} /> : <div className={cf('image-broke-rope')} />}
          <Headline inline className={cf('title')}>
            {t(title)}
          </Headline>
          <div>
            <SubHeader disabled>{subtitle1}</SubHeader>
            {subtitle2 && <SubHeader disabled>{subtitle2}</SubHeader>}
          </div>
        </div>
        <div>{!resetPasswordSuccess && email && <Button label={t('NEW_INVITE')} btnRole="primary" onClick={this.handleNewInvite} />}</div>
      </div>
    );
  };

  render() {
    const { email, resetPasswordSuccess } = this.props;
    let data = { email };
    if (resetPasswordSuccess) {
      data = {
        ...data,
        title: t('ALL_SET'),
        subtitle1: t('NEW_INVITE_SENT', { email }),
      };
    } else {
      data = {
        ...data,
        title: t('LINK_EXPIRED_TITLE'),
        subtitle1: t('TOKEN_EXPIRED_BACK_ON_TRACK'),
        subtitle2: t('TOKEN_EXPIRED_FRESH_LINK'),
      };
    }
    return <div className={cf('error-page')}>{this.renderPage(data)}</div>;
  }
}
