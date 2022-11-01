/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { windowOpen } from 'helpers/win-open';
import { t } from 'i18next';
import { Typography as T } from 'components';
import { fetchResidentDocusignUrl } from 'redux/modules/leaseStore';
import { observer, inject } from 'mobx-react';
import SignatureConfirmationSteps from './SignatureConfirmation/SignatureConfirmationSteps';
import { cf } from './LeasePage.scss';
import { LEASE_SIGNING_ERROR_TOKENS } from '../../../common/enums/error-tokens';
import { LeasePage } from './LeasePage';
@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        fetchResidentDocusignUrl,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ResidentSignLeaseFromEmailPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tokenError: false,
    };
  }

  async componentWillMount() {
    const { location } = this.props;

    const { token } = location.query;
    const { data, error } = await this.props.fetchResidentDocusignUrl(token);
    this.setState({ propertyName: data?.propertyName || error?.data?.propertyName });

    if (data && !error) {
      const { token: docusignUrl } = data;
      windowOpen(docusignUrl, '_self');
      return;
    }

    if (error) {
      if (error.token === LEASE_SIGNING_ERROR_TOKENS.LEASE_ALREADY_COUNTERSIGNED) {
        this.setState({ alreadyCounterSigned: true, leaseStatus: error.data });
      } else if (error.token === LEASE_SIGNING_ERROR_TOKENS.LEASE_ALREADY_SIGNED) {
        this.setState({ alreadySigned: true, leaseStatus: error.data });
      } else {
        this.setState({ fetchError: error });
      }
    }
  }

  renderSignatureCompleted = message => (
    <div>
      <div className={cf('stepper-inner')}>
        <div className={cf('connecting-line')} />
        <SignatureConfirmationSteps leaseStatus={this.state.leaseStatus} />
      </div>
      <div className={cf('info-messages')} id="infoMessages">
        <T.Text>{message}</T.Text>
      </div>
    </div>
  );

  getMessage = (alreadySigned, alreadyCounterSigned, fetchError) => {
    if (alreadySigned) {
      return this.renderSignatureCompleted(t('LEASE_ALREADY_SIGNED_LINK'));
    }
    if (alreadyCounterSigned) {
      return this.renderSignatureCompleted(t('LEASE_ALREADY_COUNTERSIGNED_LINK'));
    }
    if (fetchError) return t('LEASE_PREPARE_DOCUMENT_FAILED', { action: t('SIGNING') });

    return t('LEASE_PREPARE_DOCUMENT', { action: t('SIGNING') });
  };

  render = () => {
    const { alreadySigned, alreadyCounterSigned, fetchError, propertyName } = this.state;
    return (
      <LeasePage propertyName={propertyName}>
        <T.SubHeader inline bold>
          {this.getMessage(alreadySigned, alreadyCounterSigned, fetchError)}
        </T.SubHeader>
      </LeasePage>
    );
  };
}
