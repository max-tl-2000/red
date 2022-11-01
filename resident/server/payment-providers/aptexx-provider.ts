/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { PaymentProvider } from './payment-provider';
import {
  PaymentInfo,
  UnitUserInfo,
  CurrentCharge,
  PaymentStatus,
  Transactions,
  ShortPaymentMethod,
  Payment as PaymentType,
  ScheduledPayment,
  ChargeType,
  PaymentMethod,
  LeaseInfo,
  PaymentInfoToBuildFormUrl,
  ScheduleInfoToBuildFormUrl,
} from './paymentTypes';
import { request } from '../../../common/helpers/httpUtils';
import config from '../../config';
import { DALTypes } from '../../../common/enums/DALTypes';
import { IDbContext } from '../../../common/types/base-types';
import { toMoment, now, today } from '../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import { updateAptexxDataForPartyMember, getAptexxDataForPersonAndInventory } from '../dal/external-party-member-repo';
import { getPaymentMethodById } from '../dal/payment-method-repo';
import { getAptexxSettingsByPropertyId, getPaymentProviderSettingsByPropertyId, getPropertyTimezone } from '../dal/property-repo';
import { ServiceError } from '../../../server/common/errors';
import { createJWTToken } from '../../../common/server/jwt-helpers';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import { TARGET_ACCOUNT_TYPE, TARGET_ACCOUNT_NAME } from '../../../rentapp/common/enums/target-account-types';
import loggerInstance from '../../../common/helpers/logger';
import { getScheduledPaymentDayOfMonth, convertDollarsToCents, convertCentsToDollars } from '../helpers/paymentHelpers';
import { MaintenanceInfo, MaintenanceTicket, Ticket, MaintenanceStatus, AttachmentUrl } from './maintenanceTypes';
import { parsePhone } from '../../../common/helpers/phone/phone-helper';
import { getOnlyDigitsFromPhoneNumber } from '../../../common/helpers/phone-utils';
import { revaAttachmentsString } from './constants';

const maintenanceTypeOther = 'Other';

const logger = loggerInstance.child({ subType: 'ResidentPayment - AptexxProvider' });

export enum AptexxPageType {
  Payment = 'PAYMENT',
  Schedule = 'SCHEDULE',
  Method = 'METHOD',
  Home = 'HOME',
}

// Amount: 66600 = $666
const REAL_TEST_PAYMENT_METHOD_FAILURE_AMOUNT_CENTS = 66600;

export default class AptexxProvider extends PaymentProvider {
  aptexxUrl: string;

  apiKey: string;

  paymentMethodCallbackUrl: string;

  paymentProviderMode: string;

  constructor(paymentProviderMode) {
    super();
    const { aptexx } = config;
    const [aptexxHostname, apiKey] =
      paymentProviderMode === DALTypes.PaymentProviderMode.REAL_PROD
        ? [aptexx.productionHostname, aptexx.productionApiKey]
        : [aptexx.testHostname, aptexx.testApiKey];

    this.aptexxUrl = `https://${aptexxHostname}${aptexx.endpointPath}`;
    this.apiKey = apiKey;
    this.paymentMethodCallbackUrl = aptexx.paymentMethodCallbackUrl;
    this.paymentProviderMode = paymentProviderMode;
  }

  async callAptexxAPI(ctx: IDbContext, { endpoint, payload = {} }: { endpoint?: string; payload?: any }) {
    const { aptexxTimeout } = config.aptexx;
    const { aptexxUrl } = this;

    const { methodCallbackUrl: _, ...bodyContentToLog } = payload;
    logger.info({ ctx, bodyContentToLog, aptexxUrl, endpoint }, 'callAptexxAPI started!');

    if (!this.aptexxUrl || !endpoint) {
      logger.error({ ctx }, 'callAptexxAPI - Missing required params');
      return null;
    }

    try {
      const response = await request(`${aptexxUrl}${endpoint}?token=${this.apiKey}`, {
        method: 'post',
        timeout: aptexxTimeout as number,
        data: payload,
        headers: { Accept: 'application/json' },
      });

      logger.info({ ctx, aptexxResponse: response, endpoint }, 'callAptexxAPI response');

      if (response?.errors) {
        const { errors } = response;
        logger.error({ ctx, aptexxErrors: errors }, 'callAptexxAPI has failed!');
      }

      return response;
    } catch (err) {
      logger.error({ ctx, error: err }, 'callAptexxAPI has failed!');
      throw new ServiceError({ token: 'EXTERNAL_SERVICE_FAILED', status: 503 });
    }
  }

