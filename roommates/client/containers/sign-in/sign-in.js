/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Iframe } from 'components';
import { cf } from './sign-in.scss';
import { getSignInUrl, getResetPasswordUrl } from '../../../helpers/resolve-url';
import { Page } from '../page/page';
import { LoginMessageTypes } from '../../../../common/enums/messageTypes';
import { redirectToWithLinkId } from '../../../../common/client/redirect-helper';
import { replace } from '../../../../client/helpers/navigator';

const setPropertyConfig = (roommateProfile, props) => {
  if (roommateProfile.properties && roommateProfile.properties.length) {
    const property = roommateProfile.properties[0]; // TODO: This should be selected by the user on version 2

    props.auth.hydratePropertyConfig({
      tenantId: property.tenant.id,
      propertyId: property.id,
      tenantName: property.tenant.name,
      propertyName: property.name,
      propertyTimezone: property.timezone,
    });
  }
};
const onLoginSuccess = (props, { user, token }) => {
  setPropertyConfig(user.roommateProfile, props);
  props.auth.hydrate({ token, user });

  window.ga && window.ga('send', 'event', 'auth', 'login');

  const isProfileCompleted = props.profile.ProfileModel.isProfileCompleted(user.roommateProfile);
  const route = isProfileCompleted && user.roommateProfile.isActive ? '/' : '/profile';
  replace(route);
};

@inject('auth', 'profile')
@observer
export class SignIn extends Component {
  constructor(props, context) {
    super(props, context);

    props.auth.isAuthenticated && replace('/');

    this.state = {
      iframeUrl: getSignInUrl(),
    };
  }

  handleIframeUrlChange = newIframeUrl => this.setState({ iframeUrl: newIframeUrl });

  async onMessage({ type, data }) {
    switch (type) {
      case LoginMessageTypes.LOGIN_SUCCESS:
        onLoginSuccess(this.props, data);
        break;
      case LoginMessageTypes.LINK_CLICK:
        redirectToWithLinkId(data);
        break;
      case LoginMessageTypes.GO_TO_FORGOT_PASSWORD:
        this.handleIframeUrlChange(getResetPasswordUrl(LoginMessageTypes.GO_TO_SIGN_IN));
        break;
      case LoginMessageTypes.GO_TO_SIGN_IN:
        this.handleIframeUrlChange(getSignInUrl());
        break;
      default:
        break;
    }
  }

  render() {
    const { iframeUrl } = this.state;
    return (
      <Page centerContent contentDirection="column" hideSignIn>
        <Iframe src={iframeUrl} className={cf('iframe')} onMessage={msg => this.onMessage(msg)} />
      </Page>
    );
  }
}
