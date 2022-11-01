/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { DALTypes } from 'enums/DALTypes';
import { getDraftsForUserAndParty } from '../../redux/modules/communicationDraftStore';
import { SMS_THREAD, EMAIL_THREAD, NEW_EMAIL } from '../../helpers/comm-flyout-types';

@connect(
  state => ({
    communicationDrafts: state.communicationDraftStore.communicationDrafts,
  }),
  dispatch =>
    bindActionCreators(
      {
        getDraftsForUserAndParty,
      },
      dispatch,
    ),
  null,
  { withRef: true },
)
export default class DraftWrapper extends Component {
  constructor(props) {
    super(props);
    this.inialized = false;
    this.state = {
      openedDrafts: new Set(),
    };
  }

  loadDrafts() {
    const { props } = this;
    const { currentUser: { id } = {}, partyId } = props;
    if (!id || !partyId) return;
    this.setState({ openedDrafts: new Set() });

    props.getDraftsForUserAndParty(id, partyId);
    this.inialized = true;
  }

  componentWillReceiveProps(nextProps) {
    const { props } = this;

    if (props.communicationDrafts === nextProps.communicationDrafts) return;

    const draftArray = Object.values(nextProps.communicationDrafts);
    draftArray.forEach(draft => this.openDraft(draft));
  }

  openDraft = draft => {
    const { props, state } = this;
    if (!draft || state.openedDrafts.has(draft.id)) return;
    switch (draft.type) {
      case DALTypes.CommunicationMessageType.SMS:
        props.openCommFlyOut({
          flyoutType: SMS_THREAD,
          props: {
            threadId: draft.threadId,
            draft,
            type: DALTypes.CommunicationMessageType.SMS,
          },
        });
        break;
      case DALTypes.CommunicationMessageType.EMAIL:
        draft.threadId
          ? props.openCommFlyOut({ flyoutType: EMAIL_THREAD, props: { threadId: draft.threadId, draft } })
          : props.openCommFlyOut({ flyoutType: NEW_EMAIL, props: { draft } });
        break;
      default:
        () => {};
    }

    // is it OK to mutate the state?
    // I know it is ok to mutate it when using mobx
    // but not when using setState. Probably a comment why this
    // update directly the object in the state would be enough here
    state.openedDrafts.add(draft.id);
  };

  render() {
    return <noscript />;
  }
}