  async getStoredAptexxData(
    ctx: IDbContext,
    leaseInfo: LeaseInfo,
    aptexxAccountId?: number,
    doNotThrow = false,
  ): Promise<{ accountPersonId?: string; integrationId?: string; integrationIdIsMissing?: boolean }> {
    let { aptexxData } = leaseInfo;
    logger.trace({ ctx, aptexxData }, 'AptexxProvider - getPersonIntegrationId');
    const { integrationId } = aptexxData || {};

    if (!integrationId) {
      const { personExternalId, propertyId } = leaseInfo;
      if (!personExternalId || !propertyId) {
        logger.error({ ctx, leaseInfo }, 'getStoredAptexxData - Missing person external id');
        if (doNotThrow) return {};
        throw new ServiceError({ token: 'MISSING_EXTERNAL_ID', status: 400 });
      }

      const accountId = aptexxAccountId || (await getAptexxSettingsByPropertyId(ctx, propertyId))?.propertyId;
      const { persons } = (await this.callAptexxAPI(ctx, { endpoint: 'getPersons', payload: { accountId, code: personExternalId } })) || {};

      const { integrationId: personIntegrationId, accountPersonId } = persons?.[0] || {};

      if (!personIntegrationId) {
        logger.error({ ctx, leaseInfo }, 'getPersonIntegrationId - Missing integration id for person');
        return { integrationIdIsMissing: true };
      }

      aptexxData = { integrationId: personIntegrationId, accountPersonId };
      await updateAptexxDataForPartyMember(ctx, { personExternalId, aptexxData });
    }

    return aptexxData;
  }

  buildUnitInfo = (leaseInfo: LeaseInfo, integrationIdIsMissing?: boolean) => ({
    inventoryId: leaseInfo.inventoryId,
    buildingDisplayName: leaseInfo.buildingDisplayName,
    unitDisplayName: leaseInfo.unitDisplayName,
    fullyQualifiedName: leaseInfo.unitFullyQualifiedName,
    isPastResident: leaseInfo.partyWorkflowState === DALTypes.WorkflowState.ARCHIVED,
    integrationIdIsMissing,
  });

  buildUnitBalanceInfo(
    aptexxPersons: { balance?: string; payStatusType: string }[] = [],
    aptexxCharges: { [key: string]: any }[] = [],
    leaseInfo: LeaseInfo,
  ): UnitUserInfo {
    const [aptexxPerson] = aptexxPersons;
    if (!aptexxPerson) return null;

    // balanceDueDate = Earliest due date of all open charges
    const { dueDate: balanceDueDate } = aptexxCharges.reduce(
      (acc, charge) => {
        acc.total += parseFloat(charge?.amount);

        if (charge?.dueOn && (!acc.dueDate || toMoment(charge.dueOn).isBefore(acc.dueDate, 'day'))) {
          acc.dueDate = toMoment(charge.dueOn);
        }

        return acc;
      },
      { total: 0, dueDate: null },
    );

    return {
      ...this.buildUnitInfo(leaseInfo),
      balanceDueAmount: convertCentsToDollars(parseFloat(aptexxPerson.balance)),
      paymentStatus: PaymentStatus[aptexxPerson.payStatusType],
      balanceDueDate: balanceDueDate && balanceDueDate.format(YEAR_MONTH_DAY_FORMAT),
    } as UnitUserInfo;
  }

  // Aptexx adds fake charges when payments are made. These fake charges are ignored in this calculation.  The charges can be distinguished from real ones because they have no code set
  buildCurrentCharges(aptexxCharges: { description: string; code: string; dueOn: string; amount: string }[] = []): CurrentCharge[] {
    return aptexxCharges.reduce((acc, charge) => {
      const { description, code, dueOn, amount } = charge;
      if (code) {
        acc.push({
          type: code,
          description,
          dueDate: dueOn,
          balanceAmount: convertCentsToDollars(parseFloat(amount)),
        });
      }
      return acc;
    }, []);
  }

