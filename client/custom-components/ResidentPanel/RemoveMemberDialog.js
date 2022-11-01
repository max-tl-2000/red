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
import { t } from 'i18next';
import { removeMember } from 'redux/modules/memberStore';
import { TextBox, Icon, MsgBox, Typography as T } from 'components';

import { observer, inject } from 'mobx-react';
import { cf } from './RemoveMemberDialog.scss';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { shouldCloseAfterMemberRemoval } from '../../../common/helpers/party-utils';

@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        removeMember,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class RemoveMemberDialog extends Component {
  static propTypes = {
    onMemberRemoved: PropTypes.func,
    removeMember: PropTypes.func,
    onCloseRequest: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      notes: '',
    };
  }

  isLastMemberRemoval = member => {
    const { members } = this.props;
    return shouldCloseAfterMemberRemoval(members, member);
  };

  handleRemoveMember = () => {
    const { member, onMemberRemoved } = this.props;

    this.props.removeMember(member.partyId, member.id, this.state.notes);

    onMemberRemoved && onMemberRemoved(member);
    if (this.isLastMemberRemoval(member)) {
      this.props.leasingNavigator.navigateToDashboard();
    }
  };

  handleNotesChange = ({ value }) => {
    this.setState({
      notes: value,
    });
  };

  render() {
    const { open, member, onCloseRequest } = this.props;

    return (
      <MsgBox
        open={open}
        ref="removeMemberDialog"
        closeOnTapAway={false}
        id="removeMemberDialog"
        lblOK={t('REMOVE_FROM_PARTY')}
        onOKClick={this.handleRemoveMember}
        title={t('REMOVE_MEMBER_CONFIRMATION_QUESTION', {
          name: member && getDisplayName(member.person),
        })}
        onCloseRequest={onCloseRequest}>
        {this.isLastMemberRemoval(member) && (
          <T.SubHeader secondary className={cf('subtitle')}>
            <Icon name="alert" />
            <span>{t('PARTY_REMAINS_EMPTY')}</span>
          </T.SubHeader>
        )}
        <TextBox id="removeRememberNoteTxt" label={t('NOTES')} wide onChange={this.handleNotesChange} />
      </MsgBox>
    );
  }
}
