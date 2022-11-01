/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { updateParty } from 'redux/modules/partyStore';
import { isMissingPropertyOrTeam } from 'helpers/party';
import DialogModel from './DialogModel';
import { PropertySelectionDialog } from '../PropertySelection/PropertySelectionDialog';

@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        updateParty,
      },
      dispatch,
    ),
)
export default class PropertySelectionDialogWrapper extends Component {
  constructor(props) {
    super(props);
    const dialogModel = new DialogModel();
    this.state = { dialogModel };
    this.checkIfMissingPropertyOrTeamInParty(props);
  }

  get dialogModel() {
    return this.state.dialogModel;
  }

  checkIfMissingPropertyOrTeamInParty = props => {
    const { dialogModel } = this;
    if (props.party?.userId && isMissingPropertyOrTeam(props.party) && !dialogModel.isOpen) {
      dialogModel.open();
    }
  };

  componentDidMount() {
    this.checkIfMissingPropertyOrTeamInParty(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.checkIfMissingPropertyOrTeamInParty(nextProps);
  }

  handleSubmitPropertySelection = ({ assignedPropertyId, ownerTeamId }) => {
    const { props, dialogModel } = this;
    const { partyId: id } = props;

    props.updateParty({ id, assignedPropertyId, ownerTeam: ownerTeamId });

    dialogModel.close();
  };

  render() {
    const { props, dialogModel } = this;
    const { party, onClose, currentUser, users } = props;
    if (!party?.userId) return <noscript />;
    const renderDialog = dialogModel.isOpen && currentUser;
    const partyOwner = users.get(party.userId);
    const partyOwnerTeams = partyOwner?.teams.filter(t => party.teams.includes(t.id)) || [];

    return (
      <div>
        {renderDialog && (
          <PropertySelectionDialog
            open={dialogModel.isOpen}
            onSubmit={this.handleSubmitPropertySelection}
            onClose={onClose}
            closeOnEscape={false}
            forceFocusOnDialog={true}
            propertyId={party.assignedPropertyId}
            properties={partyOwner.associatedProperties}
            teams={partyOwnerTeams}
            party={party}
          />
        )}
      </div>
    );
  }
}
