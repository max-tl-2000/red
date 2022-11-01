/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import sortBy from 'lodash/sortBy';
import { sendMessage } from 'redux/modules/communication';
import { loadSelectorData, updatePerson, mergePersons } from 'redux/modules/personsStore';
import { loadSelectorData as loadSelectorDataForMergeParties } from 'redux/modules/partyStore';
import { openFlyout, closeNonWidelyAvailableFlyouts } from 'redux/modules/flyoutStore';
import { saveNavigationHistory } from 'redux/modules/locationTracking';
import NoCommsCard from 'custom-components/CommsThreadCards/NoCommsCard';
import { SMS_THREAD } from 'helpers/comm-flyout-types';

import { loadPersonDetailsData } from 'redux/modules/appDataLoadingActions';
import { getAllTeamsFromUsers } from 'helpers/models/team';

import AppBarBack from 'custom-components/AppBar/AppBarBack';
import * as P from 'components/DualPanelLayout/DualPanelLayout';
import contains from 'helpers/contains';

import { AppBarActions, PreloaderBlock, Section, Typography, IconButton, Card } from 'components';

import { t } from 'i18next';
import { createSelector } from 'reselect';
import * as appointmentActions from 'redux/modules/appointments';
import * as appointmentDialogActions from 'redux/modules/appointments.dialog';
import * as inventoryActions from 'redux/modules/inventoryStore';
import CreateEditResidentForm from 'custom-components/CreateEditResidentForm/CreateEditResidentForm';
import notifier from 'helpers/notifier/notifier';
import { clearResults } from 'redux/modules/search';
import { openMergePartyFlyout, closeMergePartyFlyout } from 'redux/modules/mergePartiesStore';
import uniq from 'lodash/uniq';
import { observer, inject, Observer } from 'mobx-react';
import { isRevaAdmin } from '../../../common/helpers/auth';
import { getEnhancedAppointments } from '../../helpers/appointments';
import { DALTypes } from '../../../common/enums/DALTypes';
import MergePartyDialog from '../MergePartyDialog/MergePartyDialog';
import CommunicationList from '../ProspectDetailPage/Communication/CommunicationList';
import AppointmentList from '../AppointmentList/AppointmentList';
import NotFound from '../NotFound/NotFound';
import PersonDetails from './PersonDetails';
import PartyList from './PartyList';
import { getCommunicationsAccessibleByUser, getAppointmentsAccessibleByUser } from '../../../common/acd/access.js';
import { cf } from './PersonDetailsPage.scss';
import { findLocalTimezone, toMoment } from '../../../common/helpers/moment-utils';
import AppointmentDialogWrapper from '../PartyPageUnified/AppointmentDialogWrapper';

const { Text, SubHeader } = Typography;

const getInactiveMembers = createSelector(
  s => s.dataStore.get('inactiveMembers'),
  s => s.dataStore.get('persons'),
  (inactiveMembers, persons) =>
    inactiveMembers.map(p => ({
      ...p,
      person: persons.get(p.personId),
    })),
);

const getPerson = createSelector(
  s => s.dataStore.get('persons'),
  (s, props) => props.params.personId,
  (persons, personId) => persons.filter(p => p.id === personId),
);

const getPersons = createSelector(
  s => s.dataStore.get('persons'),
  p => p,
);

const getParties = createSelector(
  s => s.dataStore.get('parties'),
  (s, props) => props.params.personId,
  (parties, personId) => parties.filter(p => p.partyMembers.some(pm => pm.personId === personId)),
);

const getPersonAssociatedParties = createSelector(
  (s, props) => getParties(s, props),
  parties => {
    const associatedParties = parties.toArray();
    return sortBy(associatedParties, 'created_at');
  },
);

// a person could be associated to more than one party (e.g. 3 traditionals and 1 corporate).
// So, a set is used to leverage build-in features like has, size and so on instead of an array.
const getPersonAssociatedPartyTypes = createSelector(
  (s, props) => getPersonAssociatedParties(s, props),
  parties => new Set(parties.map(({ leaseType }) => leaseType)),
);

const getEnhancedPartyMembers = createSelector(
  s => s.dataStore.get('members'),
  s => s.dataStore.get('persons'),
  (members, personsMap) =>
    members.map(p => ({
      ...p,
      person: personsMap.get(p.personId),
    })),
);

