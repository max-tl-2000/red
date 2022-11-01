/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { saveContactEvent } from 'redux/modules/communication';
import { closeFlyout } from 'redux/modules/flyoutStore';
import { bindActionCreators } from 'redux';
import { t } from 'i18next';
import { Dropdown, TextBox, Button } from 'components';
import { getContactEventTypes } from 'helpers/contactEventTypes';
import RecipientsDropdown from 'custom-components/RecipientsDropdown/RecipientsDropdown';
import { isPagePersonDetails } from 'helpers/leasing-navigator';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { YEAR_MONTH_DAY_FORMAT, TIME_MERIDIEM_FORMAT } from '../../../common/date-constants';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './WalkInThreadComponent.scss';
import { getPartyTimezone, isPartyArchived } from '../../redux/selectors/partySelectors';
import DateSelector from '../../components/DateSelector/DateSelector';
import { toMoment, now, findLocalTimezone, parseAsInTimezone } from '../../../common/helpers/moment-utils';
@connect(
  (state, props) => ({
    timezone: getPartyTimezone(state, props),
    isArchived: isPartyArchived(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        closeFlyout,
        saveContactEvent,
      },
      dispatch,
    ),
)
export default class WalkInThreadComponent extends Component {
  static propTypes = {
    participants: PropTypes.object,
    partyMembers: PropTypes.object,
    persons: PropTypes.object,
    partyId: PropTypes.string,
    contactEvent: PropTypes.object,
    saveContactEvent: PropTypes.func,
    closeFlyout: PropTypes.func,
    flyoutId: PropTypes.string,
    isArchived: PropTypes.bool,
  };

  getNotes = contactEvent => (contactEvent && contactEvent.message ? contactEvent.message.text : '');

  constructor(props) {
    super(props);
    let timeValues;
    const { timezone, contactEvent } = props;

    if (contactEvent) {
      const { message } = contactEvent;
      const parsedEventDateTime = toMoment(message.eventDateTime, { timezone });
      // Reopening an already existing Contact Event
      timeValues = this.getTimeDropdownValues(parsedEventDateTime);
      this.state = {
        selectedType: message.type,
        eventDate: parsedEventDateTime.clone().startOf('day'),
        timeValues,
        selectedTime: parsedEventDateTime.format('hh:mm a'),
        text: this.getNotes(contactEvent),
        selectedParticipants: props.participants ? props.participants.toArray().map(p => p.id) : [],
        contactEvent,
        buttonText: t('UPDATE_BUTTON'),
        threadId: contactEvent.threadId,
      };
    } else {
      const nowDate = now({ timezone });
      // New Contact Event
      timeValues = this.getTimeDropdownValues(nowDate);
      this.state = {
        eventDate: nowDate.clone().startOf('day'),
        text: '',
        timeValues,
        selectedType: getContactEventTypes()[0].id,
        selectedTime: timeValues[timeValues.length - 1].id,
        selectedParticipants: this.getSelectedParticipants(props.partyMembers),
        contactEvent: {},
        buttonText: t('SAVE_BUTTON'),
      };
    }
  }

  getSelectedParticipants = members => members.toArray().map(member => member.person.id);

  getLatestPassedHalfHour = () => {
    const { timezone } = this.props;
    const nowDate = now({ timezone });
    return nowDate.minute() >= 30 ? nowDate.startOf('hour').add(30, 'm') : nowDate.startOf('hour');
  };

  getTimeDropdownValues = currentlySelectedDate => {
    const { timezone } = this.props;

    const nowDate = now({ timezone });
    // if the DateTime is in ISO format or is a moment object we don't need to call `.tz`
    // moment will deal with the timezone differences internally and handle it correctly
    const isTodaySelected = toMoment(currentlySelectedDate).isSame(nowDate, 'day');

    let time = nowDate.startOf('day');

    const endTime = isTodaySelected ? this.getLatestPassedHalfHour() : time.clone().add(1, 'day').subtract(30, 'minute');

    const values = [];

    const includeAbbr = timezone !== findLocalTimezone();

    const timeFormat = 'hh:mm a';
    while (time <= endTime) {
      const timeFormatted = time.format(timeFormat);
      values.push({ id: timeFormatted, text: `${timeFormatted} ${includeAbbr ? time.zoneAbbr() : ''}` });

      time = time.add(30, 'm');
    }

    return values;
  };

  onDateChanged = selectedDateTime => {
    const { timezone } = this.props;
    const timeValues = this.getTimeDropdownValues(selectedDateTime);
    const alreadySelectedTime = timeValues.find(tv => tv.id === this.state.selectedTime);
    const selectedTime = alreadySelectedTime ? alreadySelectedTime.id : timeValues[timeValues.length - 1].id;

    this.setState({
      eventDate: toMoment(selectedDateTime, { timezone }).clone().startOf('day'),
      timeValues,
      selectedTime,
    });
  };

  getParticipants = () => {
    const members = this.props.partyMembers.filter(pm => this.props.persons.find(pers => pm.personId === pers.id));
    const recipientsMap = members.reduce((acc, item) => {
      const person = this.props.persons.find(p => p.id === item.personId);
      const newItem = {
        id: person.id,
        memberType: item.memberType,
        name: getDisplayName(person),
        value: '',
      };
      acc.set(item.memberType, {
        id: item.memberType,
        name: item.memberType,
        items: [...((acc.get(item.memberType) || {}).items || []), newItem],
      });
      return acc;
    }, new Map());

    return [...recipientsMap.values()];
  };

  onSaveClick = () => {
    const text = this.state.text;
    const time = this.state.timeValues.find(tm => tm.id === this.state.selectedTime).text;
    const type = this.state.selectedType;
    const { timezone } = this.props;
    const eventDate = this.state.eventDate || now({ timezone });

    const eventDateString = eventDate.format(YEAR_MONTH_DAY_FORMAT);
    const eventDateTime = parseAsInTimezone(`${eventDateString} ${time}`, { format: `${YEAR_MONTH_DAY_FORMAT} ${TIME_MERIDIEM_FORMAT}`, timezone });

    const message = { text, type, eventDateTime };
    const partyId = this.props.partyId;
    const threadId = this.state.threadId;

    const participantNames = this.getParticipants()
      .filter(participant => this.state.selectedParticipants.includes(participant.items[0].id))
      .map(selectedParticipant => selectedParticipant.items[0].name)
      .join(', ');

    const messageData = {
      type: DALTypes.CommunicationMessageType.CONTACTEVENT,
      recipients: this.state.selectedParticipants,
      partyId,
      message,
      threadId,
      contactEventType: getContactEventTypes().find(e => e.id === type).text,
      names: participantNames,
    };

    this.props.saveContactEvent(messageData);
    this.props.closeFlyout(this.props.flyoutId);
  };

  selectDropdown = () => {
    this.ddContactEventTypes.focus();
  };

  storeDropdownRef = ref => {
    this.ddContactEventTypes = ref;
  };

  isDateDisabled = day => {
    const { timezone } = this.props;
    const today = now({ timezone });
    return today.isBefore(day, 'day');
  };

  render() {
    const { timezone, isArchived } = this.props;
    const shouldEditBeEnabled = isPagePersonDetails() || isArchived;
    return (
      <div className={cf('main-content')} style={{ width: '21rem' }}>
        <RecipientsDropdown
          placeholderText={t('PARTICIPANTS_PLACEHOLDER')}
          recipients={this.getParticipants()}
          onNoMoreItemsToSelect={this.selectDropdown}
          showListOnFocus
          selectedRecipients={this.state.selectedParticipants}
          onChange={ids => {
            this.setState({ selectedParticipants: ids });
          }}
          readOnly={isArchived}
        />
        <div className={cf('header')}>
          <Dropdown
            wide
            valueField="id"
            textField="text"
            ref={this.storeDropdownRef}
            disabled={shouldEditBeEnabled}
            items={getContactEventTypes()}
            selectedValue={this.state.selectedType}
            onChange={args => {
              this.setState({ selectedType: args.ids[0] });
            }}
          />
          <div className={cf('date-controls')}>
            <DateSelector
              placeholder={t('DATE_PLACEHOLDER')}
              disabled={shouldEditBeEnabled}
              isDateDisabled={this.isDateDisabled}
              selectedDate={this.state.eventDate}
              onChange={this.onDateChanged}
              tz={timezone}
              appendToBody={false}
              format={'MMM DD, YYYY'}
            />
            <Dropdown
              placeholder="Time"
              items={this.getTimeDropdownValues(this.state.eventDate)}
              selectedValue={this.state.selectedTime}
              disabled={shouldEditBeEnabled}
              onChange={args => {
                this.setState({ selectedTime: args.ids[0] });
              }}
            />
          </div>
        </div>
        <div className={cf('messageBox')}>
          <TextBox
            placeholder={t('NOTES_FROM_CE')}
            disabled={shouldEditBeEnabled}
            autoFill
            multiline
            autoResize={false}
            value={this.getNotes(this.state.contactEvent)}
            onChange={args => {
              this.setState({ text: args.value });
            }}
          />
        </div>
        <div className={cf('bottomSection')}>
          <Button type={'flat'} onClick={this.onSaveClick} disabled={!this.state.selectedParticipants.length || shouldEditBeEnabled}>
            {this.state.buttonText}
          </Button>
        </div>
      </div>
    );
  }
}
