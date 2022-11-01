/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import cron from 'cron-parser';
import { mapSeries } from 'bluebird';
import { removeAllJobHandlers, removeAllGlobalJobHandlers, addJobHandlers, addGlobalJobHandlers } from './recurringJobs';
import { sendMessage } from '../../services/pubsub';
import { clearCallQueueIfEndOfDay } from '../../services/telephony/callQueuing';
import {
  APP_EXCHANGE,
  TASKS_MESSAGE_TYPE,
  TRANSACTIONS_MESSAGE_TYPE,
  SCREENING_MESSAGE_TYPE,
  LEASE_MESSAGE_TYPE,
  EXPORT_MESSAGE_TYPE,
  JOBS_MESSAGE_TYPE,
  PROPERTY_MESSAGE_TYPE,
  EXTERNAL_CALENDARS_TYPE,
} from '../../helpers/message-constants';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getTenantData } from '../../dal/tenantsRepo';
import { updateRecurringJobStatus, getAllRecurringJobsLocked, markRecurringJobsInProgress } from '../../dal/jobsRepo';
import { admin } from '../../common/schemaConstants';
import { runInTransaction } from '../../database/factory';
import loggerModule from '../../../common/helpers/logger';
import sleep from '../../../common/helpers/sleep';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { canExecuteRecurringJobs } from '../../api/actions/jobs/job';
import envVal from '../../../common/helpers/env-val';
import { jobIsInProgress } from '../../services/helpers/jobs';

const logger = loggerModule.child({ subType: 'RecurringJobHandlers' });

const getNextOccurrence = job => {
  const currentTime = now({ timezone: job.timezone });
  if (!job.schedule) return currentTime;

  const options = {
    currentDate: job.lastRunAt,
    endDate: job.endDate,
    tz: job.timezone,
  };

  let nextOccurrence;
  try {
    const interval = cron.parseExpression(job.schedule, options);
    nextOccurrence = interval && interval.next();
  } catch (err) {
    logger.error({ err, job }, 'Unable to determine next occurrence for recurring job');
  }
  return nextOccurrence && nextOccurrence._date;
};

const shouldExecuteJob = (ctx, job) => {
  if (job.inactiveSince) {
    const { name: jobName, inactiveSince } = job;
    logger.warn({ ctx, jobName, inactiveSince }, 'Skipping inactive job');
    return false;
  }

  const lastOccurrence = job.lastRunAt;
  let isInExecutionWindow = false;

  const currentTime = now({ timezone: job.timezone });

  const startDateInTimeZone = job.startDate ? toMoment(job.startDate, { timezone: job.timezone }) : null;
  const endDateInTimeZone = job.endDate ? toMoment(job.endDate, { timezone: job.timezone }) : null;

  const isAfterStartDate = startDateInTimeZone ? currentTime.isSameOrAfter(startDateInTimeZone) : true;
  const isBeforeEndDate = endDateInTimeZone ? currentTime.isSameOrBefore(endDateInTimeZone) : true;

  if (!(isAfterStartDate && isBeforeEndDate)) return false;

  if (lastOccurrence) {
    const nextJobOccurrence = getNextOccurrence(job);

    const isAfterNextJobOccurrence = currentTime.isSameOrAfter(nextJobOccurrence);

    isInExecutionWindow = nextJobOccurrence && isAfterNextJobOccurrence;
  }

  return !lastOccurrence || isInExecutionWindow;
};

export const getJobsToExecute = async ctx =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    const all = await getAllRecurringJobsLocked(innerCtx);
    const jobs = all.filter(job => shouldExecuteJob(innerCtx, job));
    if (!jobs.length) {
      return [];
    }

    let jobNames = jobs.map(job => job.name);

    if (jobNames.includes(DALTypes.Jobs.ImportAndProcessPartyWorkflows) && (await jobIsInProgress(innerCtx, DALTypes.Jobs.ImportAndProcessPartyWorkflows))) {
      logger.trace({ ctx }, 'importAndProcessPartyWorkflows - job already in progress');
      jobNames = jobNames.filter(name => name !== DALTypes.Jobs.ImportAndProcessPartyWorkflows);
    }

    const lastRunAt = new Date();
    return await markRecurringJobsInProgress(innerCtx, jobNames, lastRunAt);
  });

