/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { FullScreenDialog, DialogTitle } from 'components';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { loadPartiesByPartyGroupId } from 'redux/modules/partyStore';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';
import PartyGroup from '../PartyGroup/PartyGroup';

@connect(
  (state, props) => ({
    partyGroupWorkflows: state.partyStore.partyGroupWorkflows,
    globalStore: state.globalStore.get('users'),
    users: state.globalStore.get('users'),
    isloadingPartyGroupWorkflows: state.partyStore.loadingPartyGroupWorkflows,
    timezone: getPartyTimezone(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        loadPartiesByPartyGroupId,
      },
      dispatch,
    ),
)
@observer
export default class PartyGroupDialog extends Component {
  static propTypes = {
    model: PropTypes.object,
    partyGroupId: PropTypes.string,
  };

  render() {
    const { props } = this;
    const { model, isloadingPartyGroupWorkflows, users, timezone, partyGroupId, partyGroupWorkflows } = props;
    const isLoadingUsers = !users.size;

    return (
      <div>
        <FullScreenDialog
          id="partyGroupDialog"
          open={model.isOpen}
          onCloseRequest={model.close}
          paddedScrollable
          title={
            <DialogTitle>
              <span>{t('ALL_WORKFLOWS_MODAL_TITLE', { partyGroupId })}</span>
            </DialogTitle>
          }>
          <PartyGroup
            loading={isloadingPartyGroupWorkflows || isLoadingUsers}
            partyGroupId={partyGroupId}
            partyGroupWorkflows={partyGroupWorkflows}
            timezone={timezone}
            users={users}
            loadPartiesByPartyGroupId={this.props.loadPartiesByPartyGroupId}
          />
        </FullScreenDialog>
      </div>
    );
  }
}
