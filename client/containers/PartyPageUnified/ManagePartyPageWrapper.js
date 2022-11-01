/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { isPublishedOrExecutedLease, isDraftLease } from 'redux/selectors/partySelectors';
import { canMergeParties, isDuplicatePersonNotificationEnabled } from 'redux/selectors/userSelectors';
import { openMergePartyFlyout } from 'redux/modules/mergePartiesStore';
import { observer, inject } from 'mobx-react';
import { action } from 'mobx';
import ManagePartyPage from '../ManageParty/ManagePartyPage';

@connect(
  (state, props) => ({
    isMergedPartyEnabled: canMergeParties(state, props),
    displayDuplicatePersonNotification: isDuplicatePersonNotificationEnabled(state, props),
    isLeasePublishedOrExecuted: isPublishedOrExecutedLease(state, props),
    isLeaseDraft: isDraftLease(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        openMergePartyFlyout,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ManagePartyPageWrapper extends Component {
  onNavigateToPersonPage = personId => this.props.leasingNavigator.navigateToPerson(personId);

  @action
  closeManagePartyPage = () => {
    const { model } = this.props;
    model.close();
    model.setMemberToOpen({});
  };

  handlePersonUpdate = () => {
    const { props } = this;
    props.model.setMemberToOpen({});
    props.onPersonUpdate && props.onPersonUpdate();
  };

  render() {
    const {
      party,
      model,
      isCorporateParty,
      displayDuplicatePersonNotification,
      partyMembers,
      partyId,
      properties,
      isLeasePublishedOrExecuted,
      isLeaseDraft,
      closeCreateEditResidentForm,
      isActiveLeaseParty,
      isNewLeaseParty,
      isRenewalParty,
      partyClosedOrArchived,
      handleSaveCompany,
      handleUpdatePartyMember,
      handleLoadSuggestions,
    } = this.props;

    return (
      <ManagePartyPage
        party={party}
        isCorporateParty={isCorporateParty}
        partyMembers={partyMembers}
        partyId={partyId}
        onNavigateToPersonPage={this.onNavigateToPersonPage}
        open={model.isOpen}
        onCloseRequest={this.closeManagePartyPage}
        properties={properties}
        handleMergeParties={this.props.handleMergeParties}
        memberToOpen={model.memberToOpen}
        onPersonUpdate={this.handlePersonUpdate}
        displayDuplicatePersonNotification={displayDuplicatePersonNotification}
        isLeasePublishedOrExecuted={isLeasePublishedOrExecuted}
        isLeaseDraft={isLeaseDraft}
        closeCreateEditResidentForm={closeCreateEditResidentForm}
        isActiveLeaseParty={isActiveLeaseParty}
        isNewLeaseParty={isNewLeaseParty}
        isRenewalParty={isRenewalParty}
        partyClosedOrArchived={partyClosedOrArchived}
        handleSaveCompany={handleSaveCompany}
        handleUpdatePartyMember={handleUpdatePartyMember}
        handleLoadSuggestions={handleLoadSuggestions}
      />
    );
  }
}
