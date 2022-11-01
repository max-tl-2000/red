/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer, inject } from 'mobx-react';
import { Iframe } from 'components';
import { cf } from './page-iframe.scss';
import { getResetPasswordUrlFromMyProfile } from '../../../helpers/resolve-url';
import { Page } from '../page/page';
import { RegisterMessagesTypes, LoginMessageTypes } from '../../../../common/enums/messageTypes';
import { replace } from '../../../../client/helpers/navigator';

const onChangePasswordSuccess = (props, { user, token }) => {
  props.auth.hydrate({ token, user });
  replace('/profile');
};

@inject('resetPassword', 'auth')
@observer
export class ResetPassword extends React.Component {
  // eslint-disable-line react/prefer-stateless-function

  componentWillMount() {
    const { user } = this.props.auth.authInfo;
    this.props.resetPassword.generateResetPasswordToken(user);
  }

  async onMessage({ type, data }) {
    switch (type) {
      case RegisterMessagesTypes.REGISTER_SUCCESS:
        onChangePasswordSuccess(this.props, data);
        break;
      case LoginMessageTypes.GO_TO_SIGN_IN:
        replace('/profile');
        break;
      default:
        break;
    }
  }

  render() {
    return (
      <Page className={cf('page')} contentDirection="column" hideRegister>
        <div>
          <Iframe
            src={getResetPasswordUrlFromMyProfile(this.props.resetPassword.resetPasswordToken)}
            className={cf('iframe')}
            onMessage={msg => this.onMessage(msg)}
          />
        </div>
      </Page>
    );
  }
}
