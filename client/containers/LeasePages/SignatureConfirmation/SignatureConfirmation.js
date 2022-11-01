/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography as T, PreloaderBlock } from 'components';
import { t } from 'i18next';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { updateEnvelopeSignature } from 'redux/modules/leaseStore';
import ErrorFound from './ErrorFound';
import { cf } from './SignatureConfirmation.scss';
import SignatureConfirmationSteps from './SignatureConfirmationSteps';
import { LeasePage } from '../LeasePage';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { AgentInfo } from './AgentInfo';

class SignatureConfirmationComponent extends Component {
  componentWillMount() {
    const { token } = this.props.params;
    if (token) {
      this.props.updateEnvelopeSignature(token);
    }
  }

  renderLeaseVoided = user => (
    <div className={cf('void-container')}>
      <div className={cf('void-message')}>
        <img src="/images/ig-lease-voided.svg" />
        <T.Text>{t('SIGNATURE_VOIDED_MESSAGE_LINE1')}</T.Text>
        <T.Text>{t('SIGNATURE_VOIDED_MESSAGE_LINE2')}</T.Text>
      </div>
      <T.Text className={cf('agent-label')}>{t('LEASING_AGENT_NAME')}</T.Text>
      <AgentInfo agent={user} />
    </div>
  );

  renderSignatureCompleted = () => (
    <div>
      <div className={cf('stepper-inner')}>
        <div className={cf('connecting-line')} />
        <SignatureConfirmationSteps leaseStatus={this.props.leaseStatus} />
      </div>
      <div className={cf('info-messages')} id="infoMessages">
        <T.Text>{t('SIGNATURE_COMPLETE_THANK_YOU_MESSAGE')}</T.Text>
      </div>
    </div>
  );

  renderContent = (property, user, voided) => {
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

    return (
      <LeasePage propertyName={property.name}>
        {voided && this.renderLeaseVoided(user)}
        {!voided && this.renderSignatureCompleted()}
      </LeasePage>
    );
  };

  render() {
    const { leaseStatus, error } = this.props;

    if (!leaseStatus && !error) {
      return <PreloaderBlock size="big" />;
    }
    const { property = {}, user, updateStatus } = leaseStatus || {};
    const voided = updateStatus === DALTypes.LeaseStatus.VOIDED;

    return this.renderContent(property, user, voided);
  }
}

SignatureConfirmationComponent.propTypes = {
  leaseStatus: PropTypes.object,
};

export const SignatureConfirmation = connect(
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
)(SignatureConfirmationComponent);
