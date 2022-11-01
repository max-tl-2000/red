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
import $ from 'jquery';
import newId from 'uuid/v4';
import { Button, TextBox, PreloaderBlock, FlyOut, FlyOutOverlay, Icon, Typography as T, DialogActions, Dropdown, Validator } from 'components';
import { sizes, screenIsAtLeast } from 'helpers/layout';
import * as appointmentDialogActions from 'redux/modules/appointments.dialog';
import { once } from 'helpers/functional';
import notifier from 'helpers/notifier/notifier';
import { createSelector } from 'reselect';
import { searchUnits } from 'redux/modules/inventoryStore';
import unionBy from 'lodash/unionBy';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';
import { formatInventoryItems } from 'helpers/quotes';
import { formatAsPhoneIfDigitsOnly } from 'helpers/phone-utils';
import { getPropertiesForPropertySelectorDialog } from 'helpers/party';
import DaysRow from './DaysRow';
import EmployeeSelector from '../Dashboard/EmployeeSelector';
import { getPercentageOfDayElapsed, formatTimestamp } from '../../../common/helpers/date-utils';
import { locals as styles, cf } from './ScheduleAppointmentForm.scss';
import InventorySelector from '../InventorySelector/InventorySelector';
import PersonSelector from '../PersonSelector/PersonSelector';
import { DALTypes } from '../../../common/enums/DALTypes';
import { normalizeFilters } from '../../../common/helpers/filters';
import EmployeeCard from '../Dashboard/EmployeeCard';
import { enhanceAdditionalTag } from '../../helpers/inventory';
import { toHumanReadableString } from '../../../common/helpers/strings';
import { isAnonymousEmail } from '../../../common/helpers/anonymous-email';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { getParty, getPartyTimezone, getTourTypesAvailableForParty } from '../../redux/selectors/partySelectors';
import { toMoment, now, parseAsInTimezone, duration } from '../../../common/helpers/moment-utils';
import { getTourTypesForDropdown } from '../../helpers/appointments';

const toArray = entity => {
  if (!entity) {
    return [];
  }
  return entity.toArray ? entity.toArray() : entity;
};

const agentSlotDuration = 15;
const defaultTeamSlotDuration = 60;

const getPartyMembers = createSelector(
  s => s.dataStore.get('members'),
  s => s.dataStore.get('persons'),
  (s, props) => props.partyId,
  (members, persons, partyId) =>
    members
      .filter(p => p.partyId === partyId)
      .map(guest => ({
        ...guest,
        person: persons.get(guest.personId),
        type: 'face',
      })),
);

