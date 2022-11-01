/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { setSelectedPropertyId, setOwnerTeamId } from 'redux/modules/propertyStore';
import { setFirstContactChannel, setPartyWorkflow } from 'redux/modules/partyStore';
import { PropertySelectionDialog } from '../PropertySelection/PropertySelectionDialog';
import { getAssignedProperty } from '../../helpers/party';

@connect(
  state => ({
    currentUser: state.auth.user || {},
  }),
  dispatch =>
    bindActionCreators(
      {
        setSelectedPropertyId,
        setOwnerTeamId,
        setFirstContactChannel,
        setPartyWorkflow,
      },
      dispatch,
    ),
)
export default class PropertyAndTeamSelectionDialogWrapper extends Component {
  get propertyId() {
    const { currentUser } = this.props;
    return getAssignedProperty(currentUser.associatedProperties.length === 1, currentUser.associatedProperties);
  }

  handleSubmitPropertySelection = ({ assignedPropertyId, ownerTeamId, contactChannel, partyWorkflow }) => {
    const { props } = this;
    props.setSelectedPropertyId(assignedPropertyId);
    props.setOwnerTeamId(ownerTeamId);
    props.setFirstContactChannel(contactChannel);
    props.setPartyWorkflow(partyWorkflow);
  };

  render() {
    const { currentUser } = this.props;

    return (
      <PropertySelectionDialog
        showCancelButton={true}
        closeOnEscape={true}
        forceFocusOnDialog={true}
        onSubmit={this.handleSubmitPropertySelection}
        properties={currentUser.associatedProperties}
        propertyId={this.propertyId}
        teams={currentUser.teams}
      />
    );
  }
}
