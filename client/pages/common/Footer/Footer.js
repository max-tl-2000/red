/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { inject, observer } from 'mobx-react';

import * as T from '../../../components/Typography/Typography';
import { now } from '../../../../common/helpers/moment-utils';
import { cf } from './Footer.scss';

@inject('urls')
@observer
export default class Footer extends Component {
  render() {
    const { urls, tenantDomain } = this.props;
    const year = now().year();
    const termsOfServiceUrl = tenantDomain ? `https://${tenantDomain}/${urls.termsOfService}` : `/${urls.termsOfService}`;
    const privacyPolicyUrl = tenantDomain ? `https://${tenantDomain}/${urls.privacy}` : `/${urls.privacy}`;

    return (
      <div className={cf('footer')}>
        <T.Caption className={cf('links')}>
          <T.Link href={termsOfServiceUrl}>{t('TERMS_OF_SERVICE')}</T.Link>
          <span className={cf('spacer')}> | </span>
          <T.Link href={privacyPolicyUrl}>{t('PRIVACY_POLICY')}</T.Link>
        </T.Caption>
        <T.Caption secondary>{t('COPYRIGHT', { year })}</T.Caption>
      </div>
    );
  }
}
