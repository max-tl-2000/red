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
import { fetchEnvelopeToken } from 'redux/modules/leaseStore';
import { observer, inject } from 'mobx-react';
import { renderPreparingLease } from '../PreparingLeaseComponent';
import { LEASE_SIGNING_ERROR_TOKENS } from '../../../../common/enums/error-tokens';
import { LeasePage } from '../LeasePage';
@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        fetchEnvelopeToken,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class SignLeaseInOfficePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tokenError: false,
    };
  }

  async componentWillMount() {
    const clientUserId = this.props.location.pathname.split('/').pop();
    const { envelopeId } = this.props.params;
    const { inOfficeSignature } = this.props.location.query;

    const { data, error } = await this.props.fetchEnvelopeToken(envelopeId, clientUserId, inOfficeSignature);
    if (data) {
      const { token: docusignUrl } = data;
      windowOpen(docusignUrl, '_self');
      return;
    }

    if (error) {
      if (error.token === LEASE_SIGNING_ERROR_TOKENS.LEASE_ALREADY_COUNTERSIGNED) {
        this.setState({ alreadyCounterSigned: true });
      } else if (error.token === LEASE_SIGNING_ERROR_TOKENS.LEASE_ALREADY_SIGNED) {
        this.setState({ alreadySigned: true });
      } else {
        this.setState({ fetchError: error });
      }
    }
  }

  getMessage = (alreadySigned, alreadyCounterSigned, fetchError) => {
    if (alreadySigned) {
      return t('LEASE_ALREADY_SIGNED');
    }
    if (alreadyCounterSigned) {
      return t('LEASE_ALREADY_COUNTERSIGNED');
    }
    if (fetchError) {
      return t('LEASE_PREPARE_DOCUMENT_FAILED', { action: t('SIGNING') });
    }
    return t('LEASE_PREPARE_DOCUMENT', { action: t('SIGNING') });
  };

  render = () => {
    const { alreadySigned, alreadyCounterSigned, fetchError } = this.state;
    const { propertyName } = this.props.location.query;

    const msg = this.getMessage(alreadySigned, alreadyCounterSigned, fetchError);
    return <LeasePage propertyName={propertyName}>{renderPreparingLease(msg)}</LeasePage>;
  };
}