const { Jobs } = DALTypes;
const keyByJobName = {
  [Jobs.TasksFollowupParty]: TASKS_MESSAGE_TYPE.PROCESS_ON_DEMAND,
  [Jobs.ScreeningResponseValidation]: SCREENING_MESSAGE_TYPE.SCREENING_RESPONSE_VALIDATION,
  [Jobs.CheckForOrphanScreeningRequests]: SCREENING_MESSAGE_TYPE.POLL_SCREENING_UNRECEIVED_RESPONSES,
  [Jobs.LongRunningScreeningRequests]: SCREENING_MESSAGE_TYPE.LONG_RUNNING_SCREENING_REQUESTS,
  [Jobs.FetchAndStoreTransactions]: TRANSACTIONS_MESSAGE_TYPE.FETCH_AND_STORE,
  [Jobs.FetchLeasesStatus]: LEASE_MESSAGE_TYPE.FETCH_LEASES_STATUS,
  [Jobs.ExportOneToManys]: EXPORT_MESSAGE_TYPE.EXPORT_ONE_TO_MANYS,
  [Jobs.MarkEveryoneUnavailable]: JOBS_MESSAGE_TYPE.MARK_USERS_UNAVAILABLE,
  [Jobs.UpdatePostMonth]: PROPERTY_MESSAGE_TYPE.UPDATE_POST_MONTH,
  [Jobs.CheckIncomingFiles]: JOBS_MESSAGE_TYPE.CHECK_INCOMING_FILES,
  [Jobs.SyncExternalCalendarEvents]: EXTERNAL_CALENDARS_TYPE.SYNC_CALENDAR_EVENTS,
  [Jobs.ExportToYardi]: EXPORT_MESSAGE_TYPE.EXPORT_TO_YARDI,
  [Jobs.MonitorDatabase]: JOBS_MESSAGE_TYPE.MONITOR_DATABASE,
  [Jobs.ScreeningMonitor]: JOBS_MESSAGE_TYPE.SCREENING_MONITOR,
  [Jobs.DetachProgramPhoneNumbers]: JOBS_MESSAGE_TYPE.DETACH_PROGRAM_PHONE_NUMBERS,
  [Jobs.CleanupTestingTenants]: JOBS_MESSAGE_TYPE.CLEANUP_TESTING_TENANTS,
  [Jobs.CleanupPhysicalAssets]: JOBS_MESSAGE_TYPE.CLEANUP_PHYSICAL_ASSETS,
  [Jobs.VacatePartyMembers]: JOBS_MESSAGE_TYPE.VACATE_PARTY_MEMBERS,
  [Jobs.PartyDocumentsMonitor]: JOBS_MESSAGE_TYPE.PARTY_DOCUMENTS_MONITOR,
  [Jobs.CommsMonitor]: JOBS_MESSAGE_TYPE.COMMS_MONITOR,
  [Jobs.ImportAndProcessPartyWorkflows]: JOBS_MESSAGE_TYPE.IMPORT_AND_PROCESS_PARTY_WORKFLOWS,
  [Jobs.CleanupOldRecordsFromBigTables]: JOBS_MESSAGE_TYPE.CLEANUP_OLD_RECORDS_FROM_BIG_TABLES,
  [Jobs.MRIExportMonitor]: JOBS_MESSAGE_TYPE.MRI_EXPORT_MONITOR,
  [Jobs.AssignActiveLeaseToRSTeams]: JOBS_MESSAGE_TYPE.ASSIGN_AL_TO_RS_TEAM,
  [Jobs.SyncBMLeaseSignatures]: JOBS_MESSAGE_TYPE.SYNC_BM_LEASE_SIGNATURES,
  [Jobs.ApplicationDeclinedHandler]: JOBS_MESSAGE_TYPE.APPLICATION_DECLINED_HANDLER,
};

const shouldRun = async (tenantId, job) => {
  if (!canExecuteRecurringJobs()) return false;

  if (job.name === DALTypes.Jobs.FetchLeasesStatus) {
    const ctx = { tenantId: admin.id };
    const tenant = await getTenantData(ctx, tenantId);
    if (tenant.metadata.leasingProviderMode === DALTypes.LeasingProviderMode.FAKE) {
      return false;
    }
  }

  if (job.name === DALTypes.Jobs.ExportOneToManys) {
    const ctx = { tenantId: admin.id };
    const tenant = await getTenantData(ctx, tenantId);
    if (!(tenant.settings.export && tenant.settings.export.oneToManys)) {
      logger.trace({ tenantId }, 'one to manys export is not enabled on tenant');
      await updateRecurringJobStatus({ tenantId }, job.id, DALTypes.JobStatus.IDLE);

      return false;
    }
  }

  if (job.name === DALTypes.Jobs.CallQueueEndOfDay) {
    const lastOccurrence = job.lastRunAt;
    await clearCallQueueIfEndOfDay({ tenantId }, { lastOccurrence, jobId: job.id });

    return false;
  }

  return true;
};

const executeJob = async (tenantId, job) => {
  if (await shouldRun(tenantId, job)) {
    const additionalFields =
      job.name === DALTypes.Jobs.TasksFollowupParty ? { tasks: [DALTypes.TaskNames.FOLLOWUP_PARTY, DALTypes.TaskNames.SEND_RENEWAL_REMINDER] } : {};

    const key = keyByJobName[job.name];
    await sendMessage({
      exchange: APP_EXCHANGE,
      key,
      message: {
        tenantId,
        jobInfo: { name: job.name },
        jobId: job.id,
        ...additionalFields,
        metadata: job.metadata,
      },
      ctx: { tenantId },
    });
  }
};

const checkJobsToExecute = async tenantId => {
  if (!canExecuteRecurringJobs()) return;
  const ms = Math.floor(Math.random() * 10000); // 0 - 10 seconds
  await sleep(ms);

  const ctx = { tenantId };
  const jobs = await getJobsToExecute(ctx);

  logger.info({ tenantId, jobs }, 'Starting recurring jobs');
  await mapSeries(jobs, async job => {
    await executeJob(tenantId, job);
  });
};

export const setupRecurringJobHandlers = () => {
  if (envVal('TESTCAFE_ENV', false)) return; // NO recurring jobs will ever run in testcafe
  removeAllJobHandlers(); // make sure the job functions are not registered again on each call to setupRecurringJobs
  removeAllGlobalJobHandlers();
  // add here other functions that need to be called periodically
  // according to the recurring jobs config
  addJobHandlers([checkJobsToExecute]);
  addGlobalJobHandlers([checkJobsToExecute]);
};
