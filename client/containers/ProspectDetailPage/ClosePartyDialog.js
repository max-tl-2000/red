/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';

import { closeParty } from 'redux/modules/partyStore';
import { voidLease } from 'redux/modules/leaseStore';
import { getLeases } from 'redux/selectors/partySelectors';
import { loadInventoryDetails } from 'redux/modules/inventoryStore';
import { Typography as T, MsgBox, Field, Dropdown } from 'components';
import { isLoggedAsAdmin } from 'helpers/users';
import { observer, inject } from 'mobx-react';
import { removeMember } from 'redux/modules/memberStore';
import { cf } from './ClosePartyDialog.scss';
import { getParty } from '../../redux/selectors/partySelectors';
import { array2DataSource } from '../../helpers/unitsUtils';
import { getVisibleCloseReasons } from '../../helpers/party';
import { DALTypes } from '../../../common/enums/DALTypes';

const getActiveLease = createSelector(getLeases, leases => leases.find(l => l.status !== DALTypes.LeaseStatus.VOIDED));

@connect(
  (state, props) => ({
    leaseWasVoided: state.leaseStore.leaseWasVoided,
    inventory: state.inventoryStore.inventory,
    currentUser: state.auth.user,
    party: getParty(state, props),
    lease: getActiveLease(state, props),
    quotes: state.quotes.quotes,
  }),
  dispatch =>
    bindActionCreators(
      {
        loadInventoryDetails,
        voidLease,
        closeParty,
        removeMember,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class ClosePartyDialog extends Component {
  static propTypes = {
    voidLease: PropTypes.func,
    closeParty: PropTypes.func,
    onCloseRequest: PropTypes.func,
    leaseWasVoided: PropTypes.bool,
    loadInventoryDetails: PropTypes.func,
  };

  getVisibleCloseReasons = () => {
    const { currentUser, party: { workflowName } = {} } = this.props;
    const isAdmin = isLoggedAsAdmin(currentUser);
    const isResident = workflowName === DALTypes.WorkflowName.ACTIVE_LEASE || workflowName === DALTypes.WorkflowName.RENEWAL;

    return getVisibleCloseReasons(isAdmin, isResident);
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedReasonId: null,
      closeReasons: array2DataSource(this.getVisibleCloseReasons(), DALTypes.ClosePartyReasons),
    };
  }

  componentWillMount = () => {
    const { quotes, lease, inventory } = this.props;
    if (lease && !inventory) {
      const quote = quotes.find(q => q.id === lease.quoteId);
      quote && this.props.loadInventoryDetails({ id: quote.inventory.id });
    }
  };

  handleVoidLease = () => {
    const { lease } = this.props;
    this.props.voidLease(lease.partyId, lease.id);
  };

  handleCloseParty = async () => {
    const { partyId, memberToRemoveOnClose } = this.props;
    if (memberToRemoveOnClose) {
      await this.props.removeMember(partyId, memberToRemoveOnClose.id);
    }
    await this.props.closeParty(partyId, this.state.selectedReasonId);

    this.props.leasingNavigator.navigateToDashboard();
  };

  handleClosePartyReasonSelected = ({ id }) => {
    this.setState({
      selectedReasonId: id,
    });
  };

  render() {
    const { open, onCloseRequest, lease, inventory, leaseWasVoided, leaseNotExecuted, property } = this.props;
    const isImportResidentDataOn = property?.settings?.integration?.import?.residentData;
    const { selectedReasonId } = this.state;
    let { closeReasons } = this.state;
    if (isImportResidentDataOn) {
      closeReasons = closeReasons.filter(reason => reason.text !== t(DALTypes.ClosePartyReasons.ALREADY_A_RESIDENT));
    }
    if (leaseNotExecuted) {
      return (
        <MsgBox
          open={open}
          appendToBody
          hideCancelButton
          title={t('CANNOT_CLOSE_THIS_PARTY')}
          lblOK={t('MSG_BOX_BTN_OK')}
          onCloseRequest={() => onCloseRequest(true)}
          onOKClick={() => onCloseRequest(true)}>
          <T.Text>{t('LEASE_IS_NOT_YET_EXECUTED')}</T.Text>
        </MsgBox>
      );
    }

    if (lease) {
      const inventoryType = inventory && inventory.type;
      const inventoryName = inventory && inventory.name;
      return (
        <MsgBox
          overlayClassName={cf('close-party-dialog')}
          open={open}
          appendToBody
          title={t('VOID_LEASE')}
          lblOK={t('VOID_LEASE')}
          lblCancel={t('CANCEL')}
          onCloseRequest={() => onCloseRequest(leaseWasVoided)}
          onOKClick={this.handleVoidLease}
          onCancelClick={() => onCloseRequest(true)}>
          <T.Text>{t('CLOSE_PARTY_ACTIVE_LEASE_WARNING', { inventoryType, inventoryName })}</T.Text>
        </MsgBox>
      );
    }

    return (
      <MsgBox
        overlayClassName={cf('close-party-dialog')}
        open={open}
        appendToBody
        title={t('CLOSE_PARTY_CONFIRMATION')}
        lblOK={t('CLOSE_PARTY_OK')}
        btnOKDisabled={!this.state.selectedReasonId}
        lblCancel={t('CLOSE_PARTY_CANCEL')}
        onCloseRequest={() => onCloseRequest(true)}
        onOKClick={this.handleCloseParty}>
        <T.Text>{t('CLOSE_PARTY_MESSAGE')}</T.Text>
        <Field className={cf('close-reason-label')}>
          <Dropdown
            ref="closeReasons"
            className={cf('close-party-dialog')}
            wide
            label={t('WHY_CLOSE_PARTY')}
            selectedValue={selectedReasonId}
            items={closeReasons}
            onChange={this.handleClosePartyReasonSelected}
          />
        </Field>
      </MsgBox>
    );
  }
}
