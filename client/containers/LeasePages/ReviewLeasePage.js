/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Button, CheckBox, Typography as T } from 'components';
import { t } from 'i18next';
import { LeasePage } from './LeasePage';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { cf } from './ReviewLeasePage.scss';

export default class ReviewLeasePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      readyToExecuteConfirmed: false,
    };
  }

  toggleReadyToExecuteConfirmed = () => this.setState({ readyToExecuteConfirmed: !this.state.readyToExecuteConfirmed });

  downloadLease = () => {
    const { token } = this.props.params;
    leasingNavigator.openLeaseDocumentTab(token, true);
  };

  render() {
    const { executionURL } = this.props && this.props.location.query;
    const { propertyName } = this.props.location.query;
    return (
      <LeasePage propertyName={propertyName}>
        <img className={cf('margin-bottom')} src="/images/ig-lease-signing.svg" />
        <T.SubHeader className={cf('margin-bottom')}>{t('ABOUT_TO_COUNTERSIGN')}</T.SubHeader>
        <T.Link uppercase onClick={this.downloadLease} className={cf('margin-bottom')}>
          {t('VIEW_SIGNED_LEASE')}
        </T.Link>
        <CheckBox
          id="reviewLeaseCheckbox"
          className={cf('margin-bottom')}
          label={t('LEASE_READY_TO_EXECUTE_CONFIRMATION')}
          checked={this.state.readyToExecuteConfirmed}
          onChange={this.toggleReadyToExecuteConfirmed}
        />
        <Button
          id="executeLeaseBtn"
          type="raised"
          btnRole="primary"
          label={t('COUNTERSIGN_AND_EXECUTE_LEASE')}
          disabled={!this.state.readyToExecuteConfirmed}
          onClick={() => leasingNavigator.updateLocation(executionURL)} // redirect
        />
      </LeasePage>
    );
  }
}
