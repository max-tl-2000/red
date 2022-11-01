/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { Page } from '../../custom-components/page/page';
import { RentAppBar } from '../../custom-components/rentapp-bar/rentapp-bar';
import { ApplicationCompleteSteps } from './application-complete-steps';
import { cf } from './application-complete.scss';

@inject('auth', 'application')
@observer
// eslint-disable-next-line react/prefer-stateless-function
export class ApplicationComplete extends Component {
  render() {
    const { propertyName } = this.props.application;
    return (
      <Page fixedHeader appBar={<RentAppBar propertyName={propertyName} />}>
        <div className={cf('page-content')}>
          <div className={cf('stepper-inner')}>
            <div className={cf('connecting-line')} />
            <ApplicationCompleteSteps />
          </div>
          <div className={cf('info-messages')} id="infoMessages">
            <T.Text>{t('APPLICATION_THANK_YOU_MESSAGE')}</T.Text>
          </div>
        </div>
      </Page>
    );
  }
}
