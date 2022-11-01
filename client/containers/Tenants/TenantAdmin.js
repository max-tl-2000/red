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
import { createSelector } from 'reselect';

import DocumentMeta from 'react-document-meta';
import { t } from 'i18next';

import { formatPhoneNumber } from 'helpers/strings';
import { resetSeedDataState } from 'redux/modules/seedData';
import {
  loadTenantTeams,
  loadTenantPrograms,
  updateTeam,
  clearTenantSchema,
  importAndProcessWorkflows,
  loadTenants,
  loadTenant,
  getEnterpriseConnectAuthorizationUrl,
  requestEnterpriseConnectAccessToken,
  syncExternalCalendarEvents,
  clearImportAndProcessWorkflowsInProgress,
  reassignActiveLeasesToRS,
} from 'redux/modules/tenantsStore';
import { resetImportedUsersPassword } from 'redux/modules/invite';
import {
  AppBar,
  AppBarActions,
  IconButton,
  PreloaderBlock,
  RedTable,
  RedList,
  Section,
  Dropdown,
  CheckBox,
  FullScreenDialog,
  DialogTitle,
  Icon,
  Typography,
  CardMenu,
  CardMenuItem,
  MsgBox,
  Tooltip,
  InlineConfirm,
} from 'components';
import { logout } from 'helpers/auth-helper';
import { inject, observer } from 'mobx-react';
import cfg from 'helpers/cfg';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isCustomerAdmin } from '../../../common/helpers/auth';
import { cf } from './TenantAdmin.scss';
import ImportData from '../ImportData/ImportData';
import ExportDatabase from '../ExportDatabase/ExportDatabase';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import ProgramsList from './ProgramsList';
import CloseOrArchivePartiesDialog from './CloseOrArchivePartiesDialog';
import ImportAndProcessWorkflowsDialog from './ImportAndProcessWorkflowsDialog';

const { Table, Row, RowHeader, Cell, TextPrimary } = RedTable;

const { List, ListItem, MainSection, Divider } = RedList;

const { Text, SubHeader, TextHeavy } = Typography;

const getTenant = createSelector(
  state => state.tenants.tenants,
  state => state.auth.user.tenantId,
  (tenants, tenantId) => (tenants || []).find(tnt => tnt.id === tenantId),
);

