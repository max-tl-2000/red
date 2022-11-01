/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observer, inject } from 'mobx-react';
import React from 'react';
import { Iframe } from 'components';
import { cf } from './page-iframe.scss';
import { getConfirmRegisterUrl } from '../../../helpers/resolve-url';
import { Page } from '../page/page';
import { parseQueryString } from '../../../../client/helpers/url';
import { RegisterMessagesTypes, LoginMessageTypes } from '../../../../common/enums/messageTypes';
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

const onRegisterSuccess = (props, { user, token }) => {
  setPropertyConfig(user.roommateProfile, props);
  props.auth.hydrate({ token, user });

  const isProfileCompleted = props.profile.ProfileModel.isProfileCompleted(user.roommateProfile);
  const route = isProfileCompleted ? '/' : '/profile';
  replace(route);
};

@inject('auth', 'profile')
@observer
export class ConfirmRegister extends React.Component {
  // eslint-disable-line react/prefer-stateless-function

  async onMessage({ type, data }) {
    switch (type) {
      case RegisterMessagesTypes.REGISTER_SUCCESS:
        if (window.ga) window.ga('send', 'event', 'auth', 'register');
        onRegisterSuccess(this.props, data);
        break;
      case RegisterMessagesTypes.LINK_CLICK:
        redirectToWithLinkId(data);
        break;
      case LoginMessageTypes.GO_TO_SIGN_IN:
        replace('/');
        break;
      default:
        break;
    }
  }

  render() {
    const { confirmToken } = parseQueryString(this.props.location.search);
    return (
      <Page className={cf('page')} contentDirection="column" hideRegister>
        <Iframe src={getConfirmRegisterUrl(confirmToken)} className={cf('iframe')} onMessage={msg => this.onMessage(msg)} />
      </Page>
    );
  }
}