  buildTransactions(aptexxPersonTransactions: { [key: string]: any } = {}, inventoryId: string): Transactions {
    const { payments, declines, voids, refunds, reversals } = aptexxPersonTransactions || {};

    const mapShortPaymentMethod = (method): ShortPaymentMethod => ({ channelType: method.channelType, brand: method.brandType, lastFour: method.lastFour });
    const mapBaseTransactionData = aptexxTransaction => {
      const amount = convertCentsToDollars(parseFloat(aptexxTransaction.amount || 0));
      // for refunded transactions, we don't receive a grossAmount and the total amount is 0
      // as a backup, we use the amount that we receive from aptexx instead of grossAmount because the fee in this case is not computed correctly
      const totalAmount = convertCentsToDollars(parseFloat(aptexxTransaction.grossAmount || aptexxTransaction.amount || 0));

      return {
        amount,
        totalAmount,
        checkNumber: aptexxTransaction.checkNumber,
        checkMemo: aptexxTransaction.memo,
        method: mapShortPaymentMethod(aptexxTransaction),
        providerTransactionId: aptexxTransaction.id,
        fee: +Math.abs(totalAmount - amount).toFixed(2),
        inventoryId,
      };
    };

    const mapTransactions = (
      transactions: { [key: string]: any }[] = [],
      mapValues: (t: { [key: string]: any }) => { [key: string]: any } = () => ({}),
    ): PaymentType[] =>
      transactions.map<PaymentType>(
        transaction =>
          ({
            ...mapBaseTransactionData(transaction),
            ...mapValues(transaction),
          } as PaymentType),
      );

    const mapPaymentTransaction = paymentTransaction => ({
      date: toMoment(paymentTransaction.createdOn),
      reason: paymentTransaction.description,
    });

    const mapDeclinedTransaction = declinedTransaction => ({
      date: toMoment(declinedTransaction.declinedOn),
      reason: declinedTransaction.declinedReason,
    });

    const mapVoidedTransaction = voidedTransaction => ({
      date: toMoment(voidedTransaction.voidedOn),
      reason: voidedTransaction.voidReason,
    });

    const mapRefundsTransaction = refundedTransaction => ({
      date: toMoment(refundedTransaction.createdOn),
      providerRefundedTransactionId: refundedTransaction.paymentId,
      reason: refundedTransaction.description,
    });

    const mapReversedTransaction = reversedTransaction => ({
      providerTransactionId: reversedTransaction.refId,
      reversalFee: reversedTransaction.fee,
    });

    return {
      payments: mapTransactions(payments, mapPaymentTransaction),
      declines: mapTransactions(declines, mapDeclinedTransaction),
      voids: mapTransactions(voids, mapVoidedTransaction),
      refunds: mapTransactions(refunds, mapRefundsTransaction),
      reversals: mapTransactions(reversals, mapReversedTransaction),
    } as Transactions;
  }

  buildScheduledPayments(scheduledPayments): ScheduledPayment[] {
    return scheduledPayments.map(
      ({ id: providerId, frequencyType: frequency, day, startOn: startMonth, endOn: endMonth, methodId: paymentMethodProviderId, amount }) => ({
        providerId,
        frequency,
        startMonth,
        endMonth,
        dayOfMonth: getScheduledPaymentDayOfMonth(day),
        paymentMethodProviderId,
        paymentAmount: convertCentsToDollars(amount),
        paymentAccountName: ChargeType.Rent,
      }),
    );
  }

  getScheduledTransactions = async (ctx: IDbContext, leaseInfo: LeaseInfo): Promise<Transactions> => {
    logger.trace({ ctx, leaseInfo }, 'AptexxProvider - getScheduledTransaction');
    const { propertyId } = leaseInfo;
    const { propertyId: aptexxAccountId } = await getAptexxSettingsByPropertyId(ctx, leaseInfo.propertyId);
    const { accountPersonId, integrationId, integrationIdIsMissing } = await this.getStoredAptexxData(ctx, leaseInfo, aptexxAccountId);

    if (integrationIdIsMissing) return {};

    const targetId: number = await this.getRentAccountForProperty(ctx, propertyId);

    const rawTransactions = await this.callAptexxAPI(ctx, {
      endpoint: 'getTransactions',
      payload: { targetId, accountPersonId, integrationId, fromDay: '2020-01-01', channelProcessorType: 'SCHEDULE' },
    }); // Hardcoding "fromDay" until there is a resolution about it

    return this.buildTransactions(rawTransactions, leaseInfo.inventoryId);
  };