@connect(
  state => ({
    authUser: state.auth.user,
    isLoading: state.tenants.isLoading,
    tenantTeams: state.tenants.tenantTeams,
    programs: state.tenants.programs,
    tenantPhoneNumbers: state.tenants.tenantPhoneNumbers,
    clearingTenantSchema: state.tenants.clearingTenantSchema,
    properties: state.globalStore.get('properties'),
    propertiesLoaded: state.globalStore.get('globalDataLoaded'),
    closingImportedParties: state.tenants.closingImportedParties,
    currentTenant: getTenant(state),
    importAndProcessWorkflowsAlreadyInProgress: state.tenants.importAndProcessWorkflowsAlreadyInProgress,
  }),
  dispatch =>
    bindActionCreators(
      {
        loadTenantTeams,
        loadTenantPrograms,
        updateTeam,
        clearTenantSchema,
        resetSeedDataState,
        resetImportedUsersPassword,
        loadTenants,
        loadTenant,
        getEnterpriseConnectAuthorizationUrl,
        requestEnterpriseConnectAccessToken,
        syncExternalCalendarEvents,
        importAndProcessWorkflows,
        clearImportAndProcessWorkflowsInProgress,
        reassignActiveLeasesToRS,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class TenantAdmin extends Component {
  constructor() {
    super();
    this.state = {
      expandedTeams: [],
      cleanDatabaseDialogIsVisible: false,
      isCloseOrArchivePartiesDialogOpen: false,
      isImportAndProcessWorkflowsDialogOpen: false,
    };
  }

  static propTypes = {
    user: PropTypes.object,
    tenantPhoneNumbers: PropTypes.array,
    resetImportedUsersPassword: PropTypes.func,
  };

  componentWillMount() {
    this.props.loadTenantTeams(this.props.authUser.tenantId);
    this.props.loadTenants();
  }

  componentDidMount = async () => {
    const { location } = this.props;
    const code = location.query && location.query.code;
    if (!code) return;
    (await this.props.requestEnterpriseConnectAccessToken(code)) && this.props.leasingNavigator.navigateToHome();
  };

  handleLogout = event => {
    event.preventDefault();
    logout();
  };

  handlePartyRoutingOnChange = (value, team) => {
    const delta = {
      metadata: { partyRoutingStrategy: value },
    };

    this.props.updateTeam(this.props.authUser.tenantId, team.id, delta);
  };

  handleCallRoutingOnChange = (value, team) => {
    const delta = {
      metadata: { callRoutingStrategy: value },
    };

    this.props.updateTeam(this.props.authUser.tenantId, team.id, delta);
  };

  handleCallRecordingOnChange = (value, team) => {
    const delta = {
      metadata: { callRecordingSetup: value },
    };

    this.props.updateTeam(this.props.authUser.tenantId, team.id, delta);
  };

  handleNativeCommsEnabledChanged = (nativeCommsEnabled, team) => {
    const currentTeamCommsSettings = team.metadata.comms;
    const delta = { metadata: { comms: { ...currentTeamCommsSettings, nativeCommsEnabled } } };

    this.props.updateTeam(this.props.authUser.tenantId, team.id, delta);
  };

  handleSendCalendarCommsChanged = (sendCalendarCommsFlag, team) => {
    const currentTeamCommsSettings = team.metadata.comms;
    const delta = { metadata: { comms: { ...currentTeamCommsSettings, sendCalendarCommsFlag } } };

    this.props.updateTeam(this.props.authUser.tenantId, team.id, delta);
  };

  handleShowImportDataDialog = () => this.importDataDialog.toggle();

  handleShowProgramsDialog = () => {
    this.props.loadTenantPrograms(this.props.authUser.tenantId);
    this.programsDataDialog.toggle();
  };

  handleShowAppSettings = () => {
    this.props.leasingNavigator.navigateToAppSettingsPage();
  };

  handleShowSubscriptions = () => {
    this.props.leasingNavigator.navigateToSubscriptionsPage();
  };

  refreshRingCentralToken = async () => {
    this.props.leasingNavigator.navigateToRingCentralTokenRefreshPage();
  };

  externalCalendarIntegration = async () => {
    const { data } = await this.props.getEnterpriseConnectAuthorizationUrl();
    this.props.leasingNavigator.navigateToCronofyAuthorizationPage(data);
  };

  externalCalendarSync = async () => {
    this.props.syncExternalCalendarEvents();
  };

  handleReassignActiveLeasesToRS = async () => {
    this.props.reassignActiveLeasesToRS();
  };

  handleCloseImportDataDialog = () => {
    this.props.loadTenantTeams(this.props.authUser.tenantId);
    this.props.resetSeedDataState();
    this.props.loadTenant(this.props.authUser.tenantId);
  };

  handleTeamClick = team => {
    const expandedTeamsCopy = this.state.expandedTeams.slice();
    const selectedTeamIdx = expandedTeamsCopy.indexOf(team.id);
    if (selectedTeamIdx >= 0) {
      expandedTeamsCopy.splice(selectedTeamIdx, 1);
    } else {
      expandedTeamsCopy.push(team.id);
    }
    this.setState({ expandedTeams: expandedTeamsCopy });
  };

  navigateToHome = () => {
    this.props.leasingNavigator.navigateToHome();
  };

  getTeamSummary = team =>
    team.teamMembers.reduce(
      ({ laaCount, lcaCount, ldCount, lwaCount, lsmCount }, member) => {
        member.functionalRoles &&
          (member.functionalRoles.indexOf(FunctionalRoleDefinition.LAA.name) >= 0 ? laaCount++ : laaCount,
          member.functionalRoles.indexOf(FunctionalRoleDefinition.LCA.name) >= 0 ? lcaCount++ : lcaCount,
          member.functionalRoles.indexOf(FunctionalRoleDefinition.LWA.name) >= 0 ? lwaCount++ : lwaCount,
          member.functionalRoles.indexOf(FunctionalRoleDefinition.LSM.name) >= 0 ? lsmCount++ : lsmCount,
          member.functionalRoles.indexOf(FunctionalRoleDefinition.LD.name) >= 0 ? ldCount++ : ldCount);
        return { laaCount, lcaCount, ldCount, lwaCount, lsmCount };
      },
      { laaCount: 0, lcaCount: 0, ldCount: 0, lwaCount: 0, lsmCount: 0 },
    );

  shouldDisplayWarningIcon = teamSummary =>
    teamSummary.laaCount === 0 ||
    teamSummary.lcaCount === 0 ||
    teamSummary.ldCount === 0 ||
    teamSummary.lwaCount === 0 ||
    teamSummary.lsmCount === 0 ||
    teamSummary.ldCount > FunctionalRoleDefinition.LD.maxMembersWithThisRole;

  shouldDisplayExternalCalendarOption = () => {
    const { currentTenant = {} } = this.props;
    if (!currentTenant.settings || !currentTenant.settings.features) return false;
    return currentTenant.settings.features.enableExternalCalendarIntegration;
  };

  shouldDisplayExternalCalendarDataSyncOption = () => {
    const { currentTenant = {} } = this.props;
    const calendarIntegrationEnabled = this.shouldDisplayExternalCalendarOption();

    const { externalCalendars } = currentTenant.metadata || {};
    return calendarIntegrationEnabled && externalCalendars && externalCalendars.integrationEnabled;
  };

  openCleanDatabaseDialog = () => {
    this.setState({ cleanDatabaseDialogIsVisible: true });
  };

  closeCleanDatabaseDialog = () => {
    this.setState({ cleanDatabaseDialogIsVisible: false });
  };

  handleClickClearDatabase = () => {
    const tenantId = this.props.authUser.tenantId;
    this.props.clearTenantSchema && this.props.clearTenantSchema(tenantId);
    this.closeCleanDatabaseDialog();
  };

  handleImportAndProcessWorkflowsDialog = showDialog => {
    this.setState({ isImportAndProcessWorkflowsDialogOpen: showDialog });
  };

  get importEnabled() {
    const { currentTenant } = this.props;
    const backendMode = currentTenant?.metadata?.backendIntegration?.name || DALTypes.BackendMode.NONE;
    const shouldEnableImport = backendMode !== DALTypes.BackendMode.NONE;
    return shouldEnableImport;
  }

  handleImportAndProcessWorkflows = ({ skipImport, skipProcess }) => {
    const tenantId = this.props.authUser.tenantId;
    this.props.importAndProcessWorkflows && this.props.importAndProcessWorkflows({ tenantId, skipImport, skipProcess });
    this.handleImportAndProcessWorkflowsDialog(false);
  };

  handleExportDatabase = () => {
    this.exportDBDialog.toggle();
  };

  handleCloseOrArchivePartiesDialog = showDialog => this.setState({ isCloseOrArchivePartiesDialogOpen: showDialog });

  sendResetPasswordEmails = (teamMembers, sendForIndividual) => {
    const { tenantId: id, tenantName: name } = this.props.authUser;
    this.props.resetImportedUsersPassword({ id, name }, teamMembers, sendForIndividual);
  };

  renderTeam = team => {
    const teamSummary = this.getTeamSummary(team);
    const callRecordingSetupItems = Object.keys(DALTypes.CallRecordingSetup).map(s => ({ id: s, text: t(s) }));
    const isTeamInactive = !!team.endDate;

    const callRoutingStrategies = (team.metadata.callQueue || {}).enabled
      ? [
          {
            id: DALTypes.CallRoutingStrategy.ROUND_ROBIN,
            text: DALTypes.CallRoutingStrategy.ROUND_ROBIN,
          },
          {
            id: DALTypes.CallRoutingStrategy.EVERYBODY,
            text: DALTypes.CallRoutingStrategy.EVERYBODY,
          },
        ]
      : [
          {
            id: DALTypes.CallRoutingStrategy.OWNER,
            text: DALTypes.CallRoutingStrategy.OWNER,
          },
          {
            id: DALTypes.CallRoutingStrategy.ROUND_ROBIN,
            text: DALTypes.CallRoutingStrategy.ROUND_ROBIN,
          },
          {
            id: DALTypes.CallRoutingStrategy.CALL_CENTER,
            text: DALTypes.CallRoutingStrategy.CALL_CENTER,
          },
          {
            id: DALTypes.CallRoutingStrategy.EVERYBODY,
            text: DALTypes.CallRoutingStrategy.EVERYBODY,
          },
        ];

    return (
      <div key={`div-${team.id}`}>
        <Row key={`row-${team.id}`} onClick={() => this.handleTeamClick(team)}>
          <Cell type="ctrlCell" width={55}>
            {this.state.expandedTeams.indexOf(team.id) >= 0 ? <IconButton iconName="chevron-down" /> : <IconButton iconName="chevron-right" />}
          </Cell>
          <Cell width="10%" className={isTeamInactive ? cf('inactive-text-cell') : ''}>
            <TextPrimary inline>{team.displayName}</TextPrimary>
          </Cell>
          <Cell width="5%">
            <Tooltip text={t('SEND_INVITES')} position="top-left">
              <InlineConfirm
                positionArgs={{ my: 'right top', at: 'right top' }}
                expandTo="bottom-left"
                lblCancel={t('CANCEL')}
                lblOK={t('SEND_INVITES')}
                onOKClick={() => this.sendResetPasswordEmails(team.teamMembers, false)}
                content={t('SEND_INVITES_TO_TEAM_CONFIRMATION_MESSAGE', { tenant: name })}>
                <IconButton iconName="email" disabled={isTeamInactive} />
              </InlineConfirm>
            </Tooltip>
          </Cell>
          <Cell width="10%" className={isTeamInactive ? cf('inactive-text-cell') : ''}>
            <TextPrimary inline>{team.module}</TextPrimary>
          </Cell>
          <Cell textAlign="center" className={cf('cellWithIcon', { inactive: isTeamInactive })}>
            <TextPrimary inline>{team.teamMembers.length} </TextPrimary>
            {this.shouldDisplayWarningIcon(teamSummary) && <Icon name="alert" className={cf('alert-icon')} />}
          </Cell>
          <Cell textAlign="center" innerWrapperWidth="100%" onClick={e => e.stopPropagation()}>
            <Dropdown
              selectedItemStyle={{ fontSize: 13 }}
              styled={false}
              disabled={isTeamInactive}
              selectedValue={team.metadata.partyRoutingStrategy}
              items={[
                {
                  id: DALTypes.PartyRoutingStrategy.DISPATCHER,
                  text: DALTypes.PartyRoutingStrategy.DISPATCHER,
                },
                {
                  id: DALTypes.PartyRoutingStrategy.ROUND_ROBIN,
                  text: DALTypes.PartyRoutingStrategy.ROUND_ROBIN,
                },
              ]}
              onChange={e => this.handlePartyRoutingOnChange(e.id, team)}
            />
          </Cell>
          <Cell textAlign="center" innerWrapperWidth="100%" onClick={e => e.stopPropagation()}>
            <Dropdown
              selectedItemStyle={{ fontSize: 13 }}
              styled={false}
              disabled={isTeamInactive}
              selectedValue={team.metadata.callRoutingStrategy}
              items={callRoutingStrategies}
              onChange={e => this.handleCallRoutingOnChange(e.id, team)}
            />
          </Cell>
          <Cell textAlign="center" innerWrapperWidth="100%" onClick={e => e.stopPropagation()}>
            <Dropdown
              selectedItemStyle={{ fontSize: 13 }}
              styled={false}
              disabled={isTeamInactive}
              selectedValue={team.metadata.callRecordingSetup}
              items={callRecordingSetupItems}
              onChange={e => this.handleCallRecordingOnChange(e.id, team)}
            />
          </Cell>
          <Cell textAlign="center" innerWrapperWidth="100%" onClick={e => e.stopPropagation()}>
            <CheckBox
              disabled={isTeamInactive}
              checked={team.metadata.comms.nativeCommsEnabled}
              onChange={value => this.handleNativeCommsEnabledChanged(value, team)}
            />
          </Cell>
          <Cell textAlign="center" innerWrapperWidth="100%" onClick={e => e.stopPropagation()}>
            <CheckBox
              disabled={isTeamInactive}
              checked={team.metadata.comms.sendCalendarCommsFlag}
              onChange={value => this.handleSendCalendarCommsChanged(value, team)}
            />
          </Cell>
        </Row>
        {this.state.expandedTeams.indexOf(team.id) >= 0 && this.renderTeamMembersTable(team, teamSummary)}
      </div>
    );
  };

  renderTeamMembersTable = (team, teamSummary) => (
    <Row noHover noDivider key={`row-${team.name}`} style={{ paddingBottom: 40 }} indentLevel={1} indentSize={55}>
      <Cell noSidePadding innerWrapperWidth="100%" className={cf('teamMemberTableContainer')}>
        <Table className={cf('innerTableHeader')}>
          <RowHeader key={`hdrTeamMembers-${team.name}`}>
            <Cell textAlign="left" width={'14%'}>
              {t('TEAM_MEMBER')}
            </Cell>
            <Cell textAlign="left" width="5%" />
            <Cell textAlign="left" width={'25%'}>
              {t('LOGIN_EMAIL')}
            </Cell>
            <Cell textAlign="left" width={'12%'}>
              {t('EMAIL')}
            </Cell>
            <Cell textAlign="left" width={'12%'}>
              {t('TENANT_PHONE_NUMBER')}
            </Cell>
            <Cell textAlign="center" className={cf('rowHeaderWithWarnings')}>
              {t('SIP_MISSING')}
            </Cell>
            <Cell textAlign="center" width={'10%'}>
              {t('MAIN_ROLE')}
            </Cell>
            <Cell textAlign="center" className={cf('rowHeaderWithWarnings')}>
              {teamSummary.lwaCount === 0 && <Text error>{t('ROLE_NOT_ASSIGNED')} </Text>}
              {teamSummary.lwaCount > 0 ? <Text className={cf('rowHeaderFont')}>{t('LWA')} </Text> : <Text error>{t('LWA')} </Text>}
            </Cell>
            <Cell textAlign="center" className={cf('rowHeaderWithWarnings')}>
              {teamSummary.lsmCount === 0 && <Text error>{t('ROLE_NOT_ASSIGNED')} </Text>}
              {teamSummary.lsmCount > 0 ? <Text className={cf('rowHeaderFont')}>{t('LSM')} </Text> : <Text error>{t('LSM')} </Text>}
            </Cell>
            <Cell textAlign="center" className={cf('rowHeaderWithWarnings')}>
              {teamSummary.laaCount === 0 && <Text error>{t('ROLE_NOT_ASSIGNED')} </Text>}
              {teamSummary.laaCount > 0 ? <Text className={cf('rowHeaderFont')}>{t('LAA')} </Text> : <Text error>{t('LAA')} </Text>}
            </Cell>
            <Cell textAlign="center" className={cf('rowHeaderWithWarnings')}>
              {teamSummary.lcaCount === 0 && <Text error>{t('ROLE_NOT_ASSIGNED')} </Text>}
              {teamSummary.lcaCount > 0 ? <Text className={cf('rowHeaderFont')}>{t('LCA')} </Text> : <Text error>{t('LCA')} </Text>}
            </Cell>
            <Cell textAlign="center" className={cf('rowHeaderWithWarnings')}>
              {teamSummary.ldCount === 0 && <Text error>{t('ROLE_NOT_ASSIGNED')} </Text>}
              {teamSummary.ldCount > FunctionalRoleDefinition.LD.maxMembersWithThisRole && <Text error>{t('ONLY_ONE_ALLOWED')} </Text>}
              {teamSummary.ldCount === 1 ? <Text className={cf('rowHeaderFont')}>{t('LD')} </Text> : <Text error>{t('LD')} </Text>}
            </Cell>
            <Cell textAlign="center" className={cf('rowHeaderWithWarnings')}>
              <Text className={cf('rowHeaderFont')}>{t('CCA')} </Text>
            </Cell>
          </RowHeader>
          {team.teamMembers && team.teamMembers.map(this.renderTeamMembers)}
        </Table>
      </Cell>
    </Row>
  );

  renderTeamMembers = teamMember => (
    <Row key={`row-${teamMember.id}`}>
      <Cell textAlign="left" width={'14%'}>
        <TextPrimary inline>{teamMember.fullName} </TextPrimary>
      </Cell>
      <Cell textAlign="left" width="5%">
        <Tooltip text={t('SEND_INVITE_TO_USER')} position="top-left">
          <InlineConfirm
            positionArgs={{ my: 'right top', at: 'right top' }}
            expandTo="bottom-left"
            lblCancel={t('CANCEL')}
            lblOK={t('SEND_INVITES')}
            onOKClick={() => this.sendResetPasswordEmails([teamMember], true)}
            content={t('SEND_INVITES_TO_USER_CONFIRMATION_MESSAGE', { tenant: name })}>
            <IconButton iconName="email" />
          </InlineConfirm>
        </Tooltip>
      </Cell>
      <Cell textAlign="left" width={'25%'}>
        <TextPrimary inline>{teamMember.email}</TextPrimary>
      </Cell>
      <Cell textAlign="left" width={'12%'}>
        <TextPrimary inline>{teamMember.directEmailIdentifier || ''}</TextPrimary>
      </Cell>
      <Cell textAlign="left" width={'12%'}>
        <TextPrimary inline>{teamMember.directPhoneIdentifier ? formatPhoneNumber(teamMember.directPhoneIdentifier) : ''}</TextPrimary>
      </Cell>
      <Cell textAlign="center">
        <TextHeavy error>{!teamMember.sipEndpoints.find(e => e.isUsedInApp) ? 'x' : ''}</TextHeavy>
      </Cell>
      <Cell textAlign="center" width="10%">
        <TextPrimary inline>{teamMember.mainRoles.join(', ')}</TextPrimary>
      </Cell>
      <Cell textAlign="center">
        <TextPrimary inline>{teamMember.functionalRoles && teamMember.functionalRoles.indexOf(t('LWA')) >= 0 ? 'x' : ''}</TextPrimary>
      </Cell>
      <Cell textAlign="center">
        <TextPrimary inline>{teamMember.functionalRoles && teamMember.functionalRoles.indexOf(t('LSM')) >= 0 ? 'x' : ''}</TextPrimary>
      </Cell>
      <Cell textAlign="center">
        <TextPrimary inline>{teamMember.functionalRoles && teamMember.functionalRoles.indexOf(t('LAA')) >= 0 ? 'x' : ''}</TextPrimary>
      </Cell>
      <Cell textAlign="center">
        <TextPrimary inline>{teamMember.functionalRoles && teamMember.functionalRoles.indexOf(t('LCA')) >= 0 ? 'x' : ''}</TextPrimary>
      </Cell>
      <Cell textAlign="center">
        <TextPrimary inline>{teamMember.functionalRoles && teamMember.functionalRoles.indexOf(t('LD')) >= 0 ? 'x' : ''}</TextPrimary>
      </Cell>
      <Cell textAlign="center">
        <TextPrimary inline>{teamMember.functionalRoles && teamMember.functionalRoles.indexOf(t('CCA')) >= 0 ? 'x' : ''}</TextPrimary>
      </Cell>
    </Row>
  );

  renderClearDatabaseMenu = () => (cfg('cloudEnv') === 'prod' ? null : <CardMenuItem text={t('CLEAR_DATABASE')} onClick={this.openCleanDatabaseDialog} />);

  render({ authUser = {}, tenantTeams, tenantPhoneNumbers, clearingTenantSchema, programs, properties, isLoading } = this.props) {
    if (!tenantPhoneNumbers || !tenantTeams || clearingTenantSchema) {
      return <PreloaderBlock size="small" />;
    }

    const { importEnabled } = this;

    const unusedPhoneNumbers = tenantPhoneNumbers.filter(item => !item.isUsed);
    const overrides = authUser.tenantCommunicationOverrides;
    const isCustomerAdminUser = isCustomerAdmin(authUser);
    const showOverridesSection = overrides && (overrides.employeeEmails || overrides.customerEmails || overrides.customerPhone);

    return (
      <div>
        <DocumentMeta title={t('TENANT_ADMIN_PAGE')} />
        <AppBar title={authUser.tenantName} icon={<IconButton iconStyle="light" iconName="home" onClick={this.navigateToHome} />}>
          <AppBarActions>
            <CardMenu iconName="dots-vertical" iconStyle="light" menuListStyle={{ width: 200 }}>
              <CardMenuItem text={t('SEED_DATA_TENANT')} onClick={this.handleShowImportDataDialog} />
              {!isCustomerAdminUser && (
                <div>
                  <CardMenuItem text={t('EXPORT_DATABASE')} onClick={this.handleExportDatabase} />
                  <CardMenuItem text={t('APP_SETTINGS')} onClick={this.handleShowAppSettings} />
                  <CardMenuItem text={t('SUBSCRIPTIONS')} onClick={this.handleShowSubscriptions} />
                  <CardMenuItem text={t('VIEW_PROGRAMS')} onClick={this.handleShowProgramsDialog} />
                  <CardMenuItem text={t('CLOSE_OR_ARCHIVE_PARTIES')} onClick={() => this.handleCloseOrArchivePartiesDialog(true)} />
                  {this.renderClearDatabaseMenu()}
                  <CardMenuItem text="Ring Central admin" onClick={this.refreshRingCentralToken} />
                  {this.shouldDisplayExternalCalendarOption() && (
                    <CardMenuItem text={t('EXTERNAL_CALENDAR_INTEGRATION')} onClick={this.externalCalendarIntegration} />
                  )}
                  {this.shouldDisplayExternalCalendarDataSyncOption() && (
                    <CardMenuItem text={t('EXTERNAL_CALENDAR_DATA_SYNC')} onClick={this.externalCalendarSync} />
                  )}
                  <CardMenuItem text={t('IMPORT_AND_PROCESS_WORKFLOWS')} onClick={() => this.handleImportAndProcessWorkflowsDialog(true)} />
                  <CardMenuItem text={t('REASSIGN_LEASES_TO_RS_TEAM')} onClick={this.handleReassignActiveLeasesToRS} />
                </div>
              )}
              <Divider />
              <CardMenuItem text={t('LOGOUT')} onClick={this.handleLogout} />
            </CardMenu>
          </AppBarActions>
        </AppBar>

        <FullScreenDialog
          ref={dialog => (this.programsDataDialog = dialog)}
          title={
            <DialogTitle>
              <span>{t('PROGRAMS')}</span>
            </DialogTitle>
          }>
          {isLoading ? <PreloaderBlock size="small" /> : <ProgramsList programs={programs} properties={properties} teams={tenantTeams} />}
        </FullScreenDialog>
        <FullScreenDialog
          ref={dialog => (this.importDataDialog = dialog)}
          onClose={this.handleCloseImportDataDialog}
          title={
            <DialogTitle>
              <span>{t('IMPORT_DATA_DIALOG_TITLE', { tenantName: authUser.tenantName })}</span>
            </DialogTitle>
          }>
          <ImportData />
        </FullScreenDialog>
        <FullScreenDialog
          ref={dialog => (this.exportDBDialog = dialog)}
          title={
            <DialogTitle>
              <span>{t('EXPORT_DATABASE')}</span>
            </DialogTitle>
          }>
          <ExportDatabase />
        </FullScreenDialog>
        {showOverridesSection && (
          <Section title={t('COMMS_OVERRIDE')} padContent={false}>
            <SubHeader error> {JSON.stringify(overrides, null, 2)} </SubHeader>
          </Section>
        )}
        <Section title={t('TEAMS_ON_TENANT')} padContent={false}>
          <Table className={cf('teamsTable')}>
            <RowHeader key={'hdrTeams'}>
              <Cell type="ctrlCell" width={55} />
              <Cell width="10%">{t('NAME')}</Cell>
              <Cell width="5%" />
              <Cell width="10%">{t('MODULE')}</Cell>
              <Cell textAlign="center">{t('TEAM_MEMBERS')}</Cell>
              <Cell textAlign="center">{t('PARTY_ROUTING_STRATEGY')}</Cell>
              <Cell textAlign="center">{t('CALL_ROUTING_STRATEGY')}</Cell>
              <Cell textAlign="center">{t('CALL_RECORDING_SETUP')}</Cell>
              <Cell textAlign="center">{t('NATIVE_COMMS_ENABLED')}</Cell>
              <Cell textAlign="center">{t('SEND_CALENDAR_EMAILS_ENABLED')}</Cell>
            </RowHeader>
            {tenantTeams && tenantTeams.map(this.renderTeam)}
          </Table>
        </Section>

        <Section title={t('UNUSED_PHONE_NUMBERS_RESERVED_FOR_TENANT')}>
          {unusedPhoneNumbers.length === 0 ? (
            t('NO_UNUSED_NUMBERS')
          ) : (
            <List className={cf('phoneSection')}>
              {unusedPhoneNumbers.map(item => (
                <ListItem key={item.phoneNumber}>
                  <MainSection>{`${formatPhoneNumber(item.phoneNumber)}`}</MainSection>
                </ListItem>
              ))}
            </List>
          )}
        </Section>
        <MsgBox
          id="cleanDatabaseDialog"
          overlayClassName={cf('clearTenantDialog')}
          open={this.state.cleanDatabaseDialogIsVisible}
          onCloseRequest={this.closeCleanDatabaseDialog}
          title={`${t('CLEAR_DATABASE')}?`}
          lblOK={t('CLEAR_DATABASE')}
          onOKClick={() => this.handleClickClearDatabase()}
          lblCancel={t('CANCEL')}>
          <Text>{t('CLEAR_DATABASE_WARNING')}</Text>
        </MsgBox>
        {this.state.isCloseOrArchivePartiesDialogOpen && (
          <CloseOrArchivePartiesDialog
            open={this.state.isCloseOrArchivePartiesDialogOpen}
            onClose={() => this.handleCloseOrArchivePartiesDialog(false)}
            handleShowImportDataDialog={() => this.handleShowImportDataDialog()}
            properties={this.props.properties}
          />
        )}
        {this.state.isImportAndProcessWorkflowsDialogOpen && (
          <ImportAndProcessWorkflowsDialog
            open={this.state.isImportAndProcessWorkflowsDialogOpen}
            enableImport={importEnabled}
            onOKClick={this.handleImportAndProcessWorkflows}
            onClose={() => this.handleImportAndProcessWorkflowsDialog(false)}
          />
        )}
        <MsgBox
          id="importAndProcessWorkflowsAlreadyInProgress"
          open={this.props.importAndProcessWorkflowsAlreadyInProgress}
          onCloseRequest={this.props.clearImportAndProcessWorkflowsInProgress}
          title={t('JOB_ALREADY_IN_PROGRESS_TITLE')}
          hideCancelButton>
          <Text>{t('JOB_ALREADY_IN_PROGRESS_MSG')}</Text>
        </MsgBox>
      </div>
    );
  }
}
