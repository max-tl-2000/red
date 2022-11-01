/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs-extra';
import path from 'path';
import superagent from 'superagent';
import { mapSeries } from 'bluebird';
import { PaymentProvider, enhancePaymentMethod } from './payment-provider';
import { IDbContext } from '../../../common/types/base-types';
import loggerInstance from '../../../common/helpers/logger';
import {
  PaymentInfo,
  PaymentMethod,
  PaymentStatus,
  LeaseInfo,
  PaymentInfoToBuildFormUrl,
  ScheduleInfoToBuildFormUrl,
  UnitUserInfo,
  Transactions,
} from './paymentTypes';
import { MaintenanceStatus, MaintenanceInfo } from './maintenanceTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now } from '../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import { getPaymentMethodsByUserIdAndIntegrationId } from '../dal/payment-method-repo';

const logger = loggerInstance.child({ subType: 'ResidentPayment - FakeProvider' });

export default class FakeProvider extends PaymentProvider {
  testDataUnits: boolean | undefined;

  constructor(testDataUnits) {
    super();
    this.testDataUnits = testDataUnits;
  }

  async getStoredAptexxData(): Promise<{ accountPersonId?: string; integrationId?: string; integrationIdIsMissing?: boolean }> {
    const aptexxData = { integrationIdIsMissing: true };

    return aptexxData;
  }

  getUnsavedPayentMethodsFromJSON = (dbPaymentMethods, jsonPaymentMethods) => {
    const dbPaymentMethodsIds = dbPaymentMethods.map(x => x.id);
    return jsonPaymentMethods.filter(pm => !dbPaymentMethodsIds.includes(pm.id));
  };

  async concatPaymentMethods(ctx: IDbContext, data: { commonUserId: string; paymentMethods: PaymentMethod[] }): Promise<PaymentMethod[]> {
    const { paymentMethods: jsonPaymentMethods } = data;
    const enhancedJsonPaymentMethods = jsonPaymentMethods.map(paymentM => enhancePaymentMethod(paymentM));
    return enhancedJsonPaymentMethods as PaymentMethod[];
  }

  formatPaymentInfo = async (ctx: IDbContext, paymentInfo: any, commonUserId: string) =>
    ({
      ...paymentInfo,
      unitUserInfo: {
        ...paymentInfo.unitUserInfo,
        paymentStatus: PaymentStatus[paymentInfo.unitUserInfo.paymentStatus] || paymentInfo.unitUserInfo.paymentStatus,
      },
      paymentMethods: await this.concatPaymentMethods(ctx, {
        paymentMethods: paymentInfo.paymentMethods,
        commonUserId,
      }),
    } as PaymentInfo);

  async readAndParsePaymentInfo(ctx: IDbContext, files: string[] = [], basePath: string, unitFullyQualifiedName: string, commonUserId: string) {
    const cannedDataFileNames = this.testDataUnits
      ? files
      : [
          files.find(filename => {
            const fileWithoutExt = filename.replace(/\.json$/gi, '');
            const fileLastChar = fileWithoutExt.substring(fileWithoutExt.length - 1, fileWithoutExt.length);
            return fileLastChar === unitFullyQualifiedName.substring(unitFullyQualifiedName.length - 1, unitFullyQualifiedName.length);
          }),
        ];

    if (!cannedDataFileNames?.[0]) {
      logger.warn({ ctx, unitFullyQualifiedName }, 'FakeProvider - No canned data found');
    }

    return await mapSeries(cannedDataFileNames, async name => {
      const rawData = await fs.readFile(path.join(basePath, name), 'utf-8');
      const paymentInfoJson = JSON.parse(rawData);
      return await this.formatPaymentInfo(ctx, paymentInfoJson, commonUserId);
    });
  }

