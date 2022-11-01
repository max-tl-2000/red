/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import { sendToParent } from 'helpers/postMessage';
import { Status } from 'components';
import { push, replace, location } from '../../../../client/helpers/navigator';
import { Page } from '../../custom-components/page/page';
import { cf } from './login.scss';
import { LoginForm } from './login-form';
import { DALTypes } from '../../../common/enums/dal-types';
import { LoginMessageTypes } from '../../../../common/enums/messageTypes';

@inject('loginModel', 'auth')
@observer
export class Login extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      model: props.loginModel.create(),
    };
    document.title = t('SIGN_IN');
  }

  componentWillMount() {
    const { redirectToUrl } = this.props.auth.tokenObject;

    const appId = this.props.location.query.appId;
    this.setState({
      redirectToUrl,
      appId: appId || this.props.auth.tokenObject.appId,
    });
  }

  handleLogin = async () => {
    const { model } = this.state;

    if (model.blockedAccount) {
      push('/help');
      return;
    }

    await model.validate();

    if (model.valid) {
      const userData = await model.login();

      if (model.loginError) return;

      switch (this.state.appId) {
        case DALTypes.ApplicationAppId:
        case DALTypes.RoommatesAppId:
          sendToParent({
            type: LoginMessageTypes.LOGIN_SUCCESS,
            data: userData,
          });
          break;
        default: {
          const {
            location: { state },
          } = this.props;
          if (this.state && this.state.redirectToUrl) {
            location.replace(this.state.redirectToUrl);
          }
          if (state && state.nextPathname) {
            const nextPath = state.nextPathname;
            if (!nextPath) {
              replace({ pathname: '/', state: {} });
              return;
            }
            replace({ pathname: nextPath, state: {} });
            return;
          }
          replace({ pathname: '/', state: {} });
          break;
        }
      }
    }
  };

  handleForgotPassword = async () => {
    switch (this.state.appId) {
      case DALTypes.RoommatesAppId:
        sendToParent({ type: LoginMessageTypes.GO_TO_FORGOT_PASSWORD });
        break;
      case DALTypes.ApplicationAppId:
        {
          const { appId, confirmUrl } = this.props.location.query;
          const temporalToken = await this.state.model.requestTemporalResetPassword(appId, confirmUrl);

          sendToParent({
            type: LoginMessageTypes.GO_TO_FORGOT_PASSWORD,
            data: { token: temporalToken },
          });
        }
        break;
      default:
        push('/resetPassword');
        break;
    }
  };

  redirectTo = linkId => sendToParent({ type: LoginMessageTypes.LINK_CLICK, data: linkId });

  render() {
    const { model } = this.state;
    const { loginIn, blockedAccount, valid, interacted } = model;
    const mainActionLabel = blockedAccount ? t('RESET_PASSWORD') : t('SIGN_IN');

    const disabledAction = loginIn || !interacted || !valid || !model.requiredAreFilled;

    return (
      <Page noHeader>
        <div className={cf('mobile-view')}>
          <Status processing={loginIn} />
          <LoginForm
            model={model}
            disabledAction={disabledAction}
            handleLogin={this.handleLogin}
            redirectTo={this.redirectTo}
            mainActionLabel={mainActionLabel}
            handleForgotPassword={this.handleForgotPassword}
          />
        </div>
      </Page>
    );
  }
}
