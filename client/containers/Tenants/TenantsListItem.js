/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as tenantActions from 'redux/modules/tenantsStore';
import isEqual from 'lodash/isEqual';
import differenceBy from 'lodash/differenceBy';
import { t } from 'i18next';

import { enumToList } from 'enums/enumHelper';
import HideOnProdElement from 'custom-components/HideOnProdElement/HideOnProdElement';

import { Icon, IconButton, Dropdown, RedTable, Typography as T, Tooltip, PreloaderBlock, MsgBox, CardMenu, CardMenuItem, CheckBox } from 'components';
import cfg from 'helpers/cfg';
import { ResetPasswordTypes } from '../../../common/enums/enums';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './TenantsListItem.scss';
import { formatSelectedPhoneNumbers } from '../../helpers/dropdown-phone-helper';
import { getTenantComputedProps } from '../../redux/modules/tenantsStore';
import shallowCompare from '../../helpers/shallowCompare';
import { formatPhone } from '../../../common/helpers/phone-utils';

const { Row, Cell } = RedTable;

const { PaymentProviderMode, ScreeningProviderMode, LeasingProviderMode, BackendMode } = DALTypes;

let paymentProviderModeItems;
let screeningProviderModeItems;
let leasingProviderModeItems;
let backendModeItems;

const resetPasswordTypes = Object.entries(ResetPasswordTypes);

