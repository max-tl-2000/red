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
import { cf } from './PartyGroup.scss';
import { formatMoment } from '../../../common/helpers/moment-utils';
import { displayedWorkflowNames } from '../../../common/enums/partyTypes';
import Button from '../../components/Button/Button';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { DATE_TIME_FORMAT } from '../../../common/date-constants';
import { DALTypes } from '../../../common/enums/DALTypes';

const { Table, Row, RowHeader, Cell, TextPrimary } = RedTable;

export default class PartyGroup extends Component {
  static propTypes = {
    loading: PropTypes.bool,
    partyGroupId: PropTypes.string,
    partyGroupWorkflows: PropTypes.array,
    timezone: PropTypes.string,
    users: PropTypes.object,
    loadPartiesByPartyGroupId: PropTypes.func,
  };

  componentWillMount() {
    const { partyGroupId } = this.props;

    this.props.loadPartiesByPartyGroupId(partyGroupId);
  }

  getAgentName = workflow => {
    const agent = this.props.users.find(u => u.id === workflow.userId);

    return agent?.fullName;
  };

  goToParty = id => {
    leasingNavigator.navigateToParty(id, { newTab: true });
  };

  getCloseReason = closeReasonId => t(DALTypes.ClosePartyReasons[closeReasonId]);

  getArchiveReason = archiveReasonId => t(DALTypes.ArchivePartyReasons[archiveReasonId]);

  renderRow = (workflow, index) => {
    const { timezone } = this.props;
    const agentName = this.getAgentName(workflow);

    const {
      created_at,
      workflowName,
      workflowState,
      metadata: { closeReasonId = '', archiveReasonId = '' },
      state,
    } = workflow;

    return (
      <Row key={`row-${workflow.id}`} className={cf({ 'row-background': true })}>
        <Cell width={'20%'}>
          <TextPrimary dataId={`workflowTime_Row${index}`} inline={true}>
            {formatMoment(created_at, { timezone, format: DATE_TIME_FORMAT })}
          </TextPrimary>
        </Cell>
        <Cell width={'15%'}>
          <TextPrimary dataId={`workflowNameRow_${workflowName}_${index}`} inline={true}>
            {displayedWorkflowNames[workflowName]}
          </TextPrimary>
        </Cell>
        <Cell width={'10%'}>
          <Button data-id="goToPartyBtn" label={t('GO_TO_PARTY')} type="flat" btnRole="primary" onClick={() => this.goToParty(workflow.id)} />
        </Cell>
        <Cell width={'15%'}>
          <TextPrimary dataId={`workflowStateRow_${state}_${index}`} inline={true}>
            {state}
          </TextPrimary>
        </Cell>
        <Cell width={'15%'}>
          <TextPrimary dataId={`workflowOwnerRow_${agentName}_${index}`} inline={true}>
            {agentName}
          </TextPrimary>
        </Cell>
        <Cell width={'10%'}>
          <TextPrimary dataId={`workflowStateRow_${workflowState}_${index}`} inline={true}>
            {workflowState}
          </TextPrimary>
        </Cell>
        <Cell width={'15%'}>
          <TextPrimary dataId={`workflowCloseReasonRow_${index}`} inline={true}>
            {(closeReasonId && this.getCloseReason(closeReasonId)) || (archiveReasonId && this.getArchiveReason(archiveReasonId)) || '-'}
          </TextPrimary>
        </Cell>
      </Row>
    );
  };

  render({ loading, partyGroupWorkflows } = this.props) {
    if (loading) {
      return <PreloaderBlock />;
    }

    return (
      <div>
        <Table>
          <RowHeader>
            <Cell width={'20%'}>{t('PARTYGROUP_TABLE_COLUMN_CREATION_DATE')}</Cell>
            <Cell width={'16%'}>{t('PARTYGROUP_TABLE_COLUMN_WORKFLOW_NAME')}</Cell>
            <Cell width={'9%'}>{t('PARTYGROUP_TABLE_COLUMN_PARTY_LINK')}</Cell>
            <Cell width={'15%'}>{t('PARTYGROUP_TABLE_COLUMN_WORKFLOW_POSITION')}</Cell>
            <Cell width={'15%'}>{t('PARTYGROUP_TABLE_COLUMN_OWNER')}</Cell>
            <Cell width={'10%'}>{t('PARTYGROUP_TABLE_COLUMN_ACTIVITY_LEVEL')}</Cell>
            <Cell width={'15%'}>{t('PARTYGROUP_TABLE_COLUMN_ARCHIVE_CLOSE_REASON')}</Cell>
          </RowHeader>
          {partyGroupWorkflows && partyGroupWorkflows.map(this.renderRow)}
        </Table>
      </div>
    );
  }
}
