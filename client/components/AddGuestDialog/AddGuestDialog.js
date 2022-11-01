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
import * as personActions from 'redux/modules/personsStore';
import { t } from 'i18next';
import { Dialog, DialogOverlay, AddGuestForm } from 'components';
import * as guestActions from '../../redux/modules/memberStore';
import { DALTypes } from '../../../common/enums/DALTypes';
import enumToArray from '../../../common/enums/enumHelper';

@connect(
  state => ({
    isAddingGuests: state.memberStore.isAddingGuest,
  }),
  dispatch =>
    bindActionCreators(
      {
        ...guestActions,
        ...personActions,
      },
      dispatch,
    ),
)
export default class AddGuestDialog extends Component {
  static propTypes = {
    addGuest: PropTypes.func,
    routerState: PropTypes.object,
    loadMemberTypes: PropTypes.func,
    isAddingGuests: PropTypes.bool,
    startAddingGuests: PropTypes.func,
    endAddingGuests: PropTypes.func,
    fetchResults: PropTypes.func,
    clearResults: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.memberTypeList = enumToArray(DALTypes.MemberType);
    if (props.isAddingGuests) {
      this.open();
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.isAddingGuests) {
      this.open();
    }
  }

  open() {
    this.refs.addGuestDialog.open();
  }

  close = () => {
    const { endAddingGuests, clearResults } = this.props;
    endAddingGuests();
    clearResults();
    this.refs.addGuestDialog.close();
  };

  addGuest = guest => {
    if (!guest.keepDialog) {
      this.close();
    }
    this.props.onAddGuest(guest);
  };

  render() {
    return (
      <div>
        <Dialog ref="addGuestDialog" closeOnTapAway={false}>
          <DialogOverlay>
            <AddGuestForm
              onCancel={this.close}
              title={t('ADD_GUEST_FORM_TITLE')}
              submitText={t('ADD_GUEST_FORM_ADD')}
              submitAndKeepVisible={true}
              submitAndKeepVisibleText={t('ADD_GUEST_FORM_ADD_ANOTHER')}
              showCancel={true}
              memberType={this.props.memberType ? this.props.memberType : DALTypes.MemberType.RESIDENT}
              onSubmit={this.addGuest}
              memberTypes={this.memberTypeList}
            />
          </DialogOverlay>
        </Dialog>
      </div>
    );
  }
}