@connect(
  (state, props) => ({
    screenSize: state.screen.size,
    currentUserId: (state.auth.user || {}).id,
    loggedInUser: state.auth.user,
    events: state.appointmentsDialog.events,
    teamCalendarEvents: state.appointmentsDialog.teamCalendarEvents,
    isSaving: state.appointmentsDialog.isSaving,
    isLoading: state.appointmentsDialog.isLoading,
    error: state.appointmentsDialog.error,
    party: getParty(state, props),
    partyMembers: getPartyMembers(state, props),
    appointment: state.appointmentsDialog.appointment,
    unit: state.appointmentsDialog.unit,
    nextAgentForAppointment: state.appointmentsDialog.nextAgentForAppointment,
    users: state.globalStore.get('users'),
    quotes: state.quotes.quotes,
    timezone: getPartyTimezone(state, props),
    tourTypesAvailableInSettings: getTourTypesAvailableForParty(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        ...appointmentDialogActions,
        searchUnits,
      },
      dispatch,
    ),
)
export default class ScheduleAppointmentForm extends Component {
  static propTypes = {
    partyId: PropTypes.string,
    propertyIds: PropTypes.arrayOf(PropTypes.string),
    party: PropTypes.object,
    partyMembers: PropTypes.object,
    agents: PropTypes.array,
    events: PropTypes.object,
    selectedDate: PropTypes.any,
    selectedAgentId: PropTypes.any,
    isSaving: PropTypes.bool,
    isLoading: PropTypes.bool,
    loadEvents: PropTypes.func.isRequired,
    loadTeamSlots: PropTypes.func.isRequired,
    saveAppointment: PropTypes.func.isRequired,
    updateAppointment: PropTypes.func.isRequired,
    endAddingAppointment: PropTypes.func,
    appointment: PropTypes.object,
    unit: PropTypes.object,
    property: PropTypes.object.isRequired,
    onCancel: PropTypes.func,
    onSuccess: PropTypes.func,
    searchUnits: PropTypes.func,
    timezone: PropTypes.string,
    properties: PropTypes.array,
    nextAgentForAppointment: PropTypes.string,
    users: PropTypes.object,
    getNextAgentForAppointment: PropTypes.func,
    tourTypesAvailableInSettings: PropTypes.arrayOf(PropTypes.string),
  };

  constructor(props) {
    super(props);

    const { timezone, property } = props;
    const teamSlotDuration = property.settings ? (property.settings.calendar || {}).teamSlotDuration : defaultTeamSlotDuration;
    const selectedPartyMembers = props.appointment ? props.appointment.partyMembers : props.partyMembers;
    // some of the appointment participants might have been removed from the party but were kept in the appointment
    const availablePartyMembers = unionBy(selectedPartyMembers, toArray(props.partyMembers), 'id').map(p => ({
      ...p,
      displayName: getDisplayName(p.person),
    }));
    const units = this.getUnitsForAppointmentDropdown();
    const preselectedUnits = props.unit
      ? [props.unit.id]
      : props.appointment && props.appointment.metadata.inventories.length && props.appointment.metadata.inventories.map(unit => unit.id);
    const selectedAgentId = this.getAgentId(props.appointment) || props.party.userId;
    const selectedTeamId = this.getTeamId(props.appointment) || props.party.ownerTeam;

    const selectedTimeSlot = props.appointment && {
      start: toMoment(props.appointment.metadata.startDate, { timezone }),
      end: toMoment(props.appointment.metadata.endDate, { timezone }),
    };

    const availableTourTypes = getTourTypesForDropdown({
      storedTourType: props?.appointment?.metadata?.tourType,
      tourTypesAvailableInSettings: props?.tourTypesAvailableInSettings,
    });
    const defaultTourType = availableTourTypes.length === 1 ? availableTourTypes[0] : null;
    const selectedTourType = this.getTourType(props.appointment) || defaultTourType;
    const showTourTypesDropdown = !defaultTourType;

    this.state = {
      teamSlotDuration: duration(teamSlotDuration, 'minutes'),
      currentPane: 0,
      selectedPartyMembers: toArray(selectedPartyMembers).map(m => m.id),
      availablePartyMembers,
      selectedTimeSlot,
      displayOverlapWarning: false,
      preselectedUnits: preselectedUnits || [],
      selectedAgentId,
      selectedTeamId,
      appointmentAgentId: selectedAgentId,
      selectedDate: now({ timezone }),
      units,
      inventorySelectorPlaceholderToken: 'SCHEDULE_APPOINTMENT_FORM_UNITS',
      selectedTourType,
      availableTourTypes,
      showTourTypesDropdown,
    };

    this.scrollCalendarView = once(this.scrollCalendarView).bind(this);
    this.goToFirstStep = () =>
      this.setState({
        currentPane: 0,
      });
    this.goToSecondStep = () =>
      this.setState({
        currentPane: 1,
      });
    this.emptyArray = [];
  }

  componentDidMount() {
    this.timer = setTimeout(() => {
      const { props } = this;
      const { timezone } = props;

      this.mountFullCalendar();

      props.loadEvents({
        date: toMoment(this.state.selectedDate, { timezone }),
        agentId: this.state.selectedAgentId,
        teamId: this.state.selectedTeamId,
        timezone,
      });

      this.refs.Note.focus();
    }, 1000);
  }

  componentDidUpdate(prevProps, prevState) {
    const doneSaving = prevProps.isSaving && !this.props.isSaving;

    if (doneSaving) {
      if (this.props.error) {
        notifier.error(t(this.props.error));
      } else {
        this.displaySaveSucceededNotification();
        this.props.endAddingAppointment();
      }
    }

    const isChangeToOtherTeam = prevState.isTeam && this.state.isTeam && prevState.selectedTeamId !== this.state.selectedTeamId;

    if (isChangeToOtherTeam) {
      const { selectedTeamId, teamSlotsReqestData, teamSlotDuration } = this.state;
      const slotDuration = teamSlotDuration.asMinutes();
      const { startDate, numOfDays } = teamSlotsReqestData;
      const { timezone } = this.props;
      this.props.loadTeamSlots &&
        this.props.loadTeamSlots({
          startDate: toMoment(startDate, { timezone }),
          numOfDays,
          timezone,
          teamId: selectedTeamId,
          slotDuration,
        });
    }
    const eventsLoaded = this.props.events !== prevProps.events;
    const teamCalendarSlotsLoaded = prevProps.teamCalendarEvents !== this.props.teamCalendarEvents;
    const teamCalendarPeriodChanged = this.state.isTeam && prevState.teamSlotsReqestData !== this.state.teamSlotsReqestData;
    const changedFromUserToTeam = !prevState.isTeam && this.state.isTeam;
    const changedFromTeamToUser = !this.state.isTeam && prevState.isTeam;
    const userCalendarChangedSelectedDate = !this.state.isTeam && prevState.selectedDate !== this.state.selectedDate;

    if (eventsLoaded || teamCalendarSlotsLoaded) {
      this.getCalendarContainer().fullCalendar('refetchEvents');
    }
    if (teamCalendarPeriodChanged) {
      this.switchCalendarView(this.state.teamSlotsReqestData.startDate);
    }
    if (changedFromUserToTeam) {
      this.switchCalendarView(this.state.selectedDate);
    }
    if (changedFromTeamToUser || userCalendarChangedSelectedDate) {
      this.switchCalendarView(this.state.selectedDate);
    }

    this.selectableSlot = $('td.fc-widget-content:nth-child(2)', this.domRef);
    this.setSlotHoverEffects();

    this.enhanceTimeStampsWithMiddayInfo();
    this.enhanceEvents();
  }

  enhanceTimeStampsWithMiddayInfo = () => {
    const timeStamps = $('div.fc-slats tr', this.domRef);
    const { timezone } = this.props;

    timeStamps.each((i, row) => {
      const timeValue = $(row).attr('data-time');
      const middayInfo = parseAsInTimezone(timeValue, { format: 'H:mm:ss', timezone }).format('a');
      const timeElement = $('span', $(row));
      timeElement.removeClass('am pm');
      timeElement.addClass(middayInfo);
    });
  };

  enhanceEvents = () => {
    const eventElements = $('.fc-event-container > a');

    // events that are moved to the left are overlapping others, they neeed a special css class
    // except selection event
    eventElements
      .filter((_, el) => !$(el).hasClass('fc-helper'))
      .filter((_, el) => $(el).css('left') !== '0px')
      .each((_, el) => $(el).addClass('overlapping'));

    if (this.state.isTeam) return;

    const toPositionParams = element => {
      const getValue = name => parseInt($(element).css(name), 10);
      return {
        left: getValue('left'),
        top: getValue('top'),
        height: getValue('height'),
      };
    };

    const eventsPositions = eventElements.toArray().map(toPositionParams);
    eventElements.each((_, el) => {
      const titleHeight = 18;
      const overlapAtTitleLevel = (p1, p2) => p1.top + titleHeight >= p2.top && p1.top <= p2.top + p2.height;
      const isRightNeighbour = (p1, p2) => p1.left < p2.left;
      const isOverlappingRightNeighbour = (p1, p2) => isRightNeighbour(p1, p2) && overlapAtTitleLevel(p1, p2);

      const elementPosition = toPositionParams(el);
      const overlappingEvents = eventsPositions.filter(p => isOverlappingRightNeighbour(elementPosition, p));

      const nextOverlappingEvent = sortBy(overlappingEvents, 'left')[0];
      const titleElement = $('.fc-title', $(el));
      if (nextOverlappingEvent) {
        const marginThreshold = 10;
        const width = nextOverlappingEvent.left - elementPosition.left - marginThreshold;
        // set width to force text-overflow: ellipsis, because neighbour event elements are on diffrent z-indexes
        titleElement.width(width);
      } else titleElement.width('auto'); // set the title width back to original value if it no longer has neighbours
    });
  };

  setSlotHoverEffects = () => {
    if (this.state.isTeam) {
      this.selectableSlot.off('mousemove');
      this.selectableSlot.on('mousemove', this.slotHoverHandler);
    } else {
      this.selectableSlot.off('mouseMove');
      this.selectableSlot.removeClass('firstZone secondZone thirdZone');
      this.selectableSlot.addClass('oneZone');
    }
  };

  slotHoverHandler = event => {
    const zone = Math.floor(event.offsetX / (event.currentTarget.offsetWidth / 3));
    const zoneClass = () => {
      if (zone === 0) return 'firstZone';
      if (zone === 1) return 'secondZone';
      return 'thirdZone';
    };

    this.selectableSlot.removeClass('oneZone firstZone secondZone thirdZone');
    this.selectableSlot.addClass(zoneClass());
  };

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  disableMultiSlotSelect = () => this.getCalendarContainer().mouseup();

  switchCalendarView = day => {
    const { isTeam } = this.state;
    const switchToAgentCalenar = () => {
      this.getCalendarContainer().fullCalendar('changeView', 'agendaDay');
      $('.fc-agendaDay-view').addClass(cf('noDayBorder'));
      this.getCalendarContainer().fullCalendar('gotoDate', day);
    };
    const switchToTeamCalendar = () => {
      this.getCalendarContainer().fullCalendar('changeView', 'teamAgenda');
      this.getCalendarContainer().fullCalendar('gotoDate', day);
    };
    isTeam ? switchToTeamCalendar() : switchToAgentCalenar();
  };

  filterPartyMembersByContactInfo = filterExpression => {
    const { availablePartyMembers, selectedPartyMembers } = this.state;
    const partyMembers = availablePartyMembers.filter(pm => selectedPartyMembers.some(partyMemberId => partyMemberId === pm.id));
    return partyMembers.filter(({ person }) => filterExpression(person.contactInfo));
  };

  get membersWithoutEmailAndPhone() {
    return this.filterPartyMembersByContactInfo(contactInfo => !contactInfo.defaultEmail && !contactInfo.defaultPhone);
  }

  get membersOnlyWithAnonymousEmail() {
    return this.filterPartyMembersByContactInfo(
      contactInfo => contactInfo.defaultEmail && isAnonymousEmail(contactInfo.defaultEmail) && !contactInfo.defaultPhone,
    );
  }

  displaySaveSucceededNotification() {
    const { timezone } = this.props;
    const { appointmentAgentId } = this.state;
    const user = this.props.agents.filter(u => u.id === appointmentAgentId)[0];
    const formatKey = user.id === this.props.currentUserId ? 'SCHEDULE_APPOINTMENT_FORM_SCHEDULED_FOR_SELF' : 'SCHEDULE_APPOINTMENT_FORM_SCHEDULED_FOR_OTHER';
    const formatParams = {
      agent: `${user.fullName || user.preferredName}`, // no need of getDisplayName here as users here are leasing agents
      time: formatTimestamp(this.state.selectedTimeSlot.start, { timezone }),
    };

    const { onSuccess } = this.props;
    onSuccess && onSuccess(t(formatKey, formatParams));
  }

  getCalendarContainer = () => $(this.scheduleContainer);

  updateSelectedTimeslot(selectedTimeSlot) {
    let isSelectedTimeInPast = false;
    let hasDateChanged = false;
    const { timezone, appointment } = this.props;
    if (selectedTimeSlot && appointment) {
      isSelectedTimeInPast = now({ timezone }).isAfter(toMoment(selectedTimeSlot.start, { timezone }), 'minute');
      hasDateChanged = !toMoment(appointment.metadata.startDate, { timezone }).isSame(selectedTimeSlot.start);
    }

    this.setState({
      displayOverlapWarning: false,
      selectedTimeSlot,
      isSelectedTimeInPast,
      hasAppointmentDateChanged: hasDateChanged,
    });
  }

  addSyleByEventType(event, element) {
    const { timezone } = this.props;

    const isPast = toMoment(event.start, { timezone }).isBefore(now({ timezone }));

    element.addClass(isPast ? 'past' : 'future');
    event.type === DALTypes.CalendarEventTypes.APPOINTMENT && element.addClass(cf({ appointmentEventPast: isPast, appointmentEvent: !isPast }));
    event.type === DALTypes.CalendarEventTypes.PERSONAL && element.addClass(cf({ personalEventPast: isPast, personalEvent: !isPast }));
    event.type === DALTypes.CalendarEventTypes.TEAM && element.addClass(cf({ teamEventPast: isPast, teamEvent: !isPast }));
    event.type === DALTypes.CalendarEventTypes.ALL_AGENTS_BUSY && element.addClass(cf({ allBusyEventPast: isPast, allBusyEvent: !isPast }));
  }

  joinContiguousTeamEvents = events =>
    sortBy(events, e => e.start).reduce((acc, current, idx) => {
      if (idx === 0) return [current];
      const [last] = acc.slice(-1);
      const prevs = acc.slice(0, acc.length - 1);

      const rightNow = now();
      const sameSideOfNow =
        (last.start.isBefore(rightNow) && current.start.isBefore(rightNow)) || (last.start.isAfter(rightNow) && current.start.isAfter(rightNow));

      if (last.end.isSame(current.start) && sameSideOfNow) return [...prevs, { ...last, end: current.end }];
      return [...acc, current];
    }, []);

  getTeamCalendarEvents = timezone =>
    this.joinContiguousTeamEvents(
      this.props.teamCalendarEvents
        .filter(e => (!e.isTeamEvent && !e.availableAgents.length) || e.isTeamEvent)
        .map(e => ({
          start: toMoment(e.startDate, { timezone }),
          end: toMoment(e.endDate, { timezone }),
          type: DALTypes.CalendarEventTypes.ALL_AGENTS_BUSY,
        })),
    );

  getAgentCalendarEvents = timezone => {
    const enhanceAppointmentObject = appointment => {
      const start = toMoment(appointment.metadata.startDate, { timezone });
      const end = toMoment(appointment.metadata.endDate, { timezone });

      const title =
        appointment.guests.length === 0
          ? t('SCHEDULE_APPOINTMENT_FORM_APPOINTMENT_WITHOUT_PARTICIPANTS')
          : appointment.guests.map(item => formatAsPhoneIfDigitsOnly(item)).join(', ');
      return {
        id: appointment.id,
        title: `${title}, ${start.format('h:mm')} - ${end.format('h:mm a')}`,
        start,
        end,
        type: DALTypes.CalendarEventTypes.APPOINTMENT,
      };
    };

    const appointments = this.props.events.appointments || [];
    const appointmentEvents = appointments
      .filter(appointment => !this.props.appointment || this.props.appointment.id !== appointment.id)
      .map(enhanceAppointmentObject);

    const userEvents = (this.props.events.userEvents || []).map(e => ({
      id: e.id,
      title: t('PERSONAL_EVENT'),
      start: toMoment(e.startDate, { timezone }),
      end: toMoment(e.endDate, { timezone }),
      type: DALTypes.CalendarEventTypes.PERSONAL,
    }));

    const sickLeaveEvents = (this.props.events.sickLeaveEvents || []).map(e => ({
      id: e.id,
      title: t('SICK_LEAVE'),
      start: toMoment(e.startDate, { timezone }),
      end: toMoment(e.endDate, { timezone }),
      type: DALTypes.CalendarEventTypes.PERSONAL,
    }));

    const teamEvents = (this.props.events.teamEvents || []).map(e => ({
      id: e.id,
      title: t('UNAVAILABLE'),
      start: toMoment(e.startDate, { timezone }),
      end: toMoment(e.endDate, { timezone }),
      type: DALTypes.CalendarEventTypes.TEAM,
    }));
    return [...appointmentEvents, ...userEvents, ...sickLeaveEvents, ...teamEvents];
  };

  fcSelect = (start, end) => {
    const { timezone } = this.props;
    start = parseAsInTimezone(start.format(), { timezone });
    end = parseAsInTimezone(end.format(), { timezone });
    this.updateSelectedTimeslot({
      start,
      end,
    });
  };

  fcUnselect = () => {
    this.setState({ openFlyout: false });
    this.updateSelectedTimeslot(null);
  };

  enhanceSelectionEvent = event => {
    // this enhancement is needed so that fullCalendar accepts drag/resize for the selection
    if (!event._start) {
      event._start = event.start.clone();
      event._end = event.end.clone();
    }
    if (!event.id) {
      event.id = newId();
      event._id = event.id;
    }
  };

  makeOnlyAgentViewSelectionEditable = (event, isSelection, isTeamView) => {
    if (isSelection && !isTeamView) return;
    event.startEditable = false;
    event.durationEditable = false;
  };

  enhanceSelectionDisplay = (start, end, element) => {
    const overlappingEvents = this.getCalendarContainer()
      .fullCalendar('clientEvents')
      .filter(
        e =>
          (start.isSameOrAfter(e.start) && start.isBefore(e.end)) ||
          (end.isAfter(e.start) && end.isSameOrBefore(e.end)) ||
          (start.isBefore(e.start) && end.isAfter(e.end)),
      );

    const overlapsEvents = overlappingEvents.length > 0;

    if (overlapsEvents) element.addClass('overlapping-selection');
    else element.removeClass('overlapping-selection');
  };

  fcEventRender = (event, element) => {
    const isSelection = event.className.indexOf('fc-helper') >= 0;
    const { isTeam, selectedTeamId, teamSlotDuration } = this.state;
    this.makeOnlyAgentViewSelectionEditable(event, isSelection, isTeam);

    if (!isSelection) {
      this.addSyleByEventType(event, element);
      return;
    }

    const { getNextAgentForAppointment, timezone, teamCalendarEvents } = this.props;
    const selectedSlotStartMoment = parseAsInTimezone(event.start.format(), { timezone });
    const selectedSlotEndMoment = parseAsInTimezone(event.end.format(), { timezone });
    this.selectionEvent = { start: selectedSlotStartMoment, end: selectedSlotEndMoment };

    this.enhanceSelectionEvent(event);
    this.enhanceSelectionDisplay(selectedSlotStartMoment, selectedSlotEndMoment, element);

    const selectedSlotTitle = isTeam
      ? ''
      : t('SCHEDULE_APPOINTMENT_FORM_SELECTED_SLOT_FORMAT', {
          minutes: event.end.diff(event.start, 'minute'),
        });

    const titleElement = element.find('span');
    titleElement.html(selectedSlotTitle);

    if (!isTeam) return;

    const selectAgentButton = this.addSelectAgentButton(element);

    this.disableMultiSlotSelect();
    getNextAgentForAppointment({ teamId: selectedTeamId, timezone, startDate: selectedSlotStartMoment.toDate(), slotDuration: teamSlotDuration.asMinutes() });

    const teamEvent = teamCalendarEvents.find(e => toMoment(e.startDate, { timezone }).isSame(selectedSlotStartMoment));
    const availableAgentIds = (teamEvent && teamEvent.availableAgents) || [];
    this.setState({ selectedSlotTitleElement: titleElement, availableAgentIds, selectAgentButton });
  };

  addSelectAgentButton = slotElement => {
    const selectAgentIcon = $(`
      <svg width="18" height="18">
        <path d="M7.4,8.6l4.6,4.6l4.6-4.6L18,10l-6,6l-6-6L7.4,8.6z" stroke="white" fill="white" transform="scale(0.75)" />
      </svg>
    `);
    selectAgentIcon.addClass(cf('select-agent-icon'));

    const selectAgentButton = $('<div />');
    selectAgentButton.addClass(cf('select-agent-button'));
    selectAgentButton.on('click', () => this.setState({ openFlyout: true }));

    $(slotElement).append(selectAgentIcon, selectAgentButton);
    return selectAgentIcon;
  };

  fcEvents = (startDate, endDate, timezone, callback) => {
    this.setState({
      displayOverlapWarning: false,
    });

    const events = this.state.isTeam ? this.getTeamCalendarEvents(timezone) : this.getAgentCalendarEvents(timezone);
    callback(events);
  };

  createOverlappingSelection = (fcEvent, jsEvent, slotDuration) => {
    const clickedEventDuration = duration(fcEvent.end.diff(fcEvent.start)).asMinutes();
    const offset = Math.floor(clickedEventDuration * (jsEvent.offsetY / jsEvent.currentTarget.offsetHeight));
    const roundedOffset = offset - (offset % slotDuration);

    const start = fcEvent.start.clone().add(roundedOffset, 'm');
    const end = start.clone().add(slotDuration, 'm');

    this.getCalendarContainer().fullCalendar('select', start, end);
  };

  fcEventClick = (event, jsEvent) => {
    const isSelection = event.className.indexOf('fc-helper') >= 0;
    const { isTeam } = this.state;
    if (!isSelection && !isTeam) this.createOverlappingSelection(event, jsEvent, agentSlotDuration);
  };

  formatAsTimeOnly = (d, timezone) => now({ timezone }).startOf('day').add(d).format('HH:mm:ss');

  fcEventMoved = () =>
    // need to make selection in another cycle to for proper rendering ... because fullCalendar.
    setTimeout(() => this.getCalendarContainer().fullCalendar('select', this.selectionEvent.start, this.selectionEvent.end));

  fcUnselectCurrentSlot = () => this.getCalendarContainer().fullCalendar('unselect');

  initializeFullCalendar(defaultDate) {
    const { formatAsTimeOnly, props, state } = this;
    const { timezone } = props;
    const { teamSlotDuration } = state;

    this.getCalendarContainer().fullCalendar({
      defaultDate,
      defaultView: 'agendaDay',
      views: {
        teamAgenda: {
          type: 'agenda',
          duration: { days: 3 },
          slotDuration: formatAsTimeOnly(teamSlotDuration), // this value comes from config it will be have to be changed in the config directly
        },
      },
      slotLabelFormat: 'h:mm',
      slotDuration: formatAsTimeOnly(duration(agentSlotDuration, 'minutes')), // slot duration is expected to be like 00:30:00
      timezone,
      height: 'auto',

      selectHelper: true,
      now: now({ timezone }),
      nowIndicator: true,
      selectable: true,
      select: this.fcSelect,
      unselectAuto: false,
      unselect: this.fcUnselect,
      eventClick: this.fcEventClick,

      eventStartEditable: true,
      eventDurationEditable: true,

      eventDragStart: this.fcUnselectCurrentSlot,
      eventResizeStart: this.fcUnselectCurrentSlot,
      eventDragStop: this.fcEventMoved,
      eventResizeStop: this.fcEventMoved,

      eventRender: this.fcEventRender,
      eventAfterAllRender: this.scrollCalendarView,
      events: this.fcEvents,
    });
  }

  mountFullCalendar() {
    const { props } = this;
    const { state } = this;
    const { appointment, timezone } = props;

    // RR: Timezone verification: check if timezone is needed here
    const defaultDate = appointment ? toMoment(appointment.metadata.startDate, { timezone }) : now({ timezone });
    this.initializeFullCalendar(defaultDate.clone());
    $('.fc-agendaDay-view').addClass(cf('noDayBorder'));

    if (appointment && appointment.userIds[0] === state.appointmentAgentId) {
      this.getCalendarContainer().fullCalendar('select', state.selectedTimeSlot.start, state.selectedTimeSlot.end);
      this.setState({
        // RR: Timezone verification: check if the timezone is needed here
        selectedDate: defaultDate,
      });
    }
  }

  scrollCalendarView(view) {
    const { appointment, timezone } = this.props;
    const exactDate = appointment ? toMoment(appointment.metadata.startDate, { timezone }) : now({ timezone });
    const scrollToDate = exactDate.minute(exactDate.minute() - (exactDate.minute() % 30)).second(0);

    const oneHourAsPercentage = 100 / 24;
    const totalCalendarHeight = view.el[0].clientHeight;
    const scrollToPercentage = getPercentageOfDayElapsed(scrollToDate) - oneHourAsPercentage;

    this.scheduleContainer.scrollTop = (totalCalendarHeight * scrollToPercentage) / 100;
  }

  onSelectedAgentChanged = selectedItem => {
    this.refs.employeeSelectorFlyout.close();
    this.getCalendarContainer().fullCalendar('refetchEvents');

    const selectedAgentId = selectedItem.userId;
    const selectedTeamId = selectedItem.teamId || (selectedItem.isTeam && selectedItem.id);
    const isTeam = selectedItem.isTeam;

    if (selectedAgentId !== this.state.selectedAgentId || selectedTeamId !== this.state.selectedTeamId) {
      this.getCalendarContainer().fullCalendar('refetchEvents');
      this.setState({
        selectedAgentId,
        selectedTeamId,
        isTeam,
        appointmentAgentId: isTeam ? null : selectedAgentId,
      });

      const { props } = this;
      const { timezone } = props;

      !isTeam && props.loadEvents({ date: toMoment(this.state.selectedDate, { timezone }), agentId: selectedAgentId, teamId: selectedTeamId, timezone });
    }
  };

  onTeamCalendarAgentSelected = selectedItem => {
    const { selectedSlotTitleElement } = this.state;
    this.setState({ openFlyout: false, appointmentAgentId: selectedItem.userId });
    selectedSlotTitleElement.html(selectedItem.fullName);
  };

  componentWillReceiveProps = nextProps => {
    const { nextAgentForAppointment, users } = nextProps;
    const { isTeam, selectedSlotTitleElement } = this.state;

    if (nextAgentForAppointment && isTeam) {
      this.setState({ appointmentAgentId: nextAgentForAppointment });
      const agent = users.get(nextAgentForAppointment);
      selectedSlotTitleElement.html(agent.fullName);
    }
  };

  onDayChanged = day => {
    if (day !== this.state.selectedDate) {
      this.setState({
        selectedDate: day,
      });
      const { props } = this;
      const { timezone } = props;

      props.loadEvents({ date: toMoment(day, { timezone }), agentId: this.state.selectedAgentId, teamId: this.state.selectedTeamId, timezone });
    }

    if (this.state.selectedTimeSlot) {
      this.getCalendarContainer().fullCalendar('select', this.state.selectedTimeSlot.start, this.state.selectedTimeSlot.end);
    }
  };

  onPeriodChanged = (startDate, numOfDays, selectedDate) => {
    const { selectedTeamId: teamId, teamSlotDuration } = this.state;
    const slotDuration = teamSlotDuration.asMinutes();
    const { timezone } = this.props;
    this.setState({ teamSlotsReqestData: { startDate, numOfDays }, selectedDate });
    this.props.loadTeamSlots && this.props.loadTeamSlots({ startDate: toMoment(startDate, { timezone }), numOfDays, timezone, teamId, slotDuration });
  };

  getOverlappingEvents = (startDate, endDate) =>
    this.getCalendarContainer()
      .fullCalendar('clientEvents')
      .filter(event => event.start.isBefore(endDate))
      .filter(event => event.end.isAfter(startDate));

  handleUpdateAppointment = (appointment, propertiesForSelector) => {
    const { onUpdateAppointment } = this.props;
    onUpdateAppointment && onUpdateAppointment(appointment, propertiesForSelector);
  };

  handleSaveAppointment = (appointment, propertiesForSelector) => {
    const { onSaveAppointment } = this.props;
    onSaveAppointment && onSaveAppointment(appointment, propertiesForSelector);
  };

  saveAppointment = () => {
    const appointmentProp = this.props.appointment;
    const isUpdating = appointmentProp;

    const { selectedTimeSlot, unitsInputValue, preselectedUnits, displayOverlapWarning, selectedPartyMembers, selectedTourType } = this.state;
    const { properties: allProperties, party, propertyIds } = this.props;
    const unitsOnAppointmentPropertyIds = unitsInputValue && unitsInputValue.items.map(unit => unit.propertyId);
    const { favoriteUnitsPropertyIds } = party;

    const propertiesForSelector = getPropertiesForPropertySelectorDialog(allProperties, {
      preferredPropertyIds: propertyIds,
      unitsOnAppointmentPropertyIds,
      favoriteUnitsPropertyIds,
      assignedPropertyId: party.assignedPropertyId,
    });

    const properties = unitsInputValue ? unitsInputValue.ids : preselectedUnits;

    if (this.membersWithoutEmailAndPhone.length) this.props.onOpenWarning(this.membersWithoutEmailAndPhone, true);

    const startDate = selectedTimeSlot.start;
    const endDate = selectedTimeSlot.end;

    const overlapingEvents = this.getOverlappingEvents(startDate, endDate);

    if (!overlapingEvents.length || displayOverlapWarning) {
      this.setState({
        displayOverlapWarning: false,
      });

      if (isUpdating) {
        const appointment = {
          id: appointmentProp.id,
          metadata: {
            startDate,
            endDate,
            note: this.refs.Note.value,
            partyMembers: selectedPartyMembers,
            inventories: properties,
            tourType: selectedTourType,
            teamId: this.state.selectedTeamId,
          },
          partyId: appointmentProp ? appointmentProp.partyId : this.props.partyId,
          userIds: [this.state.appointmentAgentId],
          hasAppointmentDateChanged: this.state.hasAppointmentDateChanged,
        };
        this.handleUpdateAppointment(appointment, propertiesForSelector);
      } else {
        // TODO: why add appointment looks different than update appointment?
        const appointment = {
          startDate,
          endDate,
          note: this.refs.Note.value,
          partyMembers: this.state.selectedPartyMembers,
          properties,
          partyId: appointmentProp ? appointmentProp.partyId : this.props.partyId,
          salesPersonId: this.state.appointmentAgentId,
          tourType: selectedTourType,
          teamId: this.state.selectedTeamId,
        };
        this.handleSaveAppointment(appointment, propertiesForSelector);
      }
    } else {
      this.setState({
        displayOverlapWarning: true,
      });
    }
  };

  onUnitsInputChanged = unitsInputValue => {
    this.setState({
      unitsInputValue,
    });
  };

  shouldShowAsTwoPane() {
    return screenIsAtLeast(this.props.screenSize, sizes.small2);
  }

  onGuestListChanged = value => {
    this.setState({ selectedPartyMembers: (value && value.ids) || [] });
  };

  onSelectedTourTypeChanged = tourType => {
    this.setState({ selectedTourType: tourType?.id });
  };

  getUnitsForAppointmentDropdown() {
    const units = [];

    if (this.props.unit) {
      units.push(this.props.unit);
    }

    if (this.props.appointment && this.props.appointment.metadata.inventories && this.props.appointment.metadata.inventories.length) {
      units.push(...this.props.appointment.metadata.inventories);
    }

    return units;
  }

  getAgentId = appointment => (appointment ? appointment.userIds[0] : this.state && this.state.selectedAgentId);

  getTeamId = appointment => (appointment ? appointment.metadata.teamId : this.state && this.state.selectedTeamId);

  getTourType = appointment => appointment?.metadata?.tourType || this?.state?.selectedTourType;

  getResultsBasedOnQuery = async ({ query }) => {
    let filters = normalizeFilters({ propertyIds: this.props.propertyIds });
    if (query) {
      filters = { ...filters, query };
    } else {
      // this will be helpful for the callSourceOnFocus prop in the InventorySelector, it will get units with state = 'model'
      // moreover, it will work only when the query is empty.
      filters = {
        ...filters,
        withoutLimit: true,
        inventoryStates: [DALTypes.InventoryState.MODEL],
      };
    }

    const res = (await this.props.searchUnits(filters)) || {};
    if (res) {
      const { partyAppointments, quotes, party } = this.props;
      const { metadata: { favoritedUnits } = {} } = party || {};

      res.data = enhanceAdditionalTag(res.data, partyAppointments, quotes, favoritedUnits);

      const inventoryItems = formatInventoryItems(res.data, DALTypes.InventorySelectorCases.SCHEDULE_APPOINTMENT);
      const inventorySelectorPlaceholderToken = inventoryItems.length ? 'SCHEDULE_APPOINTMENT_FORM_UNITS' : 'SCHEDULE_APPOINTMENT_FORM_UNITS_EMPTY_RESPONSE';

      this.setState({ inventorySelectorPlaceholderToken });

      return inventoryItems;
    }
    throw new Error('Old search request received - discarding');
  };

  handleEmployeeSelectorAnimation = ({ open, animProps }) => {
    animProps.animation = {
      // eslint-disable-line no-param-reassign
      scaleY: open ? 1 : 0,
      opacity: open ? 1 : 0,
      translateY: open ? 0 : '-10%',
      transformOriginX: ['50%', '50%'],
      transformOriginY: ['0', '0'],
    };
  };

  storeInventorySelectorRef = ref => {
    this.inventorySelectorRef = ref;
  };

  selectNext = () => {
    this.inventorySelectorRef.getWrappedInstance().focus();
  };

  renderWarningMessage = members => {
    if (!members.length) return null;

    const memberNames = toHumanReadableString(members.map(member => getDisplayName(member.person)));
    return (
      <div className={cf('formRowPadded')}>
        <Validator style={{ marginTop: '10px' }} visible forceSentenceCase={false}>
          {t('ANONYMOUS_EMAIL_MESSAGE_FOR_APPOINTMENT', {
            count: members.length,
            memberNames,
          })}
        </Validator>
      </div>
    );
  };

  renderDialogActions = shouldShowAsTwoPane => {
    const { onCancel, appointment } = this.props;
    const hasDateChangedAndIsInFuture = this.state.hasAppointmentDateChanged && !this.state.isSelectedTimeInPast;
    const currentMembers = appointment ? appointment.metadata.partyMembers : [];
    const hasMembersOrDateChanged = !isEqual(this.state.selectedPartyMembers.sort(), currentMembers.sort()) || hasDateChangedAndIsInFuture;
    const isDoneButtonDisabled =
      !this.state.appointmentAgentId || this.state.selectedPartyMembers.length === 0 || !this.state.selectedTimeSlot || !this.state.selectedTourType;

    return (
      <DialogActions className={cf('actions')} dividerOnTop balancedItems={this.state.currentPane === 1 && !shouldShowAsTwoPane}>
        {hasMembersOrDateChanged && (
          <T.Caption className={cf('email-msg-caption')} secondary inline>
            {t('APPOINTMENT_NOTIFICATION_MSG')}
          </T.Caption>
        )}
        {this.state.currentPane === 1 && !shouldShowAsTwoPane && (
          <Button type="flat" useWaves={true} label={t('BACK')} btnRole="secondary" onClick={this.goToFirstStep} />
        )}
        <div>
          <Button id="cancelAppointmentDialog" type="flat" btnRole="secondary" useWaves={true} label={t('CANCEL')} onClick={onCancel} />
          {(shouldShowAsTwoPane || this.state.currentPane === 1) && (
            <Button id="done" type="flat" useWaves={true} onClick={this.saveAppointment} label={t('DONE')} disabled={isDoneButtonDisabled} />
          )}
          {this.state.currentPane === 0 && !shouldShowAsTwoPane && (
            <Button type="flat" onClick={this.goToSecondStep} label={t('NEXT')} disabled={this.state.selectedPartyMembers.length === 0} />
          )}
        </div>
      </DialogActions>
    );
  };

  render({ isSaving, isLoading, appointment, timezone } = this.props) {
    const shouldShowAsTwoPane = this.shouldShowAsTwoPane();

    const containerStyles = cf(`formContainer step${this.state.currentPane}`, {
      narrow: !shouldShowAsTwoPane,
    });

    const formTitle = appointment ? t('SCHEDULE_APPOINTMENT_FORM_EDIT_APPOINTMENT') : t('SCHEDULE_APPOINTMENT_FORM_ADD_APPOINTMENT');
    const preselectedDate = appointment ? toMoment(appointment.metadata.startDate, { timezone }) : now({ timezone });
    const isToday = now({ timezone }).isSame(toMoment(this.state.selectedDate, { timezone }), 'day');

    const { selectAgentButton, availableAgentIds, showTourTypesDropdown } = this.state;

    return (
      <div className={containerStyles} id="scheduleAppointment" ref={ref => (this.domRef = ref)}>
        {this.state.openFlyout && this.renderAvailableTeamAgents(selectAgentButton, availableAgentIds)}
        <div className={styles.formColumnsWrapper}>
          <div className={styles.formColumn}>
            <div className={cf('formRowHeading firstPane')}>
              <T.Title data-id={formTitle}>{formTitle}</T.Title>
            </div>
            {showTourTypesDropdown && (
              <div className={cf('formRowPadded hoverable')} data-id="tourTypes">
                <Dropdown
                  id="dropdownTourType"
                  label={t('SCHEDULE_APPOINTMENT_FORM_TOUR_TYPES')}
                  requiredMark="*"
                  required
                  wide
                  valueField="id"
                  textField="text"
                  disabled={false}
                  items={this.state.availableTourTypes}
                  onChange={this.onSelectedTourTypeChanged}
                  selectedValue={this.state.selectedTourType}
                />
              </div>
            )}
            <div className={cf('formRowPadded hoverable')} data-id="guests">
              <PersonSelector
                placeholder={t('SCHEDULE_APPOINTMENT_FORM_GUESTS')}
                selectedValue={this.state.selectedPartyMembers}
                handleChange={this.onGuestListChanged}
                onNoMoreItemsToSelect={this.selectNext}
                items={this.state.availablePartyMembers}
                showListOnFocus={true}
              />
            </div>
            <div className={cf('formRowPadded hoverable')} data-id="units">
              <InventorySelector
                placeholder={t(this.state.inventorySelectorPlaceholderToken)}
                ref={this.storeInventorySelectorRef}
                selectedValue={this.state.preselectedUnits}
                handleChange={this.onUnitsInputChanged}
                items={this.state.units}
                selectedChipText="fullQualifiedName"
                callSourceOnFocus={true}
                source={this.getResultsBasedOnQuery}
                showFooter
                templateType={DALTypes.InventorySelectorCases.SCHEDULE_APPOINTMENT}
              />
            </div>
            <div className={cf('formRowPadded flexAll overflowYScroll notesField hoverable')}>
              <TextBox
                placeholder={t('SCHEDULE_APPOINTMENT_FORM_NOTES')}
                value={appointment ? appointment.metadata.note : ''}
                multiline={true}
                autoResize={false}
                autoFill
                ref="Note"
                dataId="apptNotes"
              />
            </div>
            {this.renderWarningMessage(this.membersOnlyWithAnonymousEmail)}
            {!shouldShowAsTwoPane && this.renderWarningsAndErrors()}
          </div>
          <div className={cf('formColumn', { today: isToday })}>
            {this.renderSalesPeople()}
            <div data-id="fullCalendarHeader" className={cf('formRow weekRow')}>
              <DaysRow
                timezone={timezone}
                onDayChanged={this.onDayChanged}
                onChangePeriodNonSelectableDay={this.onPeriodChanged}
                preselectedDate={preselectedDate}
                numberOfDays={this.state.isTeam ? 3 : 7}
                isDaySelectable={!this.state.isTeam}
              />
            </div>
            <div id="calendarRow" className={cf('formRow flex scrollable')}>
              {isLoading && <PreloaderBlock modal />}
              <div
                className={cf('scheduleRow')}
                ref={c => {
                  this.scheduleContainer = c;
                }}
                data-id="fullCalendar"
              />
            </div>
            {this.renderWarningsAndErrors()}
          </div>
        </div>
        {this.renderDialogActions(shouldShowAsTwoPane)}
        {isSaving && <PreloaderBlock modal />}
      </div>
    );
  }

  renderSalesPeople({ agents } = this.props) {
    if (!agents.length) {
      return null;
    }
    const { loggedInUser } = this.props;
    const { allUsers = [], allTeams = [], users = [] } = this.props.selectorData;
    let item;
    if (this.state.selectedTeamId && !this.state.isTeam) {
      item = allUsers.find(u => u.id === this.state.selectedAgentId && u.currentTeamId === this.state.selectedTeamId) || {};
    } else if (this.state.isTeam) {
      item = allTeams.find(te => te.id === this.state.selectedTeamId);
    } else {
      item = allUsers.find(u => u.id === this.state.selectedAgentId) || {};
    }
    const propertyTeams = allTeams.filter(team => team.associatedProperties.find(p => p.id === this.props.party.assignedPropertyId));

    return (
      <div className={cf('formRowHeading')}>
        <div data-id="agent-selector" className={cf('agent-selector')}>
          <FlyOut ref="employeeSelectorFlyout" expandTo="bottom-right" overTrigger>
            <Button type="wrapper" className={cf('dropdown')}>
              <EmployeeCard
                contactCardClassName={cf('dd-agent-selector')}
                employeeName={item.fullName || item.displayName}
                avatarUrl={item.avatarUrl}
                title={item.titleInTeam || item.title}
                smallAvatar
              />
              <div className={cf('dd-icon')}>
                <Icon name="menu-down" />
              </div>
            </Button>
            <FlyOutOverlay animationFn={this.handleEmployeeSelectorAnimation} container={false} elevation={2}>
              <EmployeeSelector
                suggestedUsers={users}
                suggestedTeams={propertyTeams}
                users={allUsers}
                teams={allTeams}
                currentUser={loggedInUser}
                onEmployeeSelected={this.onSelectedAgentChanged}
                placeholderText={t('FIND_MORE')}
                smallAvatars
              />
            </FlyOutOverlay>
          </FlyOut>
        </div>
      </div>
    );
  }

  onCloseAvailableTeamAgentsFlyout = ({ target: tapAwaytarget, source }) => {
    const { selectAgentButton } = this.state;
    const isTapOutsideSelectedEvent = source === 'tapAway' && $(tapAwaytarget).closest(selectAgentButton.get(0)).length === 0;
    if (isTapOutsideSelectedEvent) this.setState({ openFlyout: false });
  };

  renderAvailableTeamAgents(element, availableAgentIds) {
    const { selectorData } = this.props;
    const { selectedTeamId } = this.state;
    const users = selectorData.allUsers.filter(u => u.currentTeamId === selectedTeamId && availableAgentIds.includes(u.id));

    return (
      <FlyOut open={this.state.openFlyout} positionArgs={{ of: element }} expandTo="bottom-right" onCloseRequest={this.onCloseAvailableTeamAgentsFlyout}>
        <FlyOutOverlay animationFn={this.handleEmployeeSelectorAnimation} container={false} elevation={2}>
          <EmployeeSelector
            formId={'teamCalendarEmployeeSearch'}
            suggestedUsers={users}
            users={users}
            onEmployeeSelected={this.onTeamCalendarAgentSelected}
            placeholderText={t('FIND_MORE')}
          />
        </FlyOutOverlay>
      </FlyOut>
    );
  }

  renderWarningsAndErrors() {
    return [
      this.state.displayOverlapWarning && (
        <div data-id="warningScheduledAppointment" key="container-warning" className={cf('formRowPadded modalFooterWarning')}>
          {t('SCHEDULE_APPOINTMENT_FORM_WARNING_YOU_HAVE_OVERLAPING_EVENTS')}
        </div>
      ),
      this.props.error && (
        <div key="container-error" className={cf('formRowPadded modalFooterError')}>
          <T.Text lighter>{t(this.props.error)}</T.Text>
        </div>
      ),
    ];
  }
}
