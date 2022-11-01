/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { cf } from './SignatureConfirmationSteps.scss';

export default class SignatureConfirmationSteps extends Component {
  static propTypes = {
    leaseStatus: PropTypes.object,
  };

  renderListItem = (text, src, alt, highlighted) => (
    <li className={highlighted && cf('active')}>
      <div>
        <span className={cf('step-tab')}>
          <img src={src} alt={alt} />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {text}
      </T.SubHeader>
    </li>
  );

  render() {
    const { hasThisPersonSigned, haveAllResidentsSigned, isLeaseExecuted } = this.props.leaseStatus;
    return (
      <ul className={cf('steps')}>
        {this.renderListItem(
          t('YOUR_LEASE_SIGNED'),
          '/images/ig-app-submitted.svg',
          t('YOUR_LEASE_SIGNED_ALT'),
          !!haveAllResidentsSigned || !!hasThisPersonSigned,
        )}
        {this.renderListItem(t('ALL_MEMBERS_SIGNED'), '/images/ig-your-app-submitted.svg', t('ALL_MEMBERS_SIGNED_ALT'), !!haveAllResidentsSigned)}
        {this.renderListItem(t('COUNTERSIGNED_AND_EXECUTED'), '/images/ig-lease-signing.svg', t('COUNTERSIGNED_AND_EXECUTED_ALT'), !!isLeaseExecuted)}
      </ul>
    );
  }
}
