/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Iframe } from 'components';
import { t } from 'i18next';
import { cf } from './login.scss';
import { getLoginUrl, getAfterLoginUrl } from '../../../common/helpers/resolve-url';
import { Page } from '../../custom-components/page/page';
import { LoginMessageTypes } from '../../../../common/enums/messageTypes';
import { redirectToWithLinkId } from '../../../../common/client/redirect-helper';
import { replace } from '../../../../client/helpers/navigator';
import { RentAppBar } from '../../custom-components/rentapp-bar/rentapp-bar';
import { redirectToUrl } from '../../helpers/utils';
import { sessionStorage as ss } from '../../../../common/helpers/globals';

const onLoginSuccess = async (props, { token = '', user }) => {
  const { applications: applicationsStore, auth: authStore } = props;

  props.auth._updateUser({ token, userId: user.id });
  const key = '__authData__';
  ss[key] = JSON.stringify({ token, userId: user.id });

  await applicationsStore.fetchApplications();

  if (!applicationsStore.hasMultiplesApplications && applicationsStore.applications.length) {
    applicationsStore.handleRedirection(authStore.isAuthenticated);
  }

  redirectToUrl(getAfterLoginUrl(props.applications.previousUrl, token));
};

@inject('auth', 'applications')
@observer
export class Login extends Component {
  constructor(props, context) {
    super(props, context);

    props.auth.isAuthenticated && replace('/');

    this.state = {
      iframeUrl: getLoginUrl(),
    };
  }

  handleIframeUrlChange = newIframeUrl => this.setState({ iframeUrl: newIframeUrl });

  async onMessage({ type, data }) {
    switch (type) {
      case LoginMessageTypes.LOGIN_SUCCESS:
        await onLoginSuccess(this.props, data);
        break;
      case LoginMessageTypes.LINK_CLICK:
        redirectToWithLinkId(data);
        break;
      case LoginMessageTypes.GO_TO_FORGOT_PASSWORD:
        replace(`/resetPassword/${data.token}`);
        break;
      default:
        break;
    }
  }

  render() {
    const { iframeUrl } = this.state;
    return (
      <Page appBar={<RentAppBar title={t('APPLICATION')} />}>
        <Iframe testId="loginIframe" src={iframeUrl} className={cf('iframe')} onMessage={msg => this.onMessage(msg)} />
      </Page>
    );
  }
}
