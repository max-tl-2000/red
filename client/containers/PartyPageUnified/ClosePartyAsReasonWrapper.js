/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import React, { Component } from 'react';
import { createSelector } from 'reselect';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { closeParty } from 'redux/modules/partyStore';
import { getLeases } from 'redux/selectors/partySelectors';
import { voidLease } from 'redux/modules/leaseStore';
import { observer, inject } from 'mobx-react';
import { Typography as T, MsgBox } from 'components';
import ClosePartyAsResidentDialog from '../PartyPage/ClosePartyAsResidentDialog';
import ContactBlockedPreviouslyDialog from '../PartyPage/ContactBlockedPreviouslyDialog';
import { DALTypes } from '../../../common/enums/DALTypes';

export const closeReasonsHash = {
  alreadeAResident: 'ALREADY_A_RESIDENT',
  markedAsSpam: 'MARKED_AS_SPAM',
};

const getActiveLease = createSelector(getLeases, leases => leases.find(l => l.status !== DALTypes.LeaseStatus.VOIDED));

@connect(
  (state, props) => ({
    inventory: state.inventoryStore.inventory,
    lease: getActiveLease(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        closeParty,
        voidLease,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ClosePartyAsReasonWrapper extends Component {
  static propTypes = {
    partyId: PropTypes.string.isRequired,
    reason: PropTypes.oneOf([closeReasonsHash.alreadeAResident, closeReasonsHash.markedAsSpam]),
    voidLease: PropTypes.func,
  };

  handleVoidLease = () => {
    const { lease } = this.props;
    this.props.voidLease(lease.partyId, lease.id);
  };

  handleCloseParty = async () => {
    const { props } = this;
    const { partyId, reason } = props;
    if (!reason) return;

    await props.closeParty(partyId, reason);

    // navigate to dashboard
    props.leasingNavigator.navigateToDashboard();
  };

  getClosePartyDialogComponent = ({ reason }) => {
    switch (reason) {
      case closeReasonsHash.alreadeAResident:
        return {
          component: ClosePartyAsResidentDialog,
          onClosePartyAsResident: this.handleCloseParty,
        };
      case closeReasonsHash.markedAsSpam:
        return {
          component: ContactBlockedPreviouslyDialog,
          onClosePartyAsSpam: this.handleCloseParty,
        };
      default:
        return null;
    }
  };

  render() {
    const { props } = this;
    const { model, lease, inventory } = props;

    if (lease) {
      const inventoryType = inventory && inventory.type;
      const inventoryName = inventory && inventory.name;
      return (
        <MsgBox
          open={model.isOpen}
          appendToBody
          title={t('VOID_LEASE')}
          lblOK={t('VOID_LEASE')}
          lblCancel={t('CANCEL')}
          onCloseRequest={model.close}
          onOKClick={this.handleVoidLease}
          onCancelClick={model.close}>
          <T.Text>{t('CLOSE_PARTY_ACTIVE_LEASE_WARNING', { inventoryType, inventoryName })}</T.Text>
        </MsgBox>
      );
    }

    const { component: CloasAsDialog, ...properties } = this.getClosePartyDialogComponent(props);
    if (!CloasAsDialog) return <noscript />;

    return <CloasAsDialog open={model.isOpen} onCancelRequest={model.close} {...properties} />;
  }
}
