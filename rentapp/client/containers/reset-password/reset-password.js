/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Iframe, ErrorMessage } from 'components';
import { windowOpen } from 'helpers/win-open';
import { t } from 'i18next';
import { Page } from '../../custom-components/page/page';
import { RentAppBar } from '../../custom-components/rentapp-bar/rentapp-bar';
import { AppLinkIds, AppLinkIdUrls, LoginMessageTypes, RegisterMessagesTypes } from '../../../../common/enums/messageTypes';
import { DALTypes } from '../../../../auth/common/enums/dal-types';
import { location, replace } from '../../../../client/helpers/navigator';
import { getSignInUrl, getResetPasswordUrl as getAuthResetPasswordUrl, getConfirmResetPasswordUrl } from '../../../../auth/common/resolve-url';
import { prefixUrlWithProtocol } from '../../../../common/helpers/resolve-url';
import LoaderIndicator from '../../../../client/components/LoaderIndicator/LoaderIndicator';
import { cf } from './reset-password.scss';

@inject('auth', 'application')
@observer
export class ResetPassword extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      isConfirmResetPassword: props.isConfirmResetPassword,
      authToken: props.authToken,
    };
  }

  static propTypes = {
    isConfirmResetPassword: PropTypes.bool,
    authToken: PropTypes.string,
  };

  static defaultProps = {
    isConfirmResetPassword: false,
  };

  async componentWillMount() {
    this.props.isConfirmResetPassword && (await this.props.auth.validateResetToken(this.props.authToken));
  }

  getResetPasswordUrl = () => {
    const { isConfirmResetPassword, authToken: token } = this.state;
    if (isConfirmResetPassword) {
      return token && getConfirmResetPasswordUrl(token);
    }

    return getAuthResetPasswordUrl({
      appId: DALTypes.ApplicationAppId,
      confirmUrl: `${location.origin}/confirmResetPassword`,
      cancelLinkId: LoginMessageTypes.GO_TO_SIGN_IN,
      token,
    });
  };

  redirectToSignIn = () => {
    const { authToken: token } = this.state;
    const signInUrl = token && getSignInUrl(token);
    signInUrl && location.replace(signInUrl);
  };

  handleAppLinks = (linkId, communications = {}) => {
    switch (linkId) {
      case AppLinkIds.TERMS_AND_CONDITIONS:
        windowOpen(AppLinkIdUrls.TERMS_AND_CONDITIONS_ID);
        break;
      case AppLinkIds.PRIVACY_POLICY:
        windowOpen(AppLinkIdUrls.PRIVACY_POLICY_ID);
        break;
      case AppLinkIds.CONTACT_US: {
        const contactUsLink = prefixUrlWithProtocol(communications.contactUsLink);
        contactUsLink && windowOpen(contactUsLink);
        break;
      }
      default:
        break;
    }
  };

  handleOnMessage = ({ type, data }) => {
    switch (type) {
      case RegisterMessagesTypes.LINK_CLICK:
        this.handleAppLinks(data, {
          contactUsLink: this.props.application.contactUsLink,
        });
        break;
      case RegisterMessagesTypes.REGISTER_SUCCESS: {
        const { token, user } = data;
        this.props.auth._updateUser({ token, userId: user.id });
        token && replace(`/applicationList/${token}`);
        break;
      }
      case LoginMessageTypes.GO_TO_SIGN_IN: {
        this.redirectToSignIn();
        break;
      }
      default:
        break;
    }
  };

  renderResetPassword() {
    const { isValidToken, tokenValidationError } = this.props.auth;
    if (isValidToken || !this.state.isConfirmResetPassword) {
      return <Iframe src={this.getResetPasswordUrl()} className={cf('iframe')} onMessage={this.handleOnMessage} />;
    }
    return (
      <div className={cf('error-page')}>
        <ErrorMessage message={t(tokenValidationError)} />
      </div>
    );
  }

  render() {
    const { isTokenValidationInProcess } = this.props.auth;

    return <Page appBar={<RentAppBar />}>{isTokenValidationInProcess ? <LoaderIndicator darker /> : this.renderResetPassword()}</Page>;
  }
}
