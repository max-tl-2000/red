/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { t } from 'i18next';
import { formatTimestamp } from 'helpers/date-utils';
import { updateCommunicationsByCommunicationId } from 'redux/modules/communication';
import { getCallOwner } from 'helpers/communications';

import { Icon, Typography, TextBox, AudioPlayer } from 'components';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './CallHistory.scss';

const { Caption } = Typography;

@connect(
  state => ({
    parties: state.dataStore.get('parties'),
    users: state.globalStore.get('users'),
  }),
  dispatch => bindActionCreators({ updateCommunicationsByCommunicationId }, dispatch),
)
export default class CallHistory extends Component {
  static propTypes = {
    index: PropTypes.number,
    call: PropTypes.object,
    partyId: PropTypes.string,
    parties: PropTypes.object,
    users: PropTypes.object,
    readOnly: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      edit: false,
    };
  }

  componentDidMount() {
    if (this.props.focused) this.switchToEdit();
  }

  switchToEdit = () => {
    if (!this.props.readOnly) {
      this.setState({ edit: true });
      this.noteTextBox.focus();
    }
  };

  switchToDisplay = () => {
    this.setState({ edit: false });
  };

  saveNotes = () => {
    const { notes } = this.props.call.message;
    const updatedNotes = this.noteTextBox.value;

    if (notes === updatedNotes) return;
    if (notes === undefined && updatedNotes === '') return;

    const delta = {
      message: { notes: updatedNotes },
    };

    this.props.updateCommunicationsByCommunicationId(this.props.call.id, delta);
  };

  recordingPlayed = () => {
    const { call } = this.props;
    const delta = { message: { listened: true } };
    this.props.updateCommunicationsByCommunicationId(call.id, delta);
  };

  renderCallTypeIcon({ direction, message: { isMissed, transferredToNumber, transferredToDisplayName, isCallbackRequested }, transferredFromCommId }) {
    const isTransferred = !!transferredFromCommId;
    const isTransferredToNumber = transferredToNumber && transferredToDisplayName;
    const getClass = color => cf(color, 'callIcon');
    if (isTransferred || isTransferredToNumber) {
      const iconColor = isMissed ? 'redIcon' : 'greenIcon';
      return (
        <div className={getClass(iconColor)}>
          <Icon name="call-transferred" />
        </div>
      );
    }

    if (isCallbackRequested) {
      return (
        <div className={getClass('redIcon')}>
          <Icon name="call-callback" />
        </div>
      );
    }

    if (isMissed) {
      return (
        <div className={getClass('redIcon')}>
          <Icon name="call-missed" />
        </div>
      );
    }

    switch (direction) {
      case DALTypes.CommunicationDirection.IN:
        return (
          <div className={getClass('greenIcon')}>
            <Icon name="call-received" />
          </div>
        );
      case DALTypes.CommunicationDirection.OUT:
        return (
          <div className={getClass('greenIcon')}>
            <Icon name="call-made" />
          </div>
        );
      default:
        return (
          <div className={getClass('redIcon')}>
            <Icon name="missing-icon" />
          </div>
        );
    }
  }

  renderCallCaption({
    direction,
    message: { isMissed, isVoiceMail, duration, transferredToNumber, transferredToDisplayName, isCallbackRequested },
    transferredFromCommId,
  }) {
    const getCaption = () => {
      const isTransferred = !!transferredFromCommId;
      const isTransferredToNumber = transferredToNumber && transferredToDisplayName;
      if (isTransferred || isTransferredToNumber) {
        return { text: t('CALL_TRANSFER'), displayDuration: !!duration };
      }
      if (isCallbackRequested) return { text: t('CALLBACK_REQUEST') };
      if (isVoiceMail) return { text: t('VOICE_MESSAGE') };
      if (isMissed) return { text: t('MISSED_CALL') };
      if (direction === DALTypes.CommunicationDirection.IN) {
        return { text: t('INCOMING_CALL'), displayDuration: true };
      }
      return { text: t('OUTGOING_CALL'), displayDuration: true };
    };

    const { text, displayDuration } = getCaption();

    return (
      <div className={cf('caption')}>
        <Caption>{text}</Caption>
        {displayDuration ? <Caption secondary>{duration || '00:00'}</Caption> : <noscript />}
      </div>
    );
  }

  handleExpandRecordingClick = () => this.setState({ recordingExpanded: !this.state.recordingExpanded });

  render({ index, call, partyId, parties, users, timezone, readOnly } = this.props) {
    const { notes, recordingUrl, isVoiceMail } = call.message;
    const { created_at: date } = call;
    const { edit: editMode, recordingExpanded } = this.state;
    const hasCallRecording = recordingUrl && !isVoiceMail;
    const shouldDisplayRecording = isVoiceMail || recordingExpanded;
    const callOwner = getCallOwner({ call, partyId, parties, users });
    const rowId = `rowCall${index}`;
    const notesRowId = `rowCall${index}Note`;

    return (
      <div className={cf(editMode ? 'mainEditMode' : 'mainDisplayMode')} data-id={rowId}>
        <div className={cf('firstRow')}>
          <div className={cf('callDetails')}>
            {this.renderCallTypeIcon(call)}
            <div className={cf('mainInfo')}>
              {this.renderCallCaption(call)}
              {callOwner && <Caption secondary>{callOwner}</Caption>}
            </div>
            {(hasCallRecording && (
              <div className={cf('expandIcon')} onClick={this.handleExpandRecordingClick}>
                <Icon name={recordingExpanded ? 'chevron-up' : 'chevron-down'} />
              </div>
            )) || <noscript />}
          </div>
          <Caption secondary>{formatTimestamp(date, { timezone })}</Caption>
        </div>
        {recordingUrl && (
          <div className={shouldDisplayRecording ? cf('recording', 'recordingExpanded') : cf('recording')}>
            <AudioPlayer src={recordingUrl} onPlayed={this.recordingPlayed} />
          </div>
        )}
        <div onClick={this.switchToEdit}>
          <TextBox
            dataId={notesRowId}
            placeholder={t('NOTES')}
            value={notes}
            ref={node => (this.noteTextBox = node)}
            autoResize={true}
            underline={false}
            multiline
            maxRows={10}
            className={cf(editMode ? 'notesEditMode' : 'notesDisplayMode')}
            inputClassName={cf('notes-input')}
            onChange={() => this.props.onNotesChanged && this.props.onNotesChanged()}
            onBlur={(e, { value }) => {
              this.switchToDisplay();
              this.saveNotes(value);
            }}
            disabled={readOnly}
          />
        </div>
      </div>
    );
  }
}