  getRemoteCannedData = async (ctx: IDbContext, commonUserId: string) => {
    try {
      logger.debug({ ctx, commonUserId }, 'FakeProvider - getting remote payment canned data');

      // TO DO: if this solution is more than temporary extract urls to config file.
      const cannedDataUrl = 'https://api.airtable.com/v0/appi9YiqtELOlzHmv/PaymentInfo';
      const cannedDataAuthorization = 'Bearer keyZPeY69vAFhBCUE';

      const response = await superagent.get(cannedDataUrl).set('Authorization', cannedDataAuthorization);

      const tenantRecord = response.body.records.find(r => r.fields.tenantId === ctx.tenantId);

      if (tenantRecord) {
        logger.debug({ ctx, commonUserId, info: tenantRecord.fields.comment }, 'FakeProvider - found remote payment canned data');
        const paymentInfoList = JSON.parse(tenantRecord.fields.paymentInfo);

        const paymentInfo = await mapSeries(paymentInfoList, async pi => await this.formatPaymentInfo(ctx, pi, commonUserId));
        return { found: true, paymentInfo };
      }
      logger.debug({ ctx, commonUserId }, 'FakeProvider - did not find remote payment canned data, falling back to static canned data');

      return { found: false };
    } catch (error) {
      logger.error({ ctx, error, commonUserId }, 'FakeProvider - Getting remote canned data failed');
      return { found: false };
    }
  };

  buildUnitInfo = (leaseInfo: LeaseInfo) => ({
    inventoryId: leaseInfo.inventoryId,
    buildingDisplayName: leaseInfo.buildingDisplayName,
    unitDisplayName: leaseInfo.unitDisplayName,
    fullyQualifiedName: leaseInfo.unitFullyQualifiedName,
    isPastResident: leaseInfo.partyWorkflowState === DALTypes.WorkflowState.ARCHIVED,
  });

  buildUnitBalanceInfo(leaseInfo: LeaseInfo): UnitUserInfo {
    const balanceDueDate = now().add(5, 'days');

    return {
      ...this.buildUnitInfo(leaseInfo),
      balanceDueAmount: 5000,
      paymentStatus: PaymentStatus.ACCEPT,
      balanceDueDate: balanceDueDate && balanceDueDate.format(YEAR_MONTH_DAY_FORMAT),
    } as UnitUserInfo;
  }

  returnPaymentInfoFromDb = async (ctx: IDbContext, commonUserId: string, leaseInfo: LeaseInfo) => {
    try {
      logger.debug({ ctx, commonUserId }, 'FakeProvider - getting payment db data');
      const {
        aptexxData: { integrationId },
      } = leaseInfo;
      if (integrationId) {
        const unitUserInfo: UnitUserInfo = this.buildUnitBalanceInfo(leaseInfo);
        const paymentMethods: PaymentMethod[] = await getPaymentMethodsByUserIdAndIntegrationId(ctx, commonUserId, integrationId);
        const formattedPaymentInfo = await this.formatPaymentInfo(
          ctx,
          { unitUserInfo, currentCharges: [], paymentMethods, transactions: [], scheduledPayments: [] },
          commonUserId,
        );

        return { processed: true, paymentInfo: [formattedPaymentInfo] };
      }
      return { processed: false };
    } catch (error) {
      logger.error({ ctx, error, commonUserId }, 'FakeProvider - getting payment db data failed');
      return { processed: false };
    }
  };

  async getPaymentInfo(ctx: IDbContext, leaseInfo: LeaseInfo, commonUserId: string): Promise<PaymentInfo[]> {
    try {
      logger.debug({ ctx, leaseInfo }, 'FakeProvider - getPaymentInfo');

      const { found, paymentInfo } = await this.getRemoteCannedData(ctx, commonUserId);
      if (found) return paymentInfo;

      const { processed, paymentInfo: partialPaymentInfo } = await this.returnPaymentInfoFromDb(ctx, commonUserId, leaseInfo);
      if (processed) return partialPaymentInfo;

      const basePath = path.join(__dirname, 'canned-data');

      const files = await fs.readdir(basePath);

      return await this.readAndParsePaymentInfo(ctx, files, basePath, leaseInfo.unitFullyQualifiedName, commonUserId);
    } catch (err) {
      logger.error({ ctx, leaseInfo, error: err }, 'FakeProvider - Error reading canned data');
      return [];
    }
  }

