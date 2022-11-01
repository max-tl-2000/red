/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from './converter';

export const EXCEL_HEADERS = [
  'name',
  'displayName',
  'propertyLegalName',
  'owner',
  'operator',
  'propertyGroup',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'startDate',
  'endDate',
  'APN',
  'MSANumber',
  'MSAName',
  'description',
  'website',
  'email',
  'displayPhone',
  'taxFlag',
];

export const CSV_HEADERS = [
  'Property_Code',
  'Country',
  'Ext_Ref_Property_Id',
  'Ref_Owner_Id',
  'Owner',
  'Addr1',
  'Addr2',
  'Addr3',
  'Addr4',
  'City',
  'State',
  'ZipCode',
  'Notes',
  'Vat_Recovery_Type',
  'Vat_Opted',
  'International',
  'Contract_Reserve',
  'Commission_Percent',
  'Commission_Min',
  'Contract_Exp_Date',
  'Affordable',
  'Student',
  'Association',
  'CanadianSocialHousing',
  'Commercial',
  'Military',
  'PublicHousing',
  'Senior',
  'Residential',
  'Is_Estate',
  'Tax_Status_Changed',
  'Status',
  'Tax_Recovery_Percentage',
  'NCREIF_Manager_ID',
  'Purchase_Price',
  'True_Acquisition_Asset_Date',
  'Net_Sales_Price',
  'Asset_Date_Not_NCREIF',
  'Project_Type',
  'Ideal_Lease',
  'Months_To_Lease',
  'Acquisition_Date',
  'Disposition_Asset_Date',
  'MLA',
  'VAT_Tran_Type',
  'Pur_Tran_Type',
  'Effective_Date',
];

const MAPPING = [
  { csv: 'Property_Code', excel: 'name' },
  { csv: 'Addr1', excel: 'displayName' },
  { csv: 'Addr2', excel: 'addressLine1' },
  { csv: 'Addr3', excel: 'addressLine2' },
  { csv: 'City', excel: 'city' },
  { csv: 'State', excel: 'state' },
  { csv: 'ZipCode', excel: 'postalCode' },
  { csv: 'Acquisition_Date', excel: 'startDate' },
  { csv: 'Disposition_Asset_Date', excel: 'endDate' },
  { csv: 'Notes', excel: 'description' },
];

const SKIP_VALUES = ['CommProperties', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const propertiesMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
