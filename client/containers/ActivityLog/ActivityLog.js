/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';

import { t } from 'i18next';
import { PreloaderBlock, RedTable } from 'components';
import { cf } from './ActivityLog.scss';
import { ACTIVITY_TYPES, COMPONENT_TYPES, SUB_COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';
import { formatMoment } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { DATE_TIME_FORMAT } from '../../../common/date-constants';

const { Table, Row, RowHeader, Cell, TextPrimary, TextSecondary } = RedTable;

export default class ActivityLog extends Component {
  static propTypes = {
    activityLogs: PropTypes.array,
    loading: PropTypes.bool,
    users: PropTypes.object,
    loadActivityLogs: PropTypes.func,
  };

  componentWillMount() {
    this.props.loadActivityLogs();
  }

  getUserNames = (userIds = []) => {
    if (!userIds) return '';
    const { props } = this;
    const { users } = props;

    const names = userIds.map(id => {
      // be careful to consider the cases where the
      // entities can be null or undefined
      let user = users.get(id);

      if (!user) {
        // TODO: implement a client side logger that can be used
        // in leasing and in consumer apps so we can get warnings
        // when this situation happen again
        console.warn(`cannot find a user identified by id: ${id}`);
        user = {};
      }

      return user.fullName || `${id} - user not found`;
    });
    return names.join(', ');
  };

  formatActionType(action) {
    return action === ACTIVITY_TYPES.DUPLICATE ? ACTIVITY_TYPES.NEW : action;
  }

  getActionTypeFormatting(action) {
    let result;

    switch (action) {
      case ACTIVITY_TYPES.NEW:
      case ACTIVITY_TYPES.DUPLICATE:
      case ACTIVITY_TYPES.ADD_MANUAL_HOLD:
      case ACTIVITY_TYPES.ADD_LEASE_HOLD:
        result = cf('text-cell-new');
        break;
      case ACTIVITY_TYPES.UPDATE:
      case ACTIVITY_TYPES.GUEST_MERGED:
      case ACTIVITY_TYPES.INVENTORY_RESERVED:
      case ACTIVITY_TYPES.INVENTORY_RELEASED:
      case ACTIVITY_TYPES.TERMINATED:
        result = cf('text-cell-update');
        break;
      case ACTIVITY_TYPES.REMOVE:
      case ACTIVITY_TYPES.CLOSE:
      case ACTIVITY_TYPES.DECLINE:
      case ACTIVITY_TYPES.REVOKE:
      case ACTIVITY_TYPES.REMOVE_MANUAL_HOLD:
      case ACTIVITY_TYPES.REMOVE_LEASE_HOLD:
      case ACTIVITY_TYPES.DEACTIVATE:
      case ACTIVITY_TYPES.ARCHIVE:
        result = cf('text-cell-remove');
        break;
      case ACTIVITY_TYPES.MERGE_PARTIES:
        result = cf('text-cell-merge-parties');
        break;
      case ACTIVITY_TYPES.PUBLISH:
      case ACTIVITY_TYPES.EMAIL:
      case ACTIVITY_TYPES.TEXT:
      case ACTIVITY_TYPES.PRINT:
      case ACTIVITY_TYPES.SUBMIT:
      case ACTIVITY_TYPES.APPROVE:
      case ACTIVITY_TYPES.CONFIRM:
      case ACTIVITY_TYPES.DONT_MERGE_PARTIES:
        result = cf('text-cell-quote');
        break;
      default:
        result = cf('text-cell');
    }

    return result;
  }

  getDefaultFormat = ({ component, details = {} }) => `${component} (#${details.displayNo})`;

  getComponentMergeInfo = ({ details }, timezone) => {
    const mergeDate = `${formatMoment(details.merged.date, { format: DATE_TIME_FORMAT, timezone })}`;
    return `${t('MERGED')} ${mergeDate}`;
  };

  getFormattedComponent = actLog => {
    switch (actLog.component) {
      case COMPONENT_TYPES.INVENTORY_STATUS:
      case COMPONENT_TYPES.QUOTE:
        return `${actLog.component}`;
      case COMPONENT_TYPES.CONTACT_EVENT:
        return `${actLog.component} (${actLog.details.type}) (#${actLog.details.displayNo})`;
      case COMPONENT_TYPES.APPLICATION: {
        if (ACTIVITY_TYPES.EMAIL === actLog.type || ACTIVITY_TYPES.TEXT === actLog.type) {
          return `${actLog.component}`;
        }
        return this.getDefaultFormat(actLog);
      }
      default:
        return this.getDefaultFormat(actLog);
    }
  };

  formatComponent = (actLog, timezone, index) => (
    <Cell className={cf('text-cell-component')} width={230}>
      <TextPrimary dataId={`activityComponentRow_${this.getFormattedComponent(actLog)}_${index}`} inline={true}>
        {this.getFormattedComponent(actLog)}
      </TextPrimary>
      {actLog.details.merged && <TextSecondary>{this.getComponentMergeInfo(actLog, timezone)}</TextSecondary>}
    </Cell>
  );

  getAgentName = actLog => {
    if (actLog.component === COMPONENT_TYPES.INVENTORY_STATUS) {
      if (!actLog.agentName) return t('ACTIVITY_LOG_USER_SYSTEM');
      return actLog.agentName;
    }

    if (actLog.component === COMPONENT_TYPES.APPLICATION && actLog.subComponent === SUB_COMPONENT_TYPES.MOVED) {
      return actLog.details.memberName;
    }
    switch (actLog.details.createdByType) {
      case DALTypes.CreatedByType.SYSTEM:
        return t('ACTIVITY_LOG_USER_SYSTEM');
      case DALTypes.CreatedByType.SELF_SERVICE:
        return t('ACTIVITY_LOG_SELF_SERVICE');
      default:
        return this.getUserNames(actLog.context.users);
    }
  };

  renderRow = (actLog, index) => {
    const { timezone } = this.props;
    const agentName = this.getAgentName(actLog);
    const isMergePartiesLog = actLog.type === ACTIVITY_TYPES.MERGE_PARTIES;

    return (
      <Row key={`row-${actLog.id}`} className={cf({ 'row-background': isMergePartiesLog })}>
        <Cell className={cf('text-cell')} width={230}>
          <TextPrimary dataId={`activityTime_Row${index}`} inline={true}>
            {formatMoment(actLog.created_at, { timezone, format: DATE_TIME_FORMAT })}
          </TextPrimary>
        </Cell>
        <Cell className={cf('text-cell')} width={180}>
          <TextPrimary dataId={`activityAgentNameRow_${agentName}_${index}`} inline={true}>
            {agentName}
          </TextPrimary>
        </Cell>
        <Cell className={this.getActionTypeFormatting(actLog.type)} width={120}>
          <TextPrimary dataId={`activityActionRow_${actLog.type}_${index}`} inline={true}>
            {this.formatActionType(actLog.type)}
          </TextPrimary>
        </Cell>
        {this.formatComponent(actLog, timezone, index)}
        <Cell width={'50%'} className={cf('text-cell')}>
          <TextPrimary dataId={`activityDetailedRow_${index}`} inline={true}>
            {actLog.formattedDetails}
          </TextPrimary>
        </Cell>
      </Row>
    );
  };

  render({ loading, activityLogs } = this.props) {
    if (loading) {
      return <PreloaderBlock />;
    }

    return (
      <div>
        <Table>
          <RowHeader>
            <Cell width={230}>{t('ACTIVITYLOG_TABLE_COLUMN_TIME')}</Cell>
            <Cell width={180}>{t('ACTIVITYLOG_TABLE_COLUMN_AGENT')}</Cell>
            <Cell width={120}>{t('ACTIVITYLOG_TABLE_COLUMN_ACTION')}</Cell>
            <Cell width={230}>{t('ACTIVITYLOG_TABLE_COLUMN_COMPONENT')}</Cell>
            <Cell width={'50%'}>{t('ACTIVITYLOG_TABLE_COLUMN_DETAILS')}</Cell>
          </RowHeader>
          {activityLogs && activityLogs.map(this.renderRow)}
        </Table>
      </div>
    );
  }
}
