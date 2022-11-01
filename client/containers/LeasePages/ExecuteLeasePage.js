/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Typography as T } from 'components';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { updateEnvelopeSignature } from 'redux/modules/leaseStore';
import { t } from 'i18next';
import { cf } from './LeasePage.scss';
import ErrorFound from './SignatureConfirmation/ErrorFound';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { renderPreparingLease } from './PreparingLeaseComponent';
import { DALTypes } from '../../../common/enums/DALTypes';
import { LeasePage } from './LeasePage';

@connect(
  state => ({
    leaseStatus: state.leaseStore.leaseEnvelopeData,
    error: state.leaseStore.error,
  }),
  dispatch =>
    bindActionCreators(
      {
        updateEnvelopeSignature,
      },
      dispatch,
    ),
)
export default class ExecuteLeasePage extends Component {
  componentWillMount() {
    const { token } = this.props.params;
    if (token) {
      this.props.updateEnvelopeSignature(token);
    }
  }

  componentWillReceiveProps(nextProps) {
    const { leaseStatus } = nextProps;
    const { updateStatus } = leaseStatus || {};
    const voided = updateStatus === DALTypes.LeaseStatus.VOIDED;

    if (leaseStatus && !voided) {
      leasingNavigator.navigateToSignatureConfirmationWithToken(this.props.params.token);
    }
  }

  renderLeaseVoided = () => (
    <div className={cf('void-container')}>
      <div className={cf('void-message')}>
        <img src="/images/ig-lease-voided.svg" />
        <T.Text>{t('SIGNATURE_VOIDED_MESSAGE_LINE1')}</T.Text>
      </div>
    </div>
  );

  render() {
    const { propertyName } = this.props.location.query;

    if (this.props.error) {
      return (
        <ErrorFound
          error={{
            title: 'LEASE_SIGN_ERROR_TITLE',
            message: 'LEASE_SIGN_ERROR_MSG',
          }}
        />
      );
    }

    const { updateStatus } = this.props.leaseStatus || {};
    const voided = updateStatus === DALTypes.LeaseStatus.VOIDED;

    if (voided) return this.renderLeaseVoided();

    return <LeasePage propertyName={propertyName}>{renderPreparingLease(t('EXECUTING_LEASE'))}</LeasePage>;
  }
}