@connect(
  state => ({
    availablePhoneNumbers: state.tenants.availablePhoneNumbers,
    isLoadingPhoneNumbers: state.tenants.isLoadingPhoneNumbers,
  }),
  dispatch =>
    bindActionCreators(
      {
        ...tenantActions,
      },
      dispatch,
    ),
)
export default class TenantsListItem extends React.Component {
  static propTypes = {
    tenant: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
    }).isRequired,
    availablePhoneNumbers: PropTypes.array,
    isLoadingPhoneNumbers: PropTypes.bool,
    selected: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    const {
      disableImportUpdateOptimization = false,
      duplicateDetectionEnabled = false,
      revaPricingAsRms = false,
      sendGridSandboxEnabled = false,
      disableResidentsImportOptimization = false,
    } = props.tenant.metadata || {};
    this.state = {
      selectedPhoneNumbers: [],
      numbersToDeassignThatAreInUse: [],
      disableImportUpdateOptimization,
      disableResidentsImportOptimization,
      duplicateDetectionEnabled,
      sendGridSandboxEnabled,
      revaPricingAsRms,
    };

    // cache values to avoid iterating over an over these values on each render
    paymentProviderModeItems = paymentProviderModeItems || enumToList(PaymentProviderMode);
    screeningProviderModeItems = screeningProviderModeItems || enumToList(ScreeningProviderMode);
    leasingProviderModeItems = leasingProviderModeItems || enumToList(LeasingProviderMode);
    backendModeItems = backendModeItems || enumToList(BackendMode);

    this.paymentProviderModeItems = paymentProviderModeItems;
    this.screeningProviderModeItems = screeningProviderModeItems;
    this.leasingProviderModeItems = leasingProviderModeItems;
    this.backendModeItems = backendModeItems;
  }

  refreshTenantSchema = (noOfTeams, bigDataCount) => {
    const { refreshTenantSchema } = this.props;
    refreshTenantSchema && refreshTenantSchema(this.props.tenant, noOfTeams, bigDataCount);
  };

  openWarningDialog = () => this.setState({ isWarningDialogOpen: true });

  closeWarningDialog = args => {
    const { ddPhones, props } = this;
    // if the dialog is closed because the ESC key was pressed or because the Cancel button was clicked
    if (args.source === 'escKeyPress' || (args.source === 'dataAction' && args.command === 'CANCEL')) {
      const { tenantPhoneNumbers } = this.getComputedProps(props.tenant);
      if (ddPhones) {
        // restore the previous values
        // this is needed because the component keeps its own state and since none of the props were actually changed
        // the component won't see that we wanted to revert the changes we did. So using the imperative api of the
        // dropdown we achieve this. Ideally we should rarely rely on this way of undoing things, but since in this
        // case we don't really atler the tenant state until save we had no choice but to use this approach
        ddPhones.value = tenantPhoneNumbers;
      }
    }
    this.setState({ isWarningDialogOpen: false });
  };

  updatePhoneNumbersForTenant = (tenant, editTenantPhoneNumbers, selectedPhoneNumbers) => {
    const phoneNumbers = selectedPhoneNumbers.map(phoneNumber => this.getPhoneNumber(tenant.metadata.phoneNumbers, phoneNumber));
    editTenantPhoneNumbers(tenant.id, { metadata: { phoneNumbers } });
  };

  updatePaymentProviderModeForTenant = (tenant, newMode) => this.props.editTenantMetadata(tenant.id, { metadata: { paymentProviderMode: newMode } });

  updateScreeningProviderModeForTenant = (tenant, newMode) => this.props.editTenantMetadata(tenant.id, { metadata: { screeningProviderMode: newMode } });

  updateLeasingProviderModeForTenant = (tenant, newMode) => this.props.editTenantMetadata(tenant.id, { metadata: { leasingProviderMode: newMode } });

  updateBackendProviderModeForTenant = (tenant, newMode) => {
    let backendIntegration;

    switch (newMode) {
      case BackendMode.YARDI:
        backendIntegration = { name: newMode, skipInventoryStateImport: true, skipResLeaseChargesExport: false, skipFinReceiptsExport: false };
        break;
      case BackendMode.MRI:
        backendIntegration = { name: newMode, skipInventoryStateImport: true };
        break;
      case BackendMode.MRI_NO_EXPORT:
        backendIntegration = { name: BackendMode.MRI, skipInventoryStateImport: true, skipExportToERP: true };
        break;
      case BackendMode.NONE:
        backendIntegration = {};
        break;
      default:
        break;
    }

    this.props.editTenantMetadata(tenant.id, { metadata: { backendIntegration } });
  };

  toggleRevaPricingAsRms = tenant => {
    const revaPricingAsRms = !this.state.revaPricingAsRms;
    this.setState({ revaPricingAsRms });
    this.props.editTenantMetadata(tenant.id, { metadata: { revaPricingAsRms } });
  };

  toggleImportUpdateOptimization = tenant => {
    const disableImportUpdateOptimization = !this.state.disableImportUpdateOptimization;
    this.setState({ disableImportUpdateOptimization });
    this.props.editTenantMetadata(tenant.id, { metadata: { disableImportUpdateOptimization } });
  };

  toggleResidentsImportOptimization = tenant => {
    const disableResidentsImportOptimization = !this.state.disableResidentsImportOptimization;
    this.setState({ disableResidentsImportOptimization });
    this.props.editTenantMetadata(tenant.id, { metadata: { disableResidentsImportOptimization } });
  };

  toggleDuplicateDetection = tenant => {
    const duplicateDetectionEnabled = !this.state.duplicateDetectionEnabled;
    this.setState({ duplicateDetectionEnabled });
    this.props.editTenantMetadata(tenant.id, { metadata: { duplicateDetectionEnabled } });
  };

  toggleSendGridSandboxEnabled = tenant => {
    const sendGridSandboxEnabled = !this.state.sendGridSandboxEnabled;
    this.setState({ sendGridSandboxEnabled });
    this.props.editTenantMetadata(tenant.id, { metadata: { sendGridSandboxEnabled } });
  };

  handleOkClick = () => {
    const { tenant, editTenantPhoneNumbers } = this.props;
    this.updatePhoneNumbersForTenant(tenant, editTenantPhoneNumbers, this.state.selectedPhoneNumbers);
  };

  // if the phoneNumber was already part of the prevPhoneNumbers array, we will return the object from prevPhoneNumbers,
  // because beside the number it might also contain some extra properties (eg. { phoneNumber: '16503381460', isUsed: true, ownerType: 'user', ownerId: GUID })
  // otherwise, return an object similar to: { phoneNumber: '16503381460' }
  getPhoneNumber = (prevPhoneNumbers, phoneNumber) => {
    const result = prevPhoneNumbers.find(p => p.phoneNumber === phoneNumber);
    return !result ? { phoneNumber } : result;
  };

  getNumbersToDeassignThatAreInUse = (tenant, prevNumbers, selectedPhoneNumbers) => {
    const numbersToDeassign = differenceBy(prevNumbers, selectedPhoneNumbers);
    return tenant.metadata.phoneNumbers.filter(p => p.isUsed && numbersToDeassign.includes(p.phoneNumber));
  };

  handleEditPhoneNumbers = ({ ids: selectedPhoneNumbers }) => {
    const { tenant, editTenantPhoneNumbers } = this.props;
    const prevNumbers = tenant.metadata.phoneNumbers.map(p => p.phoneNumber);
    this.setState({ selectedPhoneNumbers });

    if (!isEqual(selectedPhoneNumbers, prevNumbers)) {
      const numbersToDeassignThatAreInUse = this.getNumbersToDeassignThatAreInUse(tenant, prevNumbers, selectedPhoneNumbers);
      this.setState({ numbersToDeassignThatAreInUse });

      if (numbersToDeassignThatAreInUse.length > 0) {
        this.openWarningDialog();
      } else {
        this.updatePhoneNumbersForTenant(tenant, editTenantPhoneNumbers, selectedPhoneNumbers);
      }
    }
  };

  handleEditPaymentProviderMode = ({ id: selectedPaymentProviderMode }) => {
    const { tenant } = this.props;
    this.updatePaymentProviderModeForTenant(tenant, selectedPaymentProviderMode);
  };

  handleEditScreeningProviderMode = ({ id: selectedScreeningProviderMode }) => {
    const { tenant } = this.props;
    this.updateScreeningProviderModeForTenant(tenant, selectedScreeningProviderMode);
  };

  handleEditLeasingProviderMode = ({ id: selectedLeasingProviderMode }) => {
    const { tenant } = this.props;
    this.updateLeasingProviderModeForTenant(tenant, selectedLeasingProviderMode);
  };

  handleEditBackendProviderMode = ({ id: selectedBackendProviderMode }) => {
    const { tenant } = this.props;
    this.updateBackendProviderModeForTenant(tenant, selectedBackendProviderMode);
  };

  renderTeamPhoneNumberLine(number, index) {
    return (
      <T.Text key={`${number.phoneNumber}_${index}`} secondary>
        {formatPhone(number.phoneNumber)}
      </T.Text>
    );
  }

  storeDD = ref => {
    this.ddPhones = ref;
  };

  renderPhoneNumberCell(workInProgress, enablePhoneSupport, tenantPhoneNumbers, phoneNumberItems) {
    if (workInProgress || (this.props.isLoadingPhoneNumbers && enablePhoneSupport)) {
      return <PreloaderBlock size="small" style={{ minHeight: 52 }} />;
    }

    return (
      <div className={cf('details')}>
        <Dropdown
          ref={this.storeDD}
          appendToBody={true}
          placeholder={t('NONE')}
          items={phoneNumberItems}
          selectedValue={tenantPhoneNumbers}
          onClose={this.handleEditPhoneNumbers}
          formatSelected={formatSelectedPhoneNumbers}
          styled={false}
          multiple
          id="phones"
        />
      </div>
    );
  }

  renderPaymentProviderCell(workInProgress, paymentProviderMode = this.paymentProviderModeItems[0].id) {
    if (workInProgress) {
      return <PreloaderBlock size="small" style={{ minHeight: 52 }} />;
    }
    return (
      <div className={cf('details')}>
        <Dropdown
          placeholder={t('NONE')}
          items={this.paymentProviderModeItems}
          selectedValue={paymentProviderMode}
          onChange={this.handleEditPaymentProviderMode}
          styled={false}
        />
      </div>
    );
  }

  renderScreeningProviderCell(workInProgress, screeningProviderMode = this.screeningProviderModeItems[0].id) {
    if (workInProgress) {
      return <PreloaderBlock size="small" style={{ minHeight: 52 }} />;
    }
    return (
      <div className={cf('details')}>
        <Dropdown
          placeholder={t('NONE')}
          items={this.screeningProviderModeItems}
          selectedValue={screeningProviderMode}
          onChange={this.handleEditScreeningProviderMode}
          styled={false}
        />
      </div>
    );
  }

  renderLeasingProviderCell(workInProgress, leasingProviderMode = this.leasingProviderModeItems[0].id) {
    if (workInProgress) {
      return <PreloaderBlock size="small" style={{ minHeight: 52 }} />;
    }
    return (
      <div className={cf('details')}>
        <Dropdown
          placeholder={t('NONE')}
          items={this.leasingProviderModeItems}
          selectedValue={leasingProviderMode}
          onChange={this.handleEditLeasingProviderMode}
          styled={false}
        />
      </div>
    );
  }

  renderBackendProviderCell(workInProgress, backendProviderMode = BackendMode.NONE) {
    if (workInProgress) {
      return <PreloaderBlock size="small" style={{ minHeight: 52 }} />;
    }
    return (
      <div className={cf('details')}>
        <Dropdown
          placeholder={t('NONE')}
          items={this.backendModeItems}
          selectedValue={backendProviderMode}
          onChange={this.handleEditBackendProviderMode}
          styled={false}
        />
      </div>
    );
  }

  renderDeleteTenantButton = (tenant, onClickDeleteTenant) => {
    const disabled = cfg('cloudEnv') === 'prod';
    return <CardMenuItem text={t('DELETE_TENANT')} iconName="delete" onClick={() => onClickDeleteTenant(tenant)} disabled={disabled} />;
  };

  renderResetPasswordOptions = (tenant, onClickSetPassword) =>
    resetPasswordTypes.map(([key, value]) => (
      <CardMenuItem
        key={`option-${key}`}
        text={t('RESET_PASSWORD_TENANT', { type: t(key) })}
        iconName="lock"
        onClick={() => onClickSetPassword(tenant, value)}
      />
    ));

  shouldComponentUpdate = (nextProps, nextState) => {
    // this is important as it bails out of rendering if tenant or selected props didn't change
    const currentProps = this.props;
    const nextTenant = nextProps?.tenant;
    const currentTenant = currentProps?.tenant;
    const { isLoadingPhoneNumbers: cIsLoadingPhoneNumbers, availablePhoneNumbers: cAvailablePN } = currentProps;
    const { isLoadingPhoneNumbers: nIsLoadingPhoneNumbers, availablePhoneNumbers: nAvailablePN } = nextProps;

    const currentState = this.state;

    const stateChanged = !shallowCompare(currentState, nextState, [
      'isWarningDialogOpen',
      'numbersToDeassignThatAreInUse',
      'selectedPhoneNumbers',
      'duplicateDetectionEnabled',
      'sendGridSandboxEnabled',
      'disableImportUpdateOptimization',
      'disableResidentsImportOptimization',
      'revaPricingAsRms',
    ]);

    const shouldUpdate =
      nextTenant !== currentTenant ||
      nextProps.selected !== currentProps.selected ||
      cIsLoadingPhoneNumbers !== nIsLoadingPhoneNumbers ||
      cAvailablePN !== nAvailablePN;

    return shouldUpdate || stateChanged;
  };

  getDropdownDisplayLabel = (selection, items) => (items?.length ? items.find(mode => selection === mode.id)?.text || items[0]?.text : '');

  getComputedProps = tenant => {
    const { availablePhoneNumbers } = this.props;
    const { computedProps } = tenant;
    if (computedProps) return computedProps;

    return getTenantComputedProps({ metadata: tenant.metadata, availablePhoneNumbers });
  };

  render() {
    const {
      tenant,
      onClickDeleteTenant,
      onClickSetPassword,
      onClickRefreshLeaseTemplates,
      style,
      onClickRefreshAptexxData,
      onTenantItemClick,
      selected,
      onClickGenerateToken,
    } = this.props;

    const { updatingTenantMetadata } = this.state;
    const { id, name, metadata, workInProgress } = tenant;
    const { enablePhoneSupport, paymentProviderMode, screeningProviderMode, leasingProviderMode, backendIntegration } = metadata || {};
    const { name: backendMode, skipExportToERP = false } = backendIntegration || {};
    const { tenantPhoneNumbers, phoneNumberItems, phoneNumberCellLabel } = this.getComputedProps(tenant);

    const backendProviderMode = !skipExportToERP ? backendMode : BackendMode.MRI_NO_EXPORT;
    const teamPhoneNumberLines = this.state.numbersToDeassignThatAreInUse.map((number, index) => this.renderTeamPhoneNumberLine(number, index));
    const importUpdateOptimizationIconName = !this.state.disableImportUpdateOptimization ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
    const importResidentsOptimizationIconName = !this.state.disableResidentsImportOptimization ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
    const importDuplicateDetectionIconName = this.state.duplicateDetectionEnabled ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
    const sendGridSandboxIconName = this.state.sendGridSandboxEnabled ? 'checkbox-marked-outline' : 'checkbox-blank-outline';
    const revaPricingAsRmsIconName = this.state.revaPricingAsRms ? 'checkbox-marked-outline' : 'checkbox-blank-outline';

    return (
      <div style={style}>
        <Row onClick={onTenantItemClick} selected={selected}>
          <Cell width={80} noSidePadding textAlign="center">
            <Icon name="home" />
          </Cell>
          <Cell style={{ minWidth: '200px' }} smallPadding noPaddingLeft>
            <T.Text bold>{name}</T.Text>
            <T.Caption>{id}</T.Caption>
          </Cell>
          {!selected && [
            <Cell smallPadding key="paymentProviderCell" textAlign="center" width={140}>
              <T.Caption>{this.getDropdownDisplayLabel(paymentProviderMode, this.paymentProviderModeItems)}</T.Caption>
            </Cell>,
            <Cell smallPadding key="screeningProviderCell" textAlign="center" width={140}>
              <T.Caption>{this.getDropdownDisplayLabel(screeningProviderMode, this.screeningProviderModeItems)}</T.Caption>
            </Cell>,
            <Cell smallPadding key="leasingProviderCell" textAlign="center" width={140}>
              <T.Caption>{this.getDropdownDisplayLabel(leasingProviderMode, this.leasingProviderModeItems)}</T.Caption>
            </Cell>,
            <Cell smallPadding key="backendProviderCell" textAlign="center" width={140}>
              <T.Caption>{this.getDropdownDisplayLabel(backendProviderMode, this.backendModeItems)}</T.Caption>
            </Cell>,
            <Cell smallPadding key="phoneNumberCell" textAlign="center" width={250}>
              <T.Caption>{phoneNumberCellLabel}</T.Caption>
            </Cell>,
          ]}
          {selected && [
            <Cell smallPadding key="paymentProviderCell" textAlign="center" width={140}>
              {this.renderPaymentProviderCell(updatingTenantMetadata, paymentProviderMode)}
            </Cell>,
            <Cell smallPadding key="screeningProviderCell" textAlign="center" width={140}>
              {this.renderScreeningProviderCell(updatingTenantMetadata, screeningProviderMode)}
            </Cell>,
            <Cell smallPadding key="leasingProviderCell" textAlign="center" width={140}>
              {this.renderLeasingProviderCell(updatingTenantMetadata, leasingProviderMode)}
            </Cell>,
            <Cell smallPadding key="backendProviderCell" textAlign="center" width={140}>
              {this.renderBackendProviderCell(updatingTenantMetadata, backendProviderMode)}
            </Cell>,
            <Cell smallPadding key="phoneNumberCell" textAlign="center" width={250}>
              {this.renderPhoneNumberCell(workInProgress, enablePhoneSupport, tenantPhoneNumbers, phoneNumberItems)}
            </Cell>,
          ]}
          <Cell smallPadding key="phoneSupportCell" textAlign="center" width={140}>
            <CheckBox disabled={true} checked={enablePhoneSupport} />
          </Cell>
          <Cell smallPadding textAlign="center" width={200} className={cf('actions')}>
            {workInProgress ? (
              <PreloaderBlock size="small" style={{ minHeight: 52 }} />
            ) : (
              <div>
                <HideOnProdElement>
                  <Tooltip text={t('REFRESH_TENANT_SCHEMA')}>
                    <IconButton
                      iconName="refresh"
                      className={cf('refreshWithTrimDownTeams')}
                      onClick={() => this.refreshTenantSchema(0, 0)}
                      disabled={tenantPhoneNumbers.length === 0}
                    />
                  </Tooltip>
                </HideOnProdElement>
                <CardMenu iconName="dots-vertical" appendToBody matchTriggerSize={false} skipInitialRenderingIfClosed>
                  {this.renderResetPasswordOptions(tenant, onClickSetPassword)}
                  {this.renderDeleteTenantButton(tenant, onClickDeleteTenant)}
                  <CardMenuItem text={t('GENERATE_TOKEN')} iconName="lock-unlocked" onClick={() => onClickGenerateToken(tenant)} />
                  {cfg('cloudEnv') !== 'prod' && (
                    <CardMenuItem
                      text={t('TENANT_REVA_PRICING_AS_RMS')}
                      iconName={revaPricingAsRmsIconName}
                      className={cf({ 'blue-icon': this.state.revaPricingAsRms })}
                      onClick={() => this.toggleRevaPricingAsRms(tenant)}
                    />
                  )}
                  <CardMenuItem
                    text={t('TENANT_IMPORT_UPDATE_OPTIMIZATION')}
                    iconName={importUpdateOptimizationIconName}
                    className={cf({ 'blue-icon': !this.state.disableImportUpdateOptimization })}
                    onClick={() => this.toggleImportUpdateOptimization(tenant)}
                  />
                  <CardMenuItem
                    text={t('TENANT_RESIDENTS_IMPORT_OPTIMIZATION')}
                    iconName={importResidentsOptimizationIconName}
                    className={cf({ 'blue-icon': !this.state.disableResidentsImportOptimization })}
                    onClick={() => this.toggleResidentsImportOptimization(tenant)}
                  />
                  <CardMenuItem
                    text={t('TENANT_DISABLE_DUPLICATE_DETECTION')}
                    iconName={importDuplicateDetectionIconName}
                    className={cf({ 'blue-icon': this.state.duplicateDetectionEnabled })}
                    onClick={() => this.toggleDuplicateDetection(tenant)}
                  />
                  <CardMenuItem
                    text={t('SENDGRID_SANDBOX_ENABLED')}
                    iconName={sendGridSandboxIconName}
                    className={cf({ 'blue-icon': this.state.sendGridSandboxEnabled })}
                    onClick={() => this.toggleSendGridSandboxEnabled(tenant)}
                  />
                  <CardMenuItem text={t('TENANT_REFRESH_LEASE_TEMPLATES')} iconName="refresh" onClick={() => onClickRefreshLeaseTemplates(tenant)} />
                  <CardMenuItem text={t('TENANT_REFRESH_APTEXX_DATA')} iconName="refresh" onClick={() => onClickRefreshAptexxData(tenant)} />
                  <HideOnProdElement>
                    <CardMenuItem text={'Refresh tenant with big data (100 parties)'} iconName="refresh" onClick={() => this.refreshTenantSchema(0, 100)} />
                  </HideOnProdElement>
                  <HideOnProdElement>
                    <CardMenuItem text={'Refresh tenant with huge data (88 teams)'} iconName="refresh" onClick={() => this.refreshTenantSchema(88, 1000)} />
                  </HideOnProdElement>
                </CardMenu>
              </div>
            )}
          </Cell>
          <MsgBox
            open={this.state.isWarningDialogOpen}
            title={t('REMOVE_PHONE_NUMBERS')}
            onCloseRequest={this.closeWarningDialog}
            lblOK={t('MSG_BOX_BTN_REMOVE')}
            onOKClick={this.handleOkClick}
            lblCancel={t('CANCEL')}>
            <T.Text>{t('PHONE_NUMBERS_IN_USE')}</T.Text>
            <div className={cf('warningDialogLabel')}>{teamPhoneNumberLines}</div>
            <T.Text className={cf('warningDialogLabel')}>{t('COMMUNICATION_WILL_NOT_WORK_ANYMORE')}</T.Text>
          </MsgBox>
        </Row>
      </div>
    );
  }
}
