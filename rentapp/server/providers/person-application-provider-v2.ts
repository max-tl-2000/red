/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import get from 'lodash/get';
import PersonApplicationProvider from './person-application-provider';
import { IDictionaryHash, IDbContext } from '../../../common/types/base-types';
import { ScreeningVersion } from '../../../common/enums/screeningReportTypes';
import {
  hasPaidApplication as hasPaidApplicationDal,
  getApplicantDataNotCommittedById,
  getApplicantDataNotCommittedByPersonId,
  getApplicantDataNotCommittedByPersonIdAndPartyId,
  getApplicantDataNotCommittedByPersonIdAndPartyApplicationId,
  updateApplicantDataNotCommitted,
} from '../dal/applicant-data-not-committed-repo';
import { createOrUpdateApplicantDataNotCommitted as createOrUpdateApplicantDataNotCommittedService, saveApplicantData } from '../services/applicant-data';
import { IApplicantDataNotCommitted, IApplicantData } from '../helpers/applicant-types';
import { getPartyApplicationByPartyId } from '../services/party-application';
import { now } from '../../../common/helpers/moment-utils';
import { runInTransaction } from '../../../server/database/factory';

export default class PersonApplicationProviderV2 extends PersonApplicationProvider {
  constructor() {
    super(ScreeningVersion.V2);
  }

  getPersonApplicationsFromCommonUsers = async (commonUsers: Array<any>): Promise<object[]> =>
    (
      await Promise.all(
        commonUsers.map(({ personId: personIdCommonUser, tenantId: tenantIdCommonUser }) =>
          getApplicantDataNotCommittedByPersonId({ tenantId: tenantIdCommonUser } as IDbContext, personIdCommonUser),
        ),
      )
    ).reduce((acc, item) => acc.concat(item), []);

  getPersonApplication = async (ctx: IDbContext, personId: string, partyApplicationId: string): Promise<IApplicantDataNotCommitted> =>
    await getApplicantDataNotCommittedByPersonIdAndPartyApplicationId(ctx, personId, partyApplicationId);

  getPersonApplicationById = async (ctx: IDbContext, id: string): Promise<IApplicantDataNotCommitted> => await getApplicantDataNotCommittedById(ctx, id);

  getPersonApplicationWithPersonIdAndPartyId = async (ctx: IDbContext, personId: string, partyId: string): Promise<IApplicantDataNotCommitted> =>
    await getApplicantDataNotCommittedByPersonIdAndPartyId(ctx, personId, partyId);

  createAndGetApplicantDataNotCommitted = async (ctx: IDbContext, personApplicationData: IDictionaryHash<any>): Promise<IApplicantDataNotCommitted> => {
    const { personId, partyId } = personApplicationData;
    let applicantDataNotCommitted = await getApplicantDataNotCommittedByPersonIdAndPartyId(ctx, personId, partyId);
    if (!applicantDataNotCommitted) {
      const { id: partyApplicationId } = await getPartyApplicationByPartyId(ctx, partyId);
      applicantDataNotCommitted = await createOrUpdateApplicantDataNotCommittedService(ctx, {
        ...personApplicationData,
        partyApplicationId,
      } as IApplicantDataNotCommitted);
    }

    return applicantDataNotCommitted;
  };

  getApplication = async (
    ctx: IDbContext,
    // TODO: Ask Roberto why partyId is not used
    _party: IDictionaryHash<any>,
    personApplicationData: IDictionaryHash<any>,

    // TODO: Ask Roberto why options is not used
    _options: IDictionaryHash<any>,
  ): Promise<IApplicantDataNotCommitted> => await this.createAndGetApplicantDataNotCommitted(ctx, personApplicationData);

  createApplicantDataObj = (applicantDataNotCommitted: IApplicantDataNotCommitted, propertyId?: string): IApplicantData =>
    ({
      personId: applicantDataNotCommitted.personId,
      applicationData: applicantDataNotCommitted.applicationData,
      propertyId,
      startDate: now().toDate(),
    } as IApplicantData);

  // TODO: Ask Roberto why options is not used
  createOrUpdatePersonApplication = async (ctx: IDbContext, personApplicationRaw: object, _options: IDictionaryHash<any>): Promise<object> =>
    await runInTransaction(async innerTrx => {
      const innerCtx = { ...ctx, trx: innerTrx };

      const applicantDataNotCommitted = await createOrUpdateApplicantDataNotCommittedService(innerCtx, personApplicationRaw as IApplicantDataNotCommitted);

      if (applicantDataNotCommitted.paymentCompleted) {
        await saveApplicantData(innerCtx, this.createApplicantDataObj(applicantDataNotCommitted));
      }

      return applicantDataNotCommitted;
    });

  hasPaidApplication = async (ctx: IDbContext, personId: string, partyId: string): Promise<boolean> => await hasPaidApplicationDal(ctx, personId, partyId);

  completeApplicationPayment = async (ctx: IDbContext, personApplicationId: string, propertyId: string, paymentCompleted: boolean): Promise<void> =>
    await runInTransaction(async innerTrx => {
      const innerCtx = { ...ctx, trx: innerTrx };

      const [applicantDataNotCommitted] = await updateApplicantDataNotCommitted(innerCtx, personApplicationId, {
        paymentCompleted,
      } as IApplicantDataNotCommitted);

      await saveApplicantData(innerCtx, this.createApplicantDataObj(applicantDataNotCommitted, propertyId));
    });

  // TODO: CPM-12483 implement invoices for screening V2
  // TODO: Ask Roberto why invoice is not used
  updateApplicationInvoice = async (
    ctx: IDbContext,
    _invoice: { id: string; paymentCompleted: boolean },
    applicantSupportData: { personId: string; partyId: string },
  ): Promise<object> => {
    const applicantDataNotCommitted = await this.getPersonApplicationWithPersonIdAndPartyId(ctx, applicantSupportData.personId, applicantSupportData.partyId);
    return { personApplicationId: applicantDataNotCommitted.id };
  };

  validatePersonApplicationExists = async (tenantId: string, applicationId: string): Promise<boolean> =>
    await this.validateApplicationExists(tenantId, applicationId, 'ApplicantDataNotCommitted');

  // TODO: CPM-12483 implement invoices for screening V2
  // TODO: Ask Roberto why ctx is not used
  getApplicationInvoice = async (
    _ctx: IDbContext,
    invoice: { id: string },
    applicantSupportData?: { personApplicationId?: string; propertyId?: string },
  ): Promise<object> => ({
    id: invoice.id,
    personApplicationId: get(applicantSupportData, 'personApplicationId', getUUID()),
    propertyId: get(applicantSupportData, 'propertyId', getUUID()),
  });

  savePaymentLink = async (_ctx: IDbContext, _personApplicationId: string, _paymentLink: string): Promise<any> =>
    // TODO: implement save paymentLink for v2
    Promise.resolve();
}
