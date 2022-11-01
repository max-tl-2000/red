/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getTenant } from '../../../services/tenantService';
import { getAllExecutedLeases, getAllActiveLeases } from '../../../dal/leaseRepo';

export const preComputeRequiredData = async ctx => {
  const tenant = await getTenant(ctx);
  const transformReservedUnitStatusWithoutLease = tenant?.settings?.features?.transformReservedUnitStatusWithoutLease;
  const allExecutedLeases = transformReservedUnitStatusWithoutLease ? await getAllExecutedLeases(ctx) : [];
  const activeLeases = transformReservedUnitStatusWithoutLease ? await getAllActiveLeases(ctx) : [];

  return {
    transformReservedUnitStatusWithoutLease: tenant?.settings?.features?.transformReservedUnitStatusWithoutLease,
    allExecutedLeases,
    activeLeases,
  };
};

const SKIP_VALUES = ['ResUnitStatus', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code) && !row.EndDate?.trim();

const YARDI_STATUS = {
  Admin: DALTypes.InventoryState.ADMIN,
  Down: DALTypes.InventoryState.DOWN,
  Excluded: DALTypes.InventoryState.EXCLUDED,
  Model: DALTypes.InventoryState.MODEL,
  'Notice Rented': DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
  'Notice Unrented': DALTypes.InventoryState.OCCUPIED_NOTICE,
  'Occupied No Notice': DALTypes.InventoryState.OCCUPIED,
  'Vacant Rented Not Ready': DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
  'Vacant Rented Ready': DALTypes.InventoryState.VACANT_READY_RESERVED,
  'Vacant Unrented Not Ready': DALTypes.InventoryState.VACANT_MAKE_READY,
  'Vacant Unrented Ready': DALTypes.InventoryState.VACANT_READY,
  Waitlist: DALTypes.InventoryState.EXCLUDED,
};

const TRANSFORMED_YARDI_STATUS = {
  'Vacant Rented Not Ready': DALTypes.InventoryState.VACANT_MAKE_READY,
  'Vacant Rented Ready': DALTypes.InventoryState.VACANT_READY,
  'Notice Rented': DALTypes.InventoryState.OCCUPIED_NOTICE,
};

export const CSV_HEADERS = [
  'Property_Code',
  'Ref_Property_ID',
  'StartDate',
  'EndDate',
  'Unit_Code',
  'Date',
  'Status',
  'Tenant_Code',
  'Ext_Ref_Tenant_Id',
  'ApplyDate',
  'ApproveDate',
  'SignDate',
  'MoveInDate',
  'MoveOutDate',
  'LeaseFromDate',
  'LeaseToDate',
  'NoticeDate',
  'AvailableDate',
  'RentReady',
  'VacantDate',
  'ReadyDate',
  'Ref_Unit_Id',
];

export const NEW_CSV_HEADERS = ['externalId', 'property', 'unitCode', 'state', 'startDate', 'availabilityDate', 'computedExternalId'];

// per the specs from CPM-20119 and CPM-20206, the three yardi states from here TRANSFORMED_YARDI_STATUS, need to be transformed
// when the transformReservedUnitStatusWithoutLease flag is true and
// 1. we don't have an executed lease for the t-code
// 2. we don’t apply the translation if the t-code matches an AL and that’s the only open/active workflow in that partyGroup.
const getMappedStatus = (row, requiredData) => {
  const leasesForTCode = requiredData?.activeLeases?.filter(lease => lease.externalId === row.Tenant_Code);
  let applyTranslation;

  if (
    leasesForTCode.length === 1 &&
    leasesForTCode[0].workflowName === DALTypes.WorkflowName.ACTIVE_LEASE &&
    leasesForTCode[0].workflowState === DALTypes.WorkflowState.ACTIVE
  ) {
    applyTranslation = false;
  } else {
    const executedLeaseExists = row.Tenant_Code && (requiredData?.allExecutedLeases || []).some(lease => lease.externalId === row.Tenant_Code);

    applyTranslation = !executedLeaseExists;
  }

  if (requiredData?.transformReservedUnitStatusWithoutLease && applyTranslation) {
    const status = TRANSFORMED_YARDI_STATUS[row.Status];
    return status || YARDI_STATUS[row.Status];
  }

  return YARDI_STATUS[row.Status];
};

const getMapping = requiredData => [
  { csv: 'Property_Code', excel: 'property' },
  { csv: 'Unit_Code', excel: 'unitCode' },
  { excel: 'state', fn: row => getMappedStatus(row, requiredData) },
  { csv: 'StartDate', excel: 'startDate' },
  { csv: 'Unit_Code', excel: 'externalId' },
  { csv: 'AvailableDate', excel: 'availabilityDate' },
  { excel: 'computedExternalId', fn: row => [row.Property_Code, row.Unit_Code].filter(x => x).join('-') },
];

export const REQUIRED_HEADERS = ['Property_Code', 'Unit_Code', 'StartDate', 'AvailableDate'];

export const unitStatusCsvMapper = (row, requiredData) => ({
  valid: isValid(row),
  data: converter(row, NEW_CSV_HEADERS, getMapping(requiredData)),
});