const isDuplicatePersonNotificationEnabled = createSelector(
  state => state.auth.user || {},
  state => (state.auth.user || {}).features || {},
  (currentUser, features) => features.duplicatePersonNotification === undefined || features.duplicatePersonNotification || isRevaAdmin(currentUser),
);

@connect(
  (state, props) => {
    const members = getEnhancedPartyMembers(state, props);
    const parties = getParties(state, props);
    const personId = props.params.personId;
    const partyMember = members.find(p => p.personId === props.params.personId);
    const partyId = partyMember && partyMember.partyId;

    return {
      members,
      inactiveMembers: getInactiveMembers(state, props),
      loadingData: state.dataStore.get('loading'),
      isAddingAppointment: state.appointmentsDialog.isEnabled,
      currentUser: state.auth.user,
      users: state.globalStore.get('users'),
      allCommunications: state.dataStore.get('communications'),
      allAppointments: state.dataStore.get('tasks').filter(p => p.category === DALTypes.TaskCategories.APPOINTMENT),
      currentPerson: getPerson(state, props),
      persons: getPersons(state, props),
      parties,
      associatedParties: getPersonAssociatedParties(state, props),
      associatedPartyTypes: getPersonAssociatedPartyTypes(state, props),
      selectorData: state.personsStore.selectorData,
      removeAppointmentError: state.appointments.removeAppointmentError,
      propertiesLoaded: state.globalStore.get('globalDataLoaded'),
      properties: state.globalStore.get('properties'),
      selectorDataForMerge: state.partyStore.selectorDataForParty,
      displayDuplicatePersonNotification: isDuplicatePersonNotificationEnabled(state, props),
      partyId,
      personId,
      filters: state.unitsFilter.filters,
      mergedPersonId: state.personsStore.mergedPersonId,
      errorPersonId: state.dataStore.get('errorPersonId'),
      personLoadingError: state.dataStore.get('personLoadingError'),
    };
  },
  dispatch =>
    bindActionCreators(
      {
        loadPersonDetailsData,
        sendMessage,
        updatePerson,
        mergePersons,
        loadSelectorData,
        ...appointmentActions,
        ...appointmentDialogActions,
        ...inventoryActions,
        closeNonWidelyAvailableFlyouts,
        openFlyout,
        clearResults,
        openMergePartyFlyout,
        closeMergePartyFlyout,
        loadSelectorDataForMergeParties,
        saveNavigationHistory,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class PersonDetailsPage extends Component {
  static propTypes = {
    params: PropTypes.object,
    isAddingAppointment: PropTypes.bool,
    currentUser: PropTypes.object,
    loadPersonDetailsData: PropTypes.func,
    sendMessage: PropTypes.func,
    updatePerson: PropTypes.func,
    mergePersons: PropTypes.func,
    loadSelectorData: PropTypes.func,
    closeNonWidelyAvailableFlyouts: PropTypes.func,
    openFlyout: PropTypes.func,
    isRemoveConfirmationOpen: PropTypes.bool,
    removeAppointmentError: PropTypes.string,
    closeMergePartyFlyout: PropTypes.func,
    saveNavigationHistory: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      dualLayoutModel: new P.LayoutModel(),
      envTimezone: findLocalTimezone(),
    };
  }

  componentWillMount() {
    this.fetchData(this.props);
  }

  componentDidMount() {
    if (this.props.location.query.newCommType) {
      this.openCommFlyOut({
        flyoutType: this.props.location.query.newCommType,
      });
    }
    this.props.saveNavigationHistory({
      entityId: this.props.params.personId,
      entityType: DALTypes.NavigationHistoryType.PERSON,
    });
  }

  componentWillUnmount() {
    this.props.closeMergePartyFlyout();
    this.props.endAddingAppointment();
    this.props.closeNonWidelyAvailableFlyouts();
  }

  fetchData = props => {
    this.props.loadPersonDetailsData(props.params.personId);
    this.getDataAccessibleForCurrentUser(props);
    const { openMergePartyDialog, partyId } = props.location.query;
    this.setState({
      openMergePartyDialog,
      mergePartyId: partyId,
    });
  };

  componentWillReceiveProps(nextProps) {
    if (this.props.params.personId !== nextProps.params.personId) {
      this.fetchData(nextProps);
    }

    if (nextProps.users.size && !nextProps.selectorData.users) {
      this.props.loadSelectorData(nextProps.users, nextProps.currentUser);
      this.props.loadSelectorDataForMergeParties(nextProps.users, nextProps.currentUser);
    }

    if (nextProps.removeAppointmentError) {
      notifier.error(t(nextProps.removeAppointmentError));
      nextProps.clearRemoveError();
    }

    if (this.state.openMergePartyDialog && !this.state.mergePartyDialogWasOpened) {
      this.props.openMergePartyFlyout({
        partyId: this.state.mergePartyId,
        personId: this.props.params.personId,
        mergeContext: DALTypes.MergePartyContext.PERSON,
      });

      this.setState({ mergePartyDialogWasOpened: true });
    }

    if (nextProps.users.size) {
      this.getDataAccessibleForCurrentUser(nextProps);
    }

    const {
      currentPerson,
      params: { personId },
    } = this.props;
    const person = personId && currentPerson.get(personId);
    if ((nextProps.mergedPersonId === personId && !this.state.editDialogOpen) || person?.mergedWith) {
      this.setState({ isMergedPerson: true });
    }
  }

  navigateToPartyDetails = party => {
    const { leasingNavigator } = this.props;
    leasingNavigator.navigateToParty(party.id);
  };

  renderActions = () => {
    const { dualLayoutModel } = this.state;
    const elements = [];

    if (dualLayoutModel.compact) {
      elements.push(
        <IconButton
          key={'panelToggle'}
          ref={ref => (this.btnCommsToggle = ref)}
          iconName="communication-panel"
          iconStyle="light"
          onClick={dualLayoutModel.toggleRightPanel}
        />,
      );
    }

    return elements;
  };

  checkIfClickOnTrigger = args => {
    // do not hide the panel if the click happen in the toggle trigger
    // the toggle will open/close the panel any way
    // and also do not close the panel if the click happened inside the
    // comms and inventory panels toggle
    args.cancel = this.btnCommsToggle && contains(findDOMNode(this.btnCommsToggle), args.target);
  };

  getDataAccessibleForCurrentUser = props => {
    const personId = this.props.params.personId;
    const { currentUser, allCommunications, users, parties, allAppointments, members, inactiveMembers } = props;

    // this seems to be happening when the session is lost and it is
    // preventing the user to be redirected to the Login
    if (!currentUser) return;

    this.setState({
      communications: getCommunicationsAccessibleByUser(currentUser, personId, users, allCommunications, parties),
      appointments: getAppointmentsAccessibleByUser(currentUser, allAppointments, personId, members, parties, users, inactiveMembers),
    });
  };

  getLeadPartyMember = personId => this.props.members.find(p => p.personId === personId);

  openCommFlyOut = ({ flyoutType, props = {} }) => {
    const { partyMember, parties } = this.props;
    const partyId = partyMember?.partyId || parties.first()?.id;
    const dataParameters = {
      ...props,
      personId: this.props.params.personId,
    };
    if (flyoutType !== SMS_THREAD) dataParameters.partyId = partyId;

    return this.props.openFlyout(flyoutType, dataParameters);
  };

  handleContactInfoEdit = (person, dismissedMatches) => {
    this.props.updatePerson(person, dismissedMatches);
    this.setState({ editDialogOpen: false });
  };

  editContactInfoClicked = () => this.setState({ editDialogOpen: true });

  renderParties = () => {
    const { currentPerson, members, currentUser, users, params, associatedParties } = this.props;

    return (
      <PartyList
        parties={associatedParties}
        onPartyClick={this.navigateToPartyDetails}
        currentPersonId={params.personId}
        currentUser={currentUser}
        currentPerson={currentPerson.get(params.personId)}
        users={users}
        teams={getAllTeamsFromUsers(users)}
        members={members}
      />
    );
  };

  handleEditAppointment = appointment => this.props.startEditingAppointment(appointment);

  getAssociatedPropertyForSignature = (personId, parties, properties) => {
    let propertyId = '';
    const partiesArray = Array.from(parties.values());
    if (partiesArray && partiesArray.length === 1) {
      propertyId = partiesArray[0].assignedPropertyId;
    } else {
      const assignedProperties = uniq(partiesArray.filter(party => !party.endDate).map(openParty => openParty.assignedPropertyId));
      if (assignedProperties && assignedProperties.length === 1) {
        propertyId = assignedProperties[0];
      }
    }

    const associatedProperty = properties.find(p => p.id === propertyId);
    return associatedProperty || {};
  };

  handleMergePersons = async mergeData => {
    const mergeResult = await this.props.mergePersons(mergeData);
    if (mergeResult.error) return;

    const { partyMember, parties, leasingNavigator } = this.props;
    const partyId = partyMember && partyMember.partyId;
    const partyToMerge = partyId || parties.first().id;

    leasingNavigator.navigateToPerson(mergeData.secondPersonId, { openMergePartyDialog: true, partyId: partyToMerge });
  };

  getPartiesWithoutCompany = (parties, allPartyMemberships) => {
    const partyMembershipsWithoutCompany = allPartyMemberships.filter(member => !member.companyId);
    let openParties = 0;
    let closedParties = 0;

    partyMembershipsWithoutCompany.forEach(member => {
      const party = parties.get(member.partyId);
      const isPartyOpen = party && party.leaseType === DALTypes.PartyTypes.CORPORATE && party.workflowState === DALTypes.WorkflowState.ACTIVE;
      const isPartyClosed = party && party.leaseType === DALTypes.PartyTypes.CORPORATE && party.workflowState === DALTypes.WorkflowState.CLOSED;
      isPartyOpen && openParties++;
      isPartyClosed && closedParties++;
    });

    return {
      companyId: null,
      companyName: null,
      openParties,
      closedParties,
    };
  };

  getAllCompanies = () => {
    const { members, currentPerson, parties, personId } = this.props;

    const person = currentPerson.get(personId);
    const allPartyMemberships = members.filter(p => p.personId === person?.id);

    const allCompanyIds = uniq(
      allPartyMemberships
        .map(member => member.companyId)
        .filter(x => x)
        .toArray(),
    );

    const allCompanies = allCompanyIds.map(companyId => {
      let openParties = 0;

      const companyMembers = allPartyMemberships.filter(member => member.companyId === companyId);

      companyMembers.forEach(member => {
        const party = parties.get(member.partyId);
        const isPartyOpen = party && party.leaseType === DALTypes.PartyTypes.CORPORATE && party.workflowState === DALTypes.WorkflowState.ACTIVE;
        isPartyOpen && openParties++;
      });

      const company = allPartyMemberships.find(member => member.companyId === companyId);

      return {
        companyId,
        companyName: company?.displayName,
        openParties,
      };
    });

    const partiesWithoutCompany = this.getPartiesWithoutCompany(parties, allPartyMemberships);
    (partiesWithoutCompany.openParties > 0 || partiesWithoutCompany.closedParties > 0) && allCompanies.push(partiesWithoutCompany);

    return allCompanies;
  };

  render = () => {
    const {
      loadingData,
      members,
      currentPerson,
      persons,
      users,
      inactiveMembers,
      parties,
      associatedPartyTypes,
      properties,
      selectorDataForMerge,
      displayDuplicatePersonNotification,
      partyId,
      personId,
      filters,
      personLoadingError,
      errorPersonId,
    } = this.props;

    const { communications, appointments, dualLayoutModel, isMergedPerson } = this.state;

    const person = currentPerson.get(personId);
    const title = t('PERSON_DETAILS');

    const allCompanies = this.getAllCompanies(parties, members);

    const commsAvailable = communications.size > 0;
    const fullName = person ? person.fullName : '';
    const preferredName = person ? person.preferredName : '';
    const emails = person ? person.contactInfo.emails : [];
    const phones = person ? person.contactInfo.phones : [];

    const appointmentsForPerson = members && getEnhancedAppointments(appointments || [], { users, partyMembers: members, inactiveMembers, parties });

    const party = parties.get(partyId);
    const contactIsBlocked = person && person.contactInfo && person.contactInfo.isSpam;
    const contactBlockedDate = party && toMoment(party.updated_at).format('dddd, MMM D');
    const contactBlockedBy = party && users.get(party.metadata.closeAgentId);

    const associatedProperty = this.getAssociatedPropertyForSignature(personId, parties, properties);
    const associatedPropertyDisplayName = associatedProperty.displayName || '';

    const errorOnLoadedPersonDetails = errorPersonId === personId && personLoadingError;

    const shouldReturn404 = isMergedPerson || errorOnLoadedPersonDetails;

    if (shouldReturn404) return <NotFound />;

    return (
      <div id="personDetails" className={cf('page')}>
        <AppBarBack title={title}>
          <Observer>{() => <AppBarActions className={cf('appBarActions')}>{this.renderActions()}</AppBarActions>}</Observer>
        </AppBarBack>

        <P.PanelsContainer model={dualLayoutModel} onRightPanelClickOutside={this.checkIfClickOnTrigger} paddingTop={'4rem'}>
          <P.LeftPanel useExtraBottomPadding>
            {do {
              if (loadingData) {
                <PreloaderBlock />;
              } else {
                <div>
                  {contactIsBlocked && (
                    <Card className={cf('contactBlockedSection')}>
                      <Text>
                        {' '}
                        {t('MARK_AS_SPAM_SUMMARY', {
                          name: contactBlockedBy?.preferredName || contactBlockedBy?.fullName,
                          date: contactBlockedDate,
                        })}{' '}
                      </Text>
                      <Text secondary>{t('UNBLOCK_CONTACT')}</Text>
                    </Card>
                  )}
                  <Section
                    padContent
                    title={t('CONTACT_INFORMATION')}
                    actionItems={<IconButton id="editPersonDetailsBtn" iconName="pencil" onClick={this.editContactInfoClicked} />}>
                    <PersonDetails
                      person={{
                        allCompanies,
                        fullName,
                        preferredName,
                        emails,
                        phones,
                        belongsToCorporate: associatedPartyTypes.has(DALTypes.PartyTypes.CORPORATE),
                      }}
                    />
                    {this.state.editDialogOpen && (
                      <CreateEditResidentForm
                        onUpdatePerson={this.handleContactInfoEdit}
                        onMergePersons={this.handleMergePersons}
                        onCancel={() => this.setState({ editDialogOpen: false })}
                        person={person || {}}
                        partyId={partyId}
                        displayDuplicatePersonNotification={displayDuplicatePersonNotification}
                        associatedPartyTypes={associatedPartyTypes}
                        isPointOfContact={associatedPartyTypes.has(DALTypes.PartyTypes.CORPORATE)}
                      />
                    )}
                  </Section>
                  <Section title={t('ASSOCIATED_PARTIES')}>
                    <div className={cf('associatedParties')}>
                      <SubHeader secondary>{t('ASSOCIATED_PARTIES_HELPER')}</SubHeader>
                    </div>
                    <div>{this.renderParties()}</div>
                  </Section>
                  <AppointmentList
                    appointments={appointmentsForPerson.toArray()}
                    loading={loadingData}
                    editAppointment={this.handleEditAppointment}
                    sendMessage={sendMessage}
                    partyMembers={members}
                    timezone={this.state.envTimezone}
                    persons={persons}
                  />
                </div>;
              }
            }}
          </P.LeftPanel>
          <P.RightPanel useExtraBottomPadding>
            {do {
              if (commsAvailable) {
                <div>
                  <CommunicationList
                    communications={communications}
                    partyMembers={members}
                    persons={persons}
                    loading={loadingData}
                    threadToOpen={this.props.location.query.threadId}
                    sendMethod={this.props.sendMessage}
                    onOpenCommFlyOut={this.openCommFlyOut}
                    associatedProperty={associatedPropertyDisplayName}
                  />
                </div>;
              } else {
                <div className={cf('panelWrapper')}>
                  <NoCommsCard message={t('NO_COMMUNICATIONS_WITH_PERSON')} />
                </div>;
              }
            }}
          </P.RightPanel>
        </P.PanelsContainer>
        {party && (
          <AppointmentDialogWrapper
            property={associatedProperty}
            partyId={partyId}
            party={party}
            propertyIds={(filters || {}).propertyIds}
            properties={properties}
          />
        )}
        <MergePartyDialog properties={properties} selectorData={selectorDataForMerge} skipRedirect={true} timezone={this.state.envTimezone} />
      </div>
    );
  };
}