  async getPaymentInfo(ctx: IDbContext, leaseInfo: LeaseInfo, commonUserId: string): Promise<PaymentInfo[]> {
    logger.trace({ ctx, leaseInfo }, 'AptexxProvider - getPaymentInfo');

    const { propertyId } = leaseInfo;
    const { propertyId: aptexxAccountId } = await getAptexxSettingsByPropertyId(ctx, leaseInfo.propertyId);
    const { accountPersonId, integrationId: personIntegrationId, integrationIdIsMissing } = await this.getStoredAptexxData(ctx, leaseInfo, aptexxAccountId);

    if (integrationIdIsMissing) {
      return [{ unitUserInfo: this.buildUnitInfo(leaseInfo, integrationIdIsMissing) }];
    }

    const targetId: number = await this.getRentAccountForProperty(ctx, propertyId);

    const personPayload = { accountId: aptexxAccountId, personIntegrationId };

    // This array contains all the aptexx endpoints to call that are needed to build the getPaymentInfo final structure
    const aptexxEndpoints = [
      { endpoint: 'getPersons', payload: personPayload },
      { endpoint: 'getPersonCharges', payload: personPayload },
      { endpoint: 'getTransactions', payload: { targetId, accountPersonId, fromDay: '2020-01-01' } }, // Hardcoding "fromDay" until there is a resolution about it
      // TODO: For now will be used the first day of the month until Aptexx response about rare behavior
      { endpoint: 'getSchedules', payload: { targetId, fromDay: now().startOf('month').format(YEAR_MONTH_DAY_FORMAT), integrationId: personIntegrationId } },
    ];

    const [aptexxPerson, aptexxPersonCharges, aptexxPersonTransactions, aptexxPersonScheduledPayments] = await Promise.all(
      aptexxEndpoints.map(async ({ endpoint, payload }) => await this.callAptexxAPI(ctx, { endpoint, payload })),
    );

    const unitUserInfo: UnitUserInfo = this.buildUnitBalanceInfo(aptexxPerson?.persons, aptexxPersonCharges?.charges, leaseInfo);
    const currentCharges: CurrentCharge[] = this.buildCurrentCharges(aptexxPersonCharges?.charges);
    const paymentMethods: PaymentMethod[] = await super.getPaymentMethods(ctx, commonUserId, personIntegrationId);
    const transactions: Transactions = await this.buildTransactions(aptexxPersonTransactions, leaseInfo.inventoryId);
    const scheduledPayments: ScheduledPayment[] = this.buildScheduledPayments(aptexxPersonScheduledPayments?.schedules);
    return [{ unitUserInfo, currentCharges, paymentMethods, transactions, scheduledPayments }];
  }

  async hasOverduePayments(ctx: IDbContext, leaseInfo: LeaseInfo): Promise<boolean> {
    logger.trace({ ctx, leaseInfo }, 'AptexxProvider - hasOverduePayments');

    try {
      const { propertyId } = leaseInfo;
      const { propertyId: aptexxAccountId } = await getAptexxSettingsByPropertyId(ctx, propertyId);
      const { integrationId: personIntegrationId, integrationIdIsMissing } = await this.getStoredAptexxData(ctx, leaseInfo, aptexxAccountId);

      if (integrationIdIsMissing) return false;

      const aptexxPersonCharges = await this.callAptexxAPI(ctx, { endpoint: 'getPersonCharges', payload: { accountId: aptexxAccountId, personIntegrationId } });

      const chargeDate = aptexxPersonCharges?.charges?.map((c: { dueOn: string }) => c.dueOn).sort()[0];

      if (!chargeDate) return false;

      const timezone = await getPropertyTimezone(ctx, propertyId);
      return toMoment(chargeDate, { timezone }).isBefore(today({ timezone }));
    } catch (error) {
      logger.error({ ctx, leaseInfo, error }, 'failed to determine if person has overdue payments');
      return false;
    }
  }

