/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, Typography } from 'components';
import { t } from 'i18next';
import { cf } from './address-recommendation-dialog.scss';

const { Text, TextHeavy } = Typography;

const translationTokens = {
  success: {
    title: 'ADDRESS_RECOMMENDATION_TITLE',
    description: 'ADDRESS_RECOMMENDATION_TEXT',
    uspsLabel: 'ADDRESS_RECOMMENDED',
    okLabel: 'ACCEPT_CHANGE',
  },
  error: {
    title: 'ADDRESS_RECOMMENDATION_ERROR_TITLE',
    description: 'ADDRESS_RECOMMENDATION_ERROR_TEXT',
    uspsLabel: 'ADDRESS_ERROR_RECOMMENDED',
    okLabel: 'LET_ME_FIXED',
  },
};

export default class AddressRecommendationDialog extends Component {
  static propTypes = {
    open: PropTypes.bool,
    displaySuccessMessages: PropTypes.bool,
    onHandleRecommendation: PropTypes.func,
    onUseMine: PropTypes.func,
    enteredAddress: PropTypes.object,
    recommendedAddress: PropTypes.object,
  };

  static defaultProps = {
    displaySuccessMessages: true,
  };

  renderAddressLines = ({ addressLine1, addressLine2, city, state, zip }) => {
    const addressLines = new Map();

    addressLine1 && addressLines.set('addressLine1', addressLine1);
    addressLine2 && addressLines.set('addressLine2', addressLine2);
    city && addressLines.set('city', city);
    const stateAndZipLine = [state, zip].filter(field => !!field).join(' ');
    stateAndZipLine && addressLines.set('state-zip', stateAndZipLine);

    return Array.from(addressLines).map(([key, addressLine]) => <Text key={`${addressLines}_${key}`}>{addressLine}</Text>);
  };

  renderAddress = (addressToken, address, isValidAddress = true) => (
    <div>
      <TextHeavy className={cf('address-type')}>{t(addressToken)}</TextHeavy>
      {isValidAddress && this.renderAddressLines(address)}
      {!isValidAddress && <Text>{address.error.description}</Text>}
    </div>
  );

  render = ({ open, displaySuccessMessages, enteredAddress = {}, recommendedAddress = {}, onHandleRecommendation, onUseMine } = this.props) => {
    const translations = translationTokens[displaySuccessMessages ? 'success' : 'error'];
    return (
      <MsgBox
        open={open}
        closeOnEscape={false}
        title={t(translations.title)}
        lblOK={t(translations.okLabel)}
        lblCancel={t('USE_MINE')}
        onOKClick={() => onHandleRecommendation && onHandleRecommendation(displaySuccessMessages)}
        onCancelClick={() => onUseMine && onUseMine()}>
        <Text>{t(translations.description)}</Text>
        <div className={cf('address-summary')}>
          {this.renderAddress('ADDRESS_ENTERED', enteredAddress, true)}
          {this.renderAddress(translations.uspsLabel, recommendedAddress, displaySuccessMessages)}
        </div>
      </MsgBox>
    );
  };
}
