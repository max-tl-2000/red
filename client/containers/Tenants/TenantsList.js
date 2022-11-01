/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import isEqual from 'lodash/isEqual';
import DocumentMeta from 'react-document-meta';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { t } from 'i18next';
import { observer, inject } from 'mobx-react';
import NavigationLinks from 'custom-components/NavigationLinks/NavigationLinks';
import { AppBar, AppBarActions, PreloaderBlock, RedTable, IconButton, Tooltip, MsgBox, Typography as T, CardMenuItem } from 'components';
import * as tenantActions from 'redux/modules/tenantsStore';
import TenantsListItem from './TenantsListItem';
import DeleteTenantConfirmationDialog from './DeleteTenantConfirmationDialog';
import ResetPasswordDialog from './ResetPasswordDialog';
import { ResetPasswordTypes } from '../../../common/enums/enums';
import CreateTenantDialog from './CreateTenantDialog';
import GenerateTokenDialog from './GenerateTokenDialog';
import { cf, g } from './TenantsList.scss';

const { Table, RowHeader, Cell } = RedTable;

@connect(
  state => ({
    tenants: state.tenants.tenants,
    isCreating: state.tenants.isCreating,
    isCleaningUpCommProvider: state.tenants.isCleaningUpCommProvider,
    error: state.tenants.error,
    isLoading: state.tenants.isLoading,
    accountsNotFound: state.tenants.accountsNotFound,
    domainToken: state.tenants.domainToken,
    isGeneratingToken: state.tenants.isGeneratingToken,
  }),
  dispatch =>
    bindActionCreators(
      {
        ...tenantActions,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class TenantsList extends React.Component {
  constructor(props) {
    super(props);

    this.errorsMap = {
      DUPLICATE_ACTIVE_ACCOUNTS: t('APTEXX_ACCOUNTS_DUPLICATED_FOUND_ERROR'),
      APTEXX_FETCH_FAILED: t('APTEXX_ACCOUNTS_FETCH_ERROR'),
    };
    this.aptexxErrors = Object.keys(this.errorsMap);

    this.state = {
      isDeleteTenantDialogOpen: false,
      tenantToDelete: {},
      tenantToSetPassword: {},
      openAptexxWarning: false,
      isCreateTenantDialogOpened: false,
      selectedTenantItemId: null,
      isTokenDialogOpen: false,
      tenantToGenerateTokenFor: {},
    };
  }

  getWarningText = (token, accountsNotFound) => {
    if (token) {
      return this.errorsMap[token] || token;
    }

    return t('APTEXX_ACCOUNTS_NOT_FOUND_ERROR', { accounts: accountsNotFound.join('", ') });
  };

  componentDidUpdate = prevProps => {
    const { accountsNotFound, error = {}, isCreating } = this.props;
    const { isCreateTenantDialogOpened } = this.state;
    const hasErrorChanged = !isEqual(prevProps.error, error);

    const isAptexxError = (error || {}).token && this.aptexxErrors.includes(error.token);
    const hasAccountsNotFoundChanged = !isEqual(prevProps.accountsNotFound, accountsNotFound);

    let stateToChange;

    if ((!!accountsNotFound.length && hasAccountsNotFoundChanged) || (hasErrorChanged && isAptexxError)) {
      stateToChange = { openAptexxWarning: true, aptexxWarningContent: this.getWarningText(error.token, accountsNotFound) };
    }

    if (isCreateTenantDialogOpened && prevProps.isCreating === true && isCreating === false) {
      stateToChange = { ...stateToChange, isCreateTenantDialogOpened: false };
    }

    if (stateToChange) {
      this.setState(stateToChange);
    }
  };

  componentWillMount() {
    const { props } = this;
    props.loadTenants();
    props.loadAvailablePhoneNumbers();
  }

  deleteTenant = tenant => {
    const { deleteTenant } = this.props;
    deleteTenant && deleteTenant(tenant);
    this.setState({ isDeleteTenantDialogOpen: false });
  };

  openDeleteTenantDialog = tenant => this.setState({ isDeleteTenantDialogOpen: true, tenantToDelete: tenant });

  onClickCancelDeleteTenant = () => this.setState({ isDeleteTenantDialogOpen: false });

  handleSetPassword = newPassword => {
    const { updatePasswordForType } = this.props;
    const {
      resetDialogType: type,
      tenantToSetPassword: { id: tenantId, name: tenantName },
    } = this.state;
    const payload = { password: newPassword, type };

    let account = '';
    if (type === ResetPasswordTypes.SFTP) account = `sftp-${tenantName}`;
    if (type === ResetPasswordTypes.LRO) account = `sftp-${tenantName}-lro`;

    updatePasswordForType && updatePasswordForType(tenantId, { ...payload, account });
    this.onClickCancelSetPassword();
  };

  openSetPasswordDialog = (tenant, type) =>
    this.setState({
      isPasswordDialogOpen: true,
      tenantToSetPassword: tenant,
      resetDialogType: type,
      resetPasswordDialogTitle: t('SET_PASSWORD_FOR_TENANT', { tenant: tenant.name, type }),
    });

  onClickCancelSetPassword = () => this.setState({ isPasswordDialogOpen: false });

  openGenerateTokenDialog = tenant =>
    this.setState({
      isTokenDialogOpen: true,
      tenantToGenerateTokenFor: tenant,
    });

  onClickCancelGenerateToken = () => this.setState({ isTokenDialogOpen: false });

  refreshLeaseTenantTemplates = tenant => {
    const { refreshLeaseTemplates } = this.props;
    refreshLeaseTemplates && refreshLeaseTemplates(tenant);
  };

  navigateToDashboard = () => {
    const { props } = this;
    props.leasingNavigator.navigateToDashboard();
  };

  onTenantItemClick = tenant => {
    if (tenant.id === this.state.selectedTenantItemId) return;
    this.setState({ selectedTenantItemId: tenant.id });
  };

  renderTenantList = () => {
    const { tenants } = this.props;

    return tenants.map(tenant => (
      <TenantsListItem
        key={`listItem-${tenant.id}`}
        tenant={tenant}
        selected={this.state.selectedTenantItemId === tenant.id}
        onClickDeleteTenant={this.openDeleteTenantDialog}
        onClickSetPassword={this.openSetPasswordDialog}
        onClickRefreshLeaseTemplates={this.refreshLeaseTenantTemplates}
        onClickRefreshAptexxData={this.refreshAptexxData}
        onClickGenerateToken={this.openGenerateTokenDialog}
        onTenantItemClick={() => this.onTenantItemClick(tenant)}
      />
    ));
  };

  refreshAptexxData = tenant => {
    const { refreshProviderData } = this.props;
    refreshProviderData && refreshProviderData(tenant);
  };

  openCreateTenantDialog = () => this.setState({ isCreateTenantDialogOpened: true });

  closeCreateTenantDialog = () => this.setState({ isCreateTenantDialogOpened: false });

  generateToken = async ({ tenantId, domain, useDefaultWebsiteTokenId, shouldValidateReferrer, allowedEndpoints }) =>
    this.props.generateDomainTokenForWebsite(tenantId, domain, useDefaultWebsiteTokenId, shouldValidateReferrer, allowedEndpoints);

  render({ tenants, error, isLoading, isCreating, isCleaningUpCommProvider } = this.props) {
    const hasData = !isLoading && tenants.length > 0;

    tenants = (tenants || []).sort((tenantA, tenantB) => (tenantA.name.toLowerCase() < tenantB.name.toLowerCase() ? -1 : 1));

    let tenantsCount = isLoading ? t('LOADING') : `Tenants (${tenants.length || t('TENANT_NONE')})`;
    tenantsCount = !error ? tenantsCount : '';

    return (
      <div className={cf(g('view-element'), 'adminView')}>
        <DocumentMeta title={`Reva: ${t('ADMIN_PAGE')}`} />
        <AppBar title={`${t('ADMIN_CONSOLE')} - ${tenantsCount}`} icon={<IconButton iconStyle="light" iconName="home" onClick={this.navigateToDashboard} />}>
          <AppBarActions>
            <Tooltip text={t('COMM_PROVIDER_CLEANUP')}>
              <IconButton
                iconStyle="light"
                iconName="delete-sweep"
                onClick={() => this.props.triggerCommunicationProviderCleanup()}
                loading={isCleaningUpCommProvider}
              />
            </Tooltip>
            <NavigationLinks>
              <CardMenuItem text={t('CREATE_TENANT')} onClick={this.openCreateTenantDialog} />
            </NavigationLinks>
          </AppBarActions>
        </AppBar>
        {!isLoading && (
          <RowHeader>
            <Cell width={80} noSidePadding textAlign="center" />
            <Cell style={{ minWidth: '200px' }} smallPadding noPaddingLeft>
              <T.Caption>{t('TENANT_LABEL')}</T.Caption>
            </Cell>
            <Cell smallPadding width={140} textAlign="center">
              <T.Caption>{t('APTEXX_MODE')}</T.Caption>
            </Cell>
            <Cell smallPadding width={140} textAlign="center">
              <T.Caption>{t('SCREENING_MODE')}</T.Caption>
            </Cell>
            <Cell smallPadding width={140} textAlign="center">
              <T.Caption>{t('LEASING_MODE')}</T.Caption>
            </Cell>
            <Cell smallPadding width={140} textAlign="center">
              <T.Caption>{t('BACKEND_MODE')}</T.Caption>
            </Cell>
            <Cell smallPadding width={250} textAlign="center">
              <T.Caption>{t('TENANT_PHONE_NUMBER')}</T.Caption>
            </Cell>
            <Cell smallPadding width={140} textAlign="center">
              <T.Caption>{t('PHONE_SUPPORT')}</T.Caption>
            </Cell>
            <Cell smallPadding textAlign="center" width={200}>
              <T.Caption>{t('ACTIONS')}</T.Caption>
            </Cell>
          </RowHeader>
        )}
        <div className="view-content">
          {isLoading && <PreloaderBlock size="small" style={{ minHeight: 300 }} />}
          {hasData && <Table>{this.renderTenantList()}</Table>}
        </div>
        <DeleteTenantConfirmationDialog
          open={this.state.isDeleteTenantDialogOpen}
          tenant={this.state.tenantToDelete}
          onClickCancel={this.onClickCancelDeleteTenant}
          onClickDelete={this.deleteTenant}
        />
        <CreateTenantDialog
          open={this.state.isCreateTenantDialogOpened}
          onCreateTenant={this.props.createTenant}
          onClose={this.closeCreateTenantDialog}
          tenants={this.props.tenants}
          error={error}
          workInProgress={isCreating}
        />
        <ResetPasswordDialog
          open={this.state.isPasswordDialogOpen}
          onClickSave={this.handleSetPassword}
          onClickCancel={this.onClickCancelSetPassword}
          tenant={this.state.tenantToSetPassword}
          title={this.state.resetPasswordDialogTitle}
        />
        <GenerateTokenDialog
          open={this.state.isTokenDialogOpen}
          tenant={this.state.tenantToGenerateTokenFor}
          token={this.props.domainToken}
          generateTokenMethod={this.generateToken}
          onClickCancel={this.onClickCancelGenerateToken}
          isGeneratingToken={this.props.isGeneratingToken}
        />
        {this.state.openAptexxWarning && (
          <MsgBox
            open={this.state.openAptexxWarning}
            onCloseRequest={() => this.setState({ openAptexxWarning: false })}
            onOKClick={this.props.onClose}
            lblOK={t('CLOSE')}
            hideCancelButton
            title={t('APTEXX_ACCOUNTS_ERROR_TITLE')}>
            <T.Text inline>{this.state.aptexxWarningContent}</T.Text>
          </MsgBox>
        )}
      </div>
    );
  }
}