  async hasOverduePayments(_ctx: IDbContext, _li: LeaseInfo): Promise<boolean> {
    return false;
  }

  getScheduledTransactions = async (ctx: IDbContext, leaseInfo: LeaseInfo): Promise<Transactions> => {
    logger.trace({ ctx, leaseInfo }, 'FakeProvider - getScheduledTransaction');

    return { payments: [], declines: [], voids: [], refunds: [], reversals: [] };
  };

  async getPaymentMethodFormUrl(ctx: IDbContext, data: PaymentInfoToBuildFormUrl) {
    const { personId, propertyId, commonUserId, successUrl, cancelUrl } = data;

    logger.trace({ ctx, personId, propertyId, commonUserId, successUrl, cancelUrl }, 'FakeProvider - getPaymentMethodFormUrl');
    /* throw new ServiceError({
      token: 'PAYMENT_METHOD_NOT_FOUND',
      status: 404,
    }); */
    // the real provider returns a link const { link } = await this.callAptexxAPI..... not sure what this should be but hopefully something
    // and not this error
    return '';
  }

  async makeOneTimePayment(ctx: IDbContext, data: { personId: string; propertyId: string; inventoryId: string; methodId: string; paymentAmount: number }) {
    logger.trace({ ctx, ...data }, 'FakeProvider - makeOneTimePayment');

    return { success: true };
  }

  async getScheduledPaymentFormUrl(ctx: IDbContext, data: ScheduleInfoToBuildFormUrl) {
    const { personId, propertyId, commonUserId, successUrl, cancelUrl, inventoryId } = data;

    logger.trace({ ctx, personId, propertyId, commonUserId, successUrl, cancelUrl, inventoryId }, 'FakeProvider - getScheduledPaymentFormUrl');
    /* throw new ServiceError({
      token: 'SCHEDULED_PAYMENT_NOT_FOUND',
      status: 404,
    }); */
    return '';
  }

  async deleteScheduledPayment(ctx: IDbContext, data: { personId: string; scheduleId: string; commonUserId: string; propertyId: string }) {
    const { personId, propertyId, commonUserId, scheduleId } = data;

    logger.trace({ ctx, personId, propertyId, commonUserId, scheduleId }, 'FakeProvider - deleteScheduledPayment');
    return { success: true };
  }

  async updatePaymentMethodStatus(ctx: IDbContext, data: { paymentMethodId: string; externalPaymentMethodId: string; propertyId: string }) {
    const { paymentMethodId, externalPaymentMethodId, propertyId } = data;

    logger.trace({ ctx, paymentMethodId, externalPaymentMethodId, propertyId }, 'FakeProvider - updatePaymentMethodStatus');

    return { success: true };
  }

  async getMaintenanceInformation(ctx: IDbContext, leaseInfoList: LeaseInfo[]): Promise<MaintenanceInfo> {
    logger.trace({ ctx, leaseInfoList }, 'FakeProvider - getMaintenanceInformation');

    return {
      unitsMaintenanceInfo: [
        {
          inventoryId: '03e055ad-80a2-478e-abcc-9014f34187f0',
          tickets: [
            {
              location: 'KITCHEN',
              dateCreated: '2020-05-01T00:00:00-05:00',
              dateCompleted: '',
              dateCancelled: '',
              type: 'Other',
              description: 'The AC is not working',
              hasPermissionToEnter: true,
              hasPets: false,
              status: MaintenanceStatus.Open,
              attachmentUrls: [],
              ticketNumber: 1,
            }, // end of first ticket for first unit

            {
              location: 'LIVING_ROOM',
              dateCreated: '2020-05-02T00:00:00-05:00',
              dateCompleted: '',
              dateCancelled: '',
              type: 'Other',
              description:
                'The AC is not working v3. and this text should be longer than one row. three dots should appear once the length of the row has been reached',
              hasPermissionToEnter: true,
              hasPets: false,
              status: MaintenanceStatus.Resolved,
              attachmentUrls: [],
              ticketNumber: 2,
            },
          ], // end of tickets for first unit
        }, // end of first unit's info
        {
          inventoryId: '47442f16-3b51-4f30-89f5-741a675ac189',
          tickets: [
            {
              location: 'KITCHEN',
              dateCreated: '2020-05-03T00:00:00-05:00',
              dateCompleted: '',
              dateCancelled: '',
              type: 'Other',
              description: 'The AC is not working v2',
              hasPermissionToEnter: true,
              hasPets: false,
              status: MaintenanceStatus.Open,
              attachmentUrls: [],
              ticketNumber: 3,
            },
          ], // tickets
        }, // 2nd unit's info
      ],
    };
  }

