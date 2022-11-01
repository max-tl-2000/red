/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { t } from 'i18next';
import flatten from 'lodash/flatten';
import { RedTable, Dialog, DialogOverlay, DialogHeader, Typography, DialogActions, Button } from 'components';
import { windowOpen } from 'helpers/win-open';
import { fetchJobsByCategory } from 'redux/modules/jobsStore';
import { downloadDocument } from 'helpers/download-document';
import { cf } from './Jobs.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import typeOf from '../../../common/helpers/type-of';
import { MONTH_DATE_YEAR_HOUR_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import { formatMoment, toMoment } from '../../../common/helpers/moment-utils';
import { location } from '../../../common/helpers/globals';

const { Text, Caption } = Typography;

const { Table, Row, RowHeader, Cell, TextPrimary } = RedTable;

@connect(
  state => ({
    jobs: state.jobsStore.jobs,
    users: state.globalStore.get('users'),
    authUser: state.auth.user,
    userToken: state.auth.token,
    downloadLink: state.seedData.downloadLink,
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchJobsByCategory,
      },
      dispatch,
    ),
)
export default class Jobs extends Component {
  componentWillMount = () => {
    this.props.fetchJobsByCategory({ jobCategory: this.props.jobCategory });
  };

  getUserName = createdBy => {
    const user = this.props.users.size && this.props.users.find(u => u.id === createdBy);
    return user ? user.preferredName : '';
  };

  getMigrationResult = (result, resultToken) => {
    if (!result) return '';

    const formatParams = {
      filesProcessed: result.processed,
      filesUploaded: result.uploaded,
    };
    return ` (${t(resultToken, formatParams)})`;
  };

  getJobErrorToken = jobName => {
    switch (jobName) {
      case DALTypes.Jobs.MigrateDataFiles:
        return 'MIGRATE_ERRORS';
      case DALTypes.Jobs.ImportUpdateDataFiles:
        return 'IMPORT_UPDATES_ERRORS';
      case DALTypes.Jobs.ImportDataFiles:
      default:
        return 'IMPORT_ERRORS';
    }
  };

  renderError = (error, index) => {
    const errorMessage = typeOf(error) === 'string' ? t(error) : JSON.stringify(error, null, 2);
    return <code key={`jobError-${index}`}>{errorMessage}</code>;
  };

  renderJobErrors = (jobName, jobErrors) => {
    jobErrors = jobErrors.filter(e => !!e);
    if (!jobErrors || !jobErrors.length) {
      return <TextPrimary>{t('NO_ERRORS')}</TextPrimary>;
    }

    return (
      <Dialog expandTo="top-left">
        <a>{t('JOB_ERRORS')}</a>
        <DialogOverlay container={false}>
          <DialogHeader title={t(this.getJobErrorToken(jobName))} />
          <div className={cf('errors')}>
            <pre>{jobErrors.map(this.renderError)}</pre>
          </div>
          <DialogActions>
            <Button type="flat" data-action="close" label={t('CANCEL')} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  };

  renderEntityCount = (entityCount, stepName) => {
    if (stepName === DALTypes.ImportUpdateDataFilesSteps.CloseImportedParties) {
      return (
        <div key={entityCount.sheetName}>
          {t('IMPORTED_PARTIES_CLOSED_IN_PROPERTY', {
            partiesClosed: entityCount.count.toString().padStart(4),
            property: entityCount.property,
            count: entityCount.count,
          })}
        </div>
      );
    }

    return (
      <div key={entityCount.sheetName}>
        {t('ENTITY_COUNT', {
          count: entityCount.count.toString().padStart(4),
          sheetName: entityCount.sheetName,
        })}
      </div>
    );
  };

  renderJobEntityCounts = (entityCounts, stepName) => {
    entityCounts = entityCounts.filter(e => !!e);
    if (!entityCounts || !entityCounts.length) {
      const transKey = stepName === DALTypes.ImportUpdateDataFilesSteps.CloseImportedParties ? 'NO_PARTIES_CLOSED' : 'NO_ENTITIES_IMPORTED';
      return <TextPrimary>{t(transKey)}</TextPrimary>;
    }

    return (
      <Dialog expandTo="top-left">
        <a>{t('SUMMARY_OF_CHANGES')}</a>
        <DialogOverlay container={false}>
          <DialogHeader title={t('SUMMARY_OF_CHANGES')} />
          <div className={cf('errors')}>
            <pre>{entityCounts.map(it => this.renderEntityCount(it, stepName))}</pre>
          </div>
          <DialogActions>
            <Button type="flat" data-action="close" label={t('CANCEL')} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  };

  formatStep = (job, key, value, stepName, showDetails = true) => {
    let result;

    switch (key) {
      case DALTypes.JobProperties.PROGRESS:
      case DALTypes.JobProperties.STATUS:
        result = `${key}: ${value}`;
        break;
      case DALTypes.JobProperties.ERRORS:
        result = showDetails && this.renderJobErrors(job.name, value);
        break;
      case DALTypes.JobProperties.RESULT:
        result = showDetails && this.renderResult(job, value, stepName);
        break;
      default:
        result = '';
    }

    return result;
  };

  handleDowloadPrivateFile = job => {
    const { tenantId } = this.props.authUser;
    const { filename } = job.metadata;
    const url = `${location.origin}/api/tenants/${tenantId}/download/${filename}?token=${this.props.userToken}`;
    downloadDocument(url);
  };

  renderResultFileLink = (job, resultUrl, privateResult) => {
    if (resultUrl) return <a onClick={() => windowOpen(resultUrl)}>{t('RESULT_FILE')}</a>;

    if (privateResult) return <a onClick={() => this.handleDowloadPrivateFile(job)}>{t('RESULT_FILE')}</a>;

    return null;
  };

  getProcessedText = (job, stepName, result) => {
    if (stepName === DALTypes.ImportUpdateDataFilesSteps.CloseImportedParties) {
      const { activityDate } = job.metadata || {};
      return (
        <div>
          {!!activityDate && (
            <Text>
              {t('LAST_ACTIVITY_DATE', {
                activityDate: formatMoment(toMoment(activityDate), {
                  format: MONTH_DATE_YEAR_FORMAT,
                }),
              })}
            </Text>
          )}
          {!!result.processed && (
            <Text>
              {t('IMPORTED_PARTIES_CLOSED', {
                partiesClosed: result.processed,
                count: result.processed,
              })}
            </Text>
          )}
        </div>
      );
    }

    return (
      !!result.processed && (
        <Text>
          {t('MIGRATE_RESULT', {
            filesProcessed: result.processed,
            filesUploaded: result.uploaded,
          })}
        </Text>
      )
    );
  };

  renderResult = (job, result, stepName) => {
    const { resultUrl, entityCounts } = job.metadata;
    return (
      <div>
        {this.renderResultFileLink(job, resultUrl, this.props.privateResult)}
        {!!entityCounts && <div>{this.renderJobEntityCounts(entityCounts, stepName)}</div>}
        {this.getProcessedText(job, stepName, result)}
      </div>
    );
  };

  showStatusDetails = step => {
    const status = step[DALTypes.JobProperties.STATUS];
    return status === DALTypes.JobStatus.FAILED || status === DALTypes.JobStatus.PROCESSED;
  };

  renderStep = (job, step, stepName) => {
    const showDetails = this.showStatusDetails(step);
    return Object.keys(step).map(elem => (
      <div key={`stepRow-${Object.keys(step).indexOf(elem)}`} className={cf('steps')}>
        <Caption>{this.formatStep(job, elem, step[elem], stepName, showDetails)}</Caption>
      </div>
    ));
  };

  renderJobSteps = job =>
    Object.keys(job.steps).map(elem => (
      <Cell key={`step-${Object.keys(job.steps).indexOf(elem)}`}>
        <Text>{elem}</Text>
        {this.renderStep(job, job.steps[elem], elem)}
      </Cell>
    ));

  renderFiles = job => {
    const { files } = job.metadata;
    if (!files) return <noscript />;

    return files.map(f => f.originalName).join(', ');
  };

  renderSkippedFiles = job => {
    const { steps } = job;
    const stepsResults = steps && Object.keys(steps).map(step => steps[step].result);
    const skippedFiles = flatten(stepsResults.map(stepResult => (stepResult && stepResult.skippedFiles) || []));
    if (!(skippedFiles && skippedFiles.length)) return <noscript />;

    return (
      <Cell>
        <TextPrimary inline>{t('SKIPPED_FILES')}</TextPrimary>
        <TextPrimary inline>{skippedFiles.map(f => f.originalName).join(', ')}</TextPrimary>
      </Cell>
    );
  };

  renderJob = job => (
    <Row key={`row-${job.id}`}>
      <Cell>
        <TextPrimary inline>{job.name}</TextPrimary>
      </Cell>
      <Cell>
        <TextPrimary inline>{job.status}</TextPrimary>
      </Cell>
      <Cell>
        <TextPrimary inline>
          {formatMoment(job.created_at, {
            format: MONTH_DATE_YEAR_HOUR_FORMAT,
          })}
        </TextPrimary>
      </Cell>
      <Cell>
        <TextPrimary inline>{this.getUserName(job.createdBy)}</TextPrimary>
      </Cell>
      <Cell width={'35%'}>
        {this.renderJobSteps(job)}
        <Cell>
          {job.metadata?.files && <TextPrimary inline>{t('JOB_STATUS_FILES')}</TextPrimary>}
          {job.metadata?.result && <TextPrimary inline>{job.metadata?.result}</TextPrimary>}
          {(job.metadata?.archivedParties || job?.metadata?.archivedParties === 0) && (
            <TextPrimary inline>{t('ARCHIVED_PARTIES', { archivedParties: job.metadata.archivedParties })}</TextPrimary>
          )}
          <TextPrimary inline>{this.renderFiles(job)}</TextPrimary>
        </Cell>
        {this.renderSkippedFiles(job)}
      </Cell>
    </Row>
  );

  renderRowHeader = () => (
    <RowHeader>
      <Cell>{t('NAME')}</Cell>
      <Cell>{t('STATUS')}</Cell>
      <Cell>{t('JOB_STATUS_DATE')}</Cell>
      <Cell>{t('CREATED_BY')}</Cell>
      <Cell width={'35%'} className={cf('info-cell')}>
        {t('JOB_INFO')}
      </Cell>
    </RowHeader>
  );

  render = () => {
    const { jobs } = this.props;
    return (
      <div>
        <Table className={cf('jobsTable')}>
          {this.renderRowHeader()}
          {jobs && jobs.map(this.renderJob)}
        </Table>
      </div>
    );
  };
}
