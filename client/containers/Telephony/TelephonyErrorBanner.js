/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';

import { Button, Typography } from 'components';
import { cf, g } from './TelephonyErrorBanner.scss';
import { telephonyDisconnectedReasons } from '../../../common/enums/enums';

const { Text, Link } = Typography;

export default class TelephonyErrorBanner extends Component {
  getTelephonyBanner = reason => {
    if (reason === telephonyDisconnectedReasons.NO_INTERNET_CONNECTION) {
      return <Text> {t('TELEPHONY_NO_INTERNET_CONNECTION')} </Text>;
    }

    if (reason === telephonyDisconnectedReasons.USER_REFUSED_MIC_ACCESS) {
      return (
        <Text>
          {t('TELEPHONY_NO_MIC_ACCESS')}{' '}
          <Link noDefaultColor underline target="_blank" href="https://reva.zendesk.com/hc/en-us/articles/360038825013-Configuring-Chrome-for-Reva">
            {t('TELEPHONY_ENABLE_MIC')}
          </Link>
          .
        </Text>
      );
    }

    return (
      <div className={cf('connectionInterruptedContainer')}>
        <Text> {t('TELEPHONY_CONNECTION_INTERRUPTED')} </Text>{' '}
        <Button label={t('RELOAD_ACTION_LABEL')} type="flat" onClick={() => window.location.reload(true)} />
      </div>
    );
  };

  render() {
    const { className, reason } = this.props;

    const telephonyBanner = this.getTelephonyBanner(reason);
    return <div className={cf('telephonyBanner', g(className))}>{telephonyBanner}</div>;
  }
}