  async getMaintenanceTypes(ctx: IDbContext, data: { clientId: string; accountId: string }) {
    const { clientId, accountId } = data;

    logger.trace({ ctx, clientId, accountId }, 'AptexxProvider - getMaintenanceTypes');

    return {
      types: [
        { integrationId: 'Alexa', type: 'Alexa' },
        { integrationId: 'Appliances', type: 'Appliances' },
        { integrationId: 'Appointment', type: 'Appointment' },
        {
          integrationId: 'Common Area Exterior',
          type: 'Common Area Exterior',
        },
        {
          integrationId: 'Common Area Interior',
          type: 'Common Area Interior',
        },
        {
          integrationId: 'Common Area Resident Notice',
          type: 'Common Area Resident Notice',
        },
        {
          integrationId: 'Community Amenities',
          type: 'Community Amenities',
        },
        { integrationId: 'Equipment Delivery', type: 'Equipment Delivery' },
        { integrationId: 'Firewood Delivery', type: 'Firewood Delivery' },
        { integrationId: 'Flooring', type: 'Flooring' },
        { integrationId: 'General', type: 'General' },
        { integrationId: 'Inspection', type: 'Inspection' },
        { integrationId: 'Janitorial', type: 'Janitorial' },
        { integrationId: 'Landscaping', type: 'Landscaping' },
        { integrationId: 'Leak', type: 'Leak' },
        { integrationId: 'Lighting', type: 'Lighting' },
        { integrationId: 'Locks / Keys', type: 'Locks / Keys' },
        {
          integrationId: 'Make Ready Concerns',
          type: 'Make Ready Concerns',
        },
        {
          integrationId: 'Moisture Intrusions',
          type: 'Moisture Intrusions',
        },
        {
          integrationId: 'Move-In Lease Audit',
          type: 'Move-In Lease Audit',
        },
        {
          integrationId: 'Move-In Lease Audit (Corp)',
          type: 'Move-In Lease Audit (Corp)',
        },
        { integrationId: 'Painting & Plaster', type: 'Painting & Plaster' },
        { integrationId: 'Pest Control', type: 'Pest Control' },
        {
          integrationId: 'Preventive Maintenance',
          type: 'Preventive Maintenance',
        },
        { integrationId: 'Resident Services', type: 'Resident Services' },
        { integrationId: 'Roofing', type: 'Roofing' },
        {
          integrationId: 'Routine Maintenance',
          type: 'Routine Maintenance',
        },
        { integrationId: 'SFHA', type: 'SFHA' },
        { integrationId: 'Warranty', type: 'Warranty' },
        { integrationId: 'Windows / Doors', type: 'Windows / Doors' },
      ],
      locations: [
        { code: 'BATHROOM', name: 'Bathroom' },
        { code: 'BEDROOM', name: 'Bedroom' },
        { code: 'KITCHEN', name: 'Kitchen' },
        { code: 'LIVING_ROOM', name: 'Living Room' },
        { code: 'OTHER', name: 'Other' },
        { code: 'OUTSIDE', name: 'Outside' },
      ],
    };
  }

  async createMaintenanceRequest(ctx: IDbContext): Promise<any> {
    logger.trace({ ctx }, 'FakeProvider - createMaintenanceRequest');

    return { maintenanceId: 4826 };
  }
}
