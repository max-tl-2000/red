/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { computed } from 'mobx';
import PropTypes from 'prop-types';
import pick from 'lodash/pick';
import { hasOwnProp } from '../../../../common/helpers/objUtils';
import AddressRecommendationDialog from './address-recommendation-dialog';

@inject('application')
@observer
export default class AddressRecommendation extends Component {
  static propTypes = {
    onHandleAction: PropTypes.func,
  };

  @computed
  get displayDialog() {
    const { displayRecommendedAddressDialog } = this.props.application || {};
    return displayRecommendedAddressDialog;
  }

  @computed
  get hasError() {
    const { _recommendedAddress } = this.props.application.applicantDetailsModel || {};
    return hasOwnProp(_recommendedAddress, 'error');
  }

  @computed
  get enteredAddress() {
    const { serializedData } = this.props.application.applicantDetailsModel || {};
    return this.formatAddress(serializedData);
  }

  @computed
  get recommendedAddress() {
    const { _recommendedAddress } = this.props.application.applicantDetailsModel || {};
    return this.hasError ? _recommendedAddress : this.formatAddress(_recommendedAddress);
  }

  onAddressRecommendationDecisionHandler = (isValidAddress, acceptChanges) => {
    const { application, onHandleAction } = this.props;
    const { applicantDetailsModel } = application || {};
    const useRecommendedChanges = isValidAddress ? acceptChanges : false;
    applicantDetailsModel && applicantDetailsModel.setAddressRecommendationAction(isValidAddress, useRecommendedChanges);
    isValidAddress && onHandleAction && onHandleAction();
  };

  formatAddress = (applicantData = {}) => pick(applicantData, ['addressLine1', 'addressLine2', 'city', 'state', 'zip']);

  render = () => {
    if (!this.displayDialog) return <noscript />;

    return (
      <AddressRecommendationDialog
        open={this.displayDialog}
        displaySuccessMessages={!this.hasError}
        enteredAddress={this.enteredAddress}
        recommendedAddress={this.recommendedAddress}
        onHandleRecommendation={isValidAddress => this.onAddressRecommendationDecisionHandler(isValidAddress, true)}
        onUseMine={() => this.onAddressRecommendationDecisionHandler(true, false)}
      />
    );
  };
}