  async getRentAccountForProperty(ctx: IDbContext, propertyId: string) {
    const { aptexx = {} } = await getPaymentProviderSettingsByPropertyId(ctx, propertyId);
    const { accountIds = {} } = aptexx;

    return accountIds[TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.RENT_ACCOUNT]];
  }

  async getPaymentMethodFormUrl(ctx: IDbContext, data: PaymentInfoToBuildFormUrl) {
    const { personId, propertyId, inventoryId, tenantName, commonUserId, successUrl, cancelUrl } = data;

    if (!inventoryId) {
      logger.error({ ctx }, 'getPaymentMethodFormUrl - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }
    const { aptexxData, personExternalId } = (await getAptexxDataForPersonAndInventory(ctx, { personId, inventoryId, propertyId })) || {};

    const { integrationId, integrationIdIsMissing } = await this.getStoredAptexxData(ctx, { personExternalId, aptexxData, propertyId });

    if (integrationIdIsMissing) {
      throw new ServiceError({ token: 'MISSING_INTEGRATION_ID', status: 400 });
    }

    const targetId = await this.getRentAccountForProperty(ctx, propertyId);

    const paymentMethodId = getUUID();

    logger.trace({ ctx, ...data, integrationId, targetId, paymentMethodId }, 'AptexxProvider - getPaymentMethodFormUrl');

    if (!targetId || !integrationId || !commonUserId) {
      logger.error({ ctx }, 'getPaymentMethodFormUrl - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const token = createJWTToken({ commonUserId }, { jwtConfigKeyName: 'resident.webhookJwtSecret', encryptionConfigKeyName: 'resident.webhookEncryptionKey' });

    const methodCallbackUrl = addParamsToUrl(this.paymentMethodCallbackUrl, { token, tenant: tenantName, integrationId, paymentMethodId });

    const redirectCallbackUrl = url => addParamsToUrl(url, { paymentMethodId, commonUserId, tenant: tenantName });

    const { link } = await this.callAptexxAPI(ctx, {
      endpoint: 'loginAccountPerson',
      payload: {
        targetId,
        integrationId,
        methodCallbackUrl,
        successUrl: redirectCallbackUrl(successUrl),
        cancelUrl: redirectCallbackUrl(cancelUrl),
        pageType: AptexxPageType.Method,
        hideBackButton: true,
      },
    });

    logger.info({ ctx, link }, 'getPaymentMethodFormUrl - link');
    return link;
  }

  async getScheduledPaymentFormUrl(ctx: IDbContext, data: ScheduleInfoToBuildFormUrl) {
    const { personId, inventoryId, propertyId, commonUserId, successUrl, cancelUrl } = data;

    if (!inventoryId) {
      logger.error({ ctx }, 'getScheduledPaymentFormUrl - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const { aptexxData, personExternalId } = (await getAptexxDataForPersonAndInventory(ctx, { personId, inventoryId, propertyId })) || {};
    const { integrationId, integrationIdIsMissing } = await this.getStoredAptexxData(ctx, { personExternalId, aptexxData, propertyId });

    if (integrationIdIsMissing) {
      throw new ServiceError({ token: 'MISSING_INTEGRATION_ID', status: 400 });
    }

    const targetId = await this.getRentAccountForProperty(ctx, propertyId);

    logger.trace({ ctx, ...data, integrationId, targetId }, 'AptexxProvider - getScheduledPaymentFormUrl');

    if (!targetId || !integrationId || !commonUserId) {
      logger.error({ ctx }, 'getScheduledPaymentFormUrl - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const token = createJWTToken({ commonUserId }, { jwtConfigKeyName: 'resident.webhookJwtSecret', encryptionConfigKeyName: 'resident.webhookEncryptionKey' });
    // TODO: Is it required I have seen that this call the webhook with the paymentMethodId ?
    const methodCallbackUrl = addParamsToUrl(this.paymentMethodCallbackUrl, { token, tenant: config.residentHostname });

    const { link } = await this.callAptexxAPI(ctx, {
      endpoint: 'loginAccountPerson',
      payload: {
        targetId,
        integrationId,
        methodCallbackUrl,
        successUrl: addParamsToUrl(successUrl, { token }),
        cancelUrl,
        pageType: AptexxPageType.Schedule,
        hideBackButton: true,
      },
    });

    logger.info({ ctx, link }, 'getScheduledPaymentFormUrl - link');
    return link;
  }

  async deleteScheduledPayment(ctx: IDbContext, data: { personId: string; scheduleId: string; commonUserId: string; propertyId: string }) {
    const { personId, propertyId, commonUserId, scheduleId } = data;

    logger.trace({ ctx, personId, propertyId, commonUserId, scheduleId }, 'AptexxProvider - deleteScheduledPayment');

    const targetId = await this.getRentAccountForProperty(ctx, propertyId);

    if (!targetId || !scheduleId) {
      logger.error({ ctx }, 'deleteScheduledPayment - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const endOn = now().format(YEAR_MONTH_DAY_FORMAT);

    const { success = false } =
      (await this.callAptexxAPI(ctx, {
        endpoint: 'updateSchedule',
        payload: {
          targetId,
          scheduleId,
          endOn,
        },
      })) || {};

    return { success };
  }

  async makeOneTimePayment(ctx: IDbContext, data: { personId: string; propertyId: string; inventoryId: string; methodId: string; paymentAmount: number }) {
    const { personId, propertyId, inventoryId, methodId, paymentAmount: paymentAmountInDollars } = data;
    const paymentAmountInCents = convertDollarsToCents(paymentAmountInDollars);

    if (!inventoryId || !methodId) {
      logger.error({ ctx }, 'makeOneTimePayment - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const targetId = await this.getRentAccountForProperty(ctx, propertyId);
    const { aptexxData, personExternalId } = (await getAptexxDataForPersonAndInventory(ctx, { personId, inventoryId, propertyId })) || {};
    const { accountPersonId, integrationIdIsMissing } = await this.getStoredAptexxData(ctx, { personExternalId, aptexxData, propertyId });

    if (integrationIdIsMissing) {
      throw new ServiceError({ token: 'MISSING_INTEGRATION_ID', status: 400 });
    }

    logger.trace({ ctx, ...data, accountPersonId, targetId }, 'AptexxProvider - makeOneTimePayment');

    if (!targetId || !accountPersonId) {
      logger.error({ ctx }, 'makeOneTimePayment - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    if (this.paymentProviderMode === DALTypes.PaymentProviderMode.REAL_TEST && paymentAmountInCents === REAL_TEST_PAYMENT_METHOD_FAILURE_AMOUNT_CENTS) {
      return { success: false };
    }

    const result = await this.callAptexxAPI(ctx, {
      endpoint: 'createPayment',
      payload: { targetId, methodId, accountPersonId, amount: paymentAmountInCents },
    });
    const { errors } = result || {};

    const success = !errors;
    if (success) return { success };

    if (errors.some(e => e.type === 'PAYMENT_DECLINED' && e.message.toLowerCase().includes('expired'))) {
      return { success: false, error: 'PAYMENT_EXPIRED' };
    }
    return { success: false, error: 'GENERIC_ERROR' };
  }

  buildAttachmentUrls(stringOfUrls: string): AttachmentUrl[] {
    const urlArray = stringOfUrls.split('\n');

    return urlArray.map(u => ({ url: u.trim() } as AttachmentUrl)).filter(url => !!url.url);
  }

  buildMaintenanceTickets(aptexxTickets: { [key: string]: any }[] = [], leaseInfo: LeaseInfo): MaintenanceTicket {
    const tickets: Ticket[] = aptexxTickets.map(t => {
      const descriptionWithUrl = t.description?.split(`${revaAttachmentsString}\n`);
      const ticket = {
        location: t.locationType,
        priority: t.priority,
        dateCreated: toMoment(t.createdOn).toISOString(),
        dateCompleted: t.completedOn ? toMoment(t.completedOn).toISOString() : '',
        dateCancelled: t.canceledOn ? toMoment(t.canceledOn).toISOString() : '',
        type: t.type || maintenanceTypeOther,
        description: descriptionWithUrl?.length ? descriptionWithUrl[0] : '',
        hasPermissionToEnter: t.permission,
        hasPets: t.pets,
        status: (t.completedOn && MaintenanceStatus.Resolved) || (t.canceledOn && MaintenanceStatus.Cancelled) || MaintenanceStatus.Open,
        ticketNumber: t.id,
        attachmentUrls: descriptionWithUrl?.length && descriptionWithUrl[1] && this.buildAttachmentUrls(descriptionWithUrl[1]),
        phone: t.phone,
      } as Ticket;
      return ticket;
    });

    const maintenanceTicket: MaintenanceTicket = {
      inventoryId: leaseInfo.inventoryId,
      tickets,
    };

    return maintenanceTicket;
  }

  async getTicketsForLease(ctx: IDbContext, leaseInfo: LeaseInfo): Promise<MaintenanceTicket | null> {
    logger.trace({ ctx, leaseInfo }, 'AptexxProvider - getTicketsForLease');
    const { accountPersonId, integrationIdIsMissing } = await this.getStoredAptexxData(ctx, leaseInfo);

    if (integrationIdIsMissing) {
      logger.warn({ ctx }, 'getMaintenanceInformation - Missing integration ID');
      return await Promise.resolve(null);
    }

    if (!accountPersonId) {
      logger.warn({ ctx }, 'getMaintenanceInformation - Missing required params');
      return await Promise.resolve(null);
    }

    const result = await this.callAptexxAPI(ctx, { endpoint: 'getMaintenanceRequests', payload: { accountPersonId } });

    return this.buildMaintenanceTickets(result.requests, leaseInfo);
  }

  async getMaintenanceInformation(ctx: IDbContext, leaseInfoList: LeaseInfo[]): Promise<MaintenanceInfo> {
    logger.trace({ ctx }, 'AptexxProvider - getMaintenanceInformation');

    const maintenanceInfo = await Promise.all(leaseInfoList.map(async leaseInfo => await this.getTicketsForLease(ctx, leaseInfo)));
    const res = maintenanceInfo.filter(m => m);
    if (!res.length) {
      throw new ServiceError({ token: 'MISSING_INTEGRATION_ID', status: 400 });
    }
    return { unitsMaintenanceInfo: res };
  }

  async createMaintenanceRequest(ctx: IDbContext, leaseInfo: LeaseInfo, maintenanceRequest: Partial<Ticket>): Promise<any> {
    logger.trace({ ctx }, 'AptexxProvider - createMaintenanceRequest');

    const { accountPersonId } = await this.getStoredAptexxData(ctx, leaseInfo);
    if (!accountPersonId) {
      logger.error({ ctx }, 'createMaintenanceRequest - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const { location: locationType, priority, type, phone, description, hasPermissionToEnter: permissionToEnter, hasPets: pets } = maintenanceRequest;

    // it seems that Aptexx is accepting only digits of national phone numbers
    const { national } = parsePhone(phone);
    const normalizedPhone = getOnlyDigitsFromPhoneNumber(national);
    // response is something like  { maintenanceId: 4826 }

    return await this.callAptexxAPI(ctx, {
      endpoint: 'createMaintenanceRequest',
      payload: {
        accountPersonId,
        locationType,
        priority,
        type,
        phone: normalizedPhone,
        description,
        permissionToEnter,
        pets,
      },
    });
  }

  async updatePaymentMethodStatus(ctx: IDbContext, data: { paymentMethodId: string; externalPaymentMethodId: string; propertyId: string }) {
    const { paymentMethodId, externalPaymentMethodId, propertyId } = data;

    logger.trace({ ctx, paymentMethodId, externalPaymentMethodId, propertyId }, 'AptexxProvider - updatePaymentMethodStatus');
    const targetId = await this.getRentAccountForProperty(ctx, propertyId);
    const { integrationId } = await getPaymentMethodById(ctx, paymentMethodId);

    if (!externalPaymentMethodId || !targetId || !integrationId) {
      logger.error({ ctx }, 'updatePaymentMethodStatus - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const { success = false } =
      (await this.callAptexxAPI(ctx, {
        endpoint: 'updatePaymentMethodStatus',
        payload: {
          methodId: parseInt(externalPaymentMethodId, 10),
          targetId,
          integrationId,
          active: false,
        },
      })) || {};

    return { success };
  }

  async getMaintenanceTypes(ctx: IDbContext, data: { clientId: string; accountId: string }) {
    const { clientId, accountId } = data;
    logger.trace({ ctx, clientId, accountId }, 'AptexxProvider - getMaintenanceTypes');

    if (!clientId || !accountId) {
      logger.error({ ctx }, 'getMaintenanceTypes - Missing required params');
      throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
    }

    const result =
      (await this.callAptexxAPI(ctx, {
        endpoint: 'getMaintenanceTypes',
        payload: {
          client: clientId,
          account: accountId,
        },
      })) || {};

    return result;
  }
}
