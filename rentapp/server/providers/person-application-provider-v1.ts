/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PersonApplicationProvider from './person-application-provider';
import { IDictionaryHash, IDbContext } from '../../../common/types/base-types';
import { ScreeningVersion } from '../../../common/enums/screeningReportTypes';
import {
  getPersonApplicationByPersonIdAndPartyApplicationId,
  getPersonApplicationsByFilter,
  getPersonApplicationByFilter,
  getPersonApplicationWithoutApplicationDataForApplicant,
  createOrUpdatePersonApplication as createOrUpdatePersonApplicationService,
  getPersonApplication as getPersonApplicationService,
  updatePersonApplicationStatus,
  updatePersonApplicationPaymentCompleted,
  hasPaidApplication as hasPaidApplicationService,
} from '../services/person-application';
import { getPersonApplication as getPersonApplicationDal, savePaymentLink as savePaymentLinkDal } from '../dal/person-application-repo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getApplicationInvoice as getApplicationInvoiceService } from '../services/application-invoices';
import { updateApplicationInvoice as updateApplicationInvoiceDal } from '../dal/application-invoices-repo';

interface IOptionsArgs {
  maskSsn?: boolean;
  includeApplicationsWherePartyMemberIsInactive?: boolean;
  includeMerged?: boolean;
}

export default class PersonApplicationProviderV1 extends PersonApplicationProvider {
  constructor() {
    super(ScreeningVersion.V1);
  }

  getPersonApplicationsFromCommonUsers = async (commonUsers: Array<any>): Promise<object[]> =>
    (
      await Promise.all(
        commonUsers.map(({ personId: personIdCommonUser, tenantId: tenantIdCommonUser }) =>
          getPersonApplicationsByFilter({ tenantId: tenantIdCommonUser }, { personId: personIdCommonUser }),
        ),
      )
    ).reduce((acc, item) => acc.concat(item), []) as object[];

  getPersonApplication = async (ctx: IDbContext, personId: string, partyApplicationId: string, options: IOptionsArgs): Promise<object> =>
    await getPersonApplicationByPersonIdAndPartyApplicationId(ctx, personId, partyApplicationId, options);

  getPersonApplicationById = async (ctx: IDbContext, id: string): Promise<object> => await getPersonApplicationDal(ctx, id);

  createAndGetPersonApplication = async (ctx: IDbContext, personApplicationId: string, personApplicationData: object): Promise<object> => {
    const personApplication = !personApplicationId
      ? await createOrUpdatePersonApplicationService(ctx, personApplicationData)
      : await getPersonApplicationService(ctx, personApplicationId);

    if (
      personApplication.applicationStatus === DALTypes.PersonApplicationStatus.NOT_SENT ||
      personApplication.applicationStatus === DALTypes.PersonApplicationStatus.SENT
    ) {
      await updatePersonApplicationStatus(ctx, personApplication.id, DALTypes.PersonApplicationStatus.OPENED);
    }
    return personApplication;
  };

  getApplication = async (
    ctx: IDbContext,
    _party: IDictionaryHash<any>, // TODO: Ask Roberto why is this variable not used
    personApplicationData: IDictionaryHash<any>,
    options: IDictionaryHash<any>,
  ): Promise<object> => {
    // Since the APPLY NOW link doesn't have the personApplicationId
    // we must validate that the user doesn't exists in rentapp_PersonApplication table
    // otherwise we must override the personApplicationId
    const { personId, partyId } = personApplicationData;
    let { shouldExcludeCurrentDataInResponse, personApplicationId } = options;
    const personApplication = await getPersonApplicationByFilter(ctx, personId, partyId);
    const updatePersonApplicationId = !!(!personApplicationId && personApplication);
    personApplicationId = updatePersonApplicationId ? personApplication.id : personApplicationId;

    return shouldExcludeCurrentDataInResponse
      ? await getPersonApplicationWithoutApplicationDataForApplicant(ctx, { personId, partyId })
      : await this.createAndGetPersonApplication(ctx, personApplicationId, personApplicationData);
  };

  createOrUpdatePersonApplication = async (ctx: IDbContext, personApplicationRaw: object, options: IDictionaryHash<any>): Promise<object> =>
    await createOrUpdatePersonApplicationService(ctx, personApplicationRaw, options.shouldExcludeCurrentDataInResponse);

  hasPaidApplication = async (ctx: IDbContext, personId: string, partyId: string): Promise<boolean> => await hasPaidApplicationService(ctx, personId, partyId);

  // TODO: Ask Roberto why propertyId is not used
  completeApplicationPayment = async (ctx: IDbContext, personApplicationId: string, _propertyId: string, paymentCompleted: boolean): Promise<void> =>
    await updatePersonApplicationPaymentCompleted(ctx, personApplicationId, paymentCompleted);

  updateApplicationInvoice = async (
    ctx: IDbContext,
    invoice: { id: string; paymentCompleted: boolean },
    // TODO: Ask Roberto why _applicantSupportData is not used
    _applicantSupportData: { personId: string; partyId: string },
  ): Promise<object> => await updateApplicationInvoiceDal(ctx, invoice);

  validatePersonApplicationExists = async (tenantId: string, applicationId: string): Promise<boolean> =>
    await this.validateApplicationExists(tenantId, applicationId, 'rentapp_PersonApplication');

  // TODO: Ask Roberto why _applicantSupportData is not used
  getApplicationInvoice = async (
    ctx: IDbContext,
    invoice: { id: string },
    _applicantSupportData?: { personApplicationId?: string; propertyId?: string },
  ): Promise<object> => await getApplicationInvoiceService(ctx, invoice);

  savePaymentLink = async (ctx: IDbContext, personApplicationId: string, paymentLink: string): Promise<any> =>
    await savePaymentLinkDal(ctx, personApplicationId, paymentLink);
}
