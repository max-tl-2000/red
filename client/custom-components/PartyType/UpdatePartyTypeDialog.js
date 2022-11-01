/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { observer } from 'mobx-react';
import { enableUpdatePartyTypeAction } from 'redux/modules/partyStore';
import { t } from 'i18next';
import { Typography, MsgBox, Markdown, Icon } from 'components';
import { cf, g } from './UpdatePartyTypeDialog.scss';
import { PARTY_TYPES_CANNOT_BE_CHANGED_REASON } from '../../../common/helpers/party-utils';
import DialogModel from '../../containers/PartyPageUnified/DialogModel';

const { Text } = Typography;

const reasonsHash = {
  [PARTY_TYPES_CANNOT_BE_CHANGED_REASON.ACTIVE_QUOTE_PROMOTION]: {
    titleKey: 'LEASE_TYPE_MISMATCH',
    messageKey: 'PARTY_TYPES_CANNOT_BE_CHANGED_ACTIVE_QUOTE_PROMOTION_REASON',
  },
  [PARTY_TYPES_CANNOT_BE_CHANGED_REASON.MULTIPLE_MEMBERS]: {
    titleKey: 'LIMIT_ONE_PERSON',
    messageKey: 'PARTY_TYPES_CANNOT_BE_CHANGED_MULTIPLE_MEMBERS_REASON',
  },
};

@connect(
  state => ({
    isUpdatePartyTypeAllowed: state.partyStore.isUpdatePartyTypeAllowed,
    isUpdatePartyTypeNotAllowedError: state.partyStore.isUpdatePartyTypeNotAllowedError,
    updatePartyTypeNotAllowedReason: state.partyStore.updatePartyTypeNotAllowedReason,
  }),
  dispatch =>
    bindActionCreators(
      {
        enableUpdatePartyTypeAction,
      },
      dispatch,
    ),
)
@observer
export default class UpdatePartyTypeDialog extends Component {
  static propTypes = {
    isUpdatePartyTypeDialogOpen: PropTypes.bool,
    onSubmitAction: PropTypes.func,
    onDialogClosed: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      partyTypeDialog: new DialogModel(),
    };
  }

  componentWillReceiveProps(nextProps) {
    const shouldOpenDialog = nextProps.isDialogOpen || nextProps.isUpdatePartyTypeNotAllowedError;
    if (!this.partyTypeDialog.isOpen && shouldOpenDialog) {
      !this.state.closingDialog && this.partyTypeDialog.open();
    }
  }

  get partyTypeDialog() {
    return this.state.partyTypeDialog;
  }

  handleSubmitAction = async () => {
    const { onSubmitAction, isUpdatePartyTypeAllowed } = this.props;
    if (!isUpdatePartyTypeAllowed) return;
    onSubmitAction && onSubmitAction(isUpdatePartyTypeAllowed);
  };

  handleCloseDialogRequest = async () => {
    const { onDialogClosed } = this.props;
    this.setState({ closingDialog: true }, () => this.partyTypeDialog.close());
    onDialogClosed && onDialogClosed();
  };

  handleCloseDialog = () => {
    const { isUpdatePartyTypeAllowed } = this.props;
    !isUpdatePartyTypeAllowed && this.props.enableUpdatePartyTypeAction();
    this.setState({ closingDialog: false });
  };

  getDialogTitle = () => {
    const { isUpdatePartyTypeAllowed, updatePartyTypeNotAllowedReason } = this.props;
    if (isUpdatePartyTypeAllowed) return t('UPDATE_PARTY_TYPE_WARNING');

    if (!reasonsHash[updatePartyTypeNotAllowedReason]) return t('UPDATE_PARTY_TYPE_ERROR');

    return t(reasonsHash[updatePartyTypeNotAllowedReason].titleKey);
  };

  getErrorMessage = reason => t((reasonsHash[reason] || {}).messageKey || '');

  renderBody = () => {
    const { isUpdatePartyTypeAllowed, updatePartyTypeNotAllowedReason } = this.props;

    if (!isUpdatePartyTypeAllowed) return <Text>{this.getErrorMessage(updatePartyTypeNotAllowedReason)}</Text>;

    return (
      <div>
        <Markdown className={cf(g('body textPrimary'), 'suggestions')}>{`${t('CHANGING_PARTY_TYPE')}`}</Markdown>
        <div className={cf('confirmation')}>
          <Icon name="alert" />
          <Text>{t('CHANGING_PARTY_TYPE_CONFIRMATION')}</Text>
        </div>
      </div>
    );
  };

  render = ({ isUpdatePartyTypeAllowed } = this.props) => (
    <MsgBox
      id="changePartyTypeDialog"
      open={this.partyTypeDialog.isOpen}
      closeOnTapAway={false}
      title={this.getDialogTitle()}
      lblOK={t(isUpdatePartyTypeAllowed ? 'NO' : 'OK_GOT_IT')}
      lblCancel={isUpdatePartyTypeAllowed ? t('YES') : ''}
      onCancelClick={this.handleSubmitAction}
      onCloseRequest={this.handleCloseDialogRequest}
      onClose={this.handleCloseDialog}>
      <div className={cf('party-type-container')}>{this.renderBody()}</div>
    </MsgBox>
  );
}
