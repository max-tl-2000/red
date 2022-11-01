/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { FullScreenDialog, DialogTitle, FlyOut, IconButton, FlyOutOverlay, AutoSize, Typography as T } from 'components';
const { SubHeader } = T;
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { fetchLogsByPartyId, openManualActivityLogDialog } from 'redux/modules/activityLogStore';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import { cf } from './ActivityLogDialog.scss';
import ActivityLog from '../ActivityLog/ActivityLog';
import ManualActivityLogDialog from '../ManulActivityLogDialog/ManualActivityLogDialog';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';
import { isRevaAdmin } from '../../../common/helpers/auth';

@connect(
  (state, props) => ({
    activityLogs: state.activityLog.activityLogs,
    users: state.globalStore.get('users'),
    isLoadingActivityLogs: state.activityLog.loading,
    timezone: getPartyTimezone(state, props),
    showManualActivityLogDialog: state.activityLog.showManualActivityLogDialog,
    currentUser: state.auth.user,
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchLogsByPartyId,
        openManualActivityLogDialog,
      },
      dispatch,
    ),
)
@observer
export default class ActivityLogDialog extends Component {
  static propTypes = {
    openManualActivityLogDialog: PropTypes.func,
    showManualActivityLogDialog: PropTypes.bool,
  };

  loadActivityLogs = () => {
    const { partyId, fetchLogsByPartyId: fetchLogs, timezone } = this.props;
    fetchLogs(partyId, timezone);
  };

  handleCloseFlyout = () => {
    this.addActivityLogFlyout.close();
  };

  storeRef = ref => {
    this.addActivityLogFlyout = ref;
  };

  renderDialogFlyoutActions = () => (
    <div className={cf('dialog-actions')}>
      <FlyOut ref={this.storeRef} expandTo="left-bottom" overTrigger closeOnTapAway>
        <IconButton iconStyle="light" iconName="dots-vertical" />
        <FlyOutOverlay>
          <SubHeader
            className={cf('button-action')}
            onClick={() => {
              this.handleCloseFlyout();
              this.props.openManualActivityLogDialog();
            }}>
            {t('ADD_ACTIVITY_LOG')}
          </SubHeader>
        </FlyOutOverlay>
      </FlyOut>
    </div>
  );

  renderDialogActions = () => (
    <AutoSize breakpoints={false} className={cf('wrapper')}>
      {() => this.renderDialogFlyoutActions()}
    </AutoSize>
  );

  render() {
    const { loadActivityLogs, props } = this;
    const { model, activityLogs, users, isLoadingActivityLogs, timezone, showManualActivityLogDialog, partyId, currentUser } = props;

    return (
      <div>
        <FullScreenDialog
          id="activityLogDialog"
          open={model.isOpen}
          onCloseRequest={model.close}
          paddedScrollable
          title={
            <DialogTitle>
              <span>{t('ACTIVITY_LOGS_MODAL_TITLE')}</span>
            </DialogTitle>
          }
          actions={isRevaAdmin(currentUser) && this.renderDialogActions()}>
          <ActivityLog activityLogs={activityLogs} users={users} timezone={timezone} loading={isLoadingActivityLogs} loadActivityLogs={loadActivityLogs} />
          {showManualActivityLogDialog && <ManualActivityLogDialog partyId={partyId} />}
        </FullScreenDialog>
      </div>
    );
  }
}
