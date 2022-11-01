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
import { getStartRegistrationUrl, getRoommatesConfirmUrl } from '../../../helpers/resolve-url';
import { Page } from '../page/page';
import { RegisterMessagesTypes } from '../../../../common/enums/messageTypes';
import { redirectToWithLinkId } from '../../../../common/client/redirect-helper';
import { DALTables } from '../../../common/enums/dal-tables';

@inject('register', 'auth')
@observer
export class Register extends React.Component {
  // eslint-disable-line react/prefer-stateless-function

  componentWillMount() {
    const roommatesConfirmUrl = getRoommatesConfirmUrl(this.props.auth.propertyConfig);
    this.props.register.generateRegisterToken(this.props.auth.propertyConfig, roommatesConfirmUrl, DALTables.TableColumns.ROOMMATE_PROFILE_REQUIRED_FIELDS);
  }

  async onMessage({ type, data }) {
    switch (type) {
      case RegisterMessagesTypes.LINK_CLICK:
        redirectToWithLinkId(data);
        break;
      default:
        break;
    }
  }

  render() {
    return (
      <Page className={cf('page')} contentDirection="column" hideRegister>
        <div>
          <Iframe src={getStartRegistrationUrl(this.props.register.registerToken)} className={cf('iframe')} onMessage={msg => this.onMessage(msg)} />
        </div>
      </Page>
    );
  }
}
