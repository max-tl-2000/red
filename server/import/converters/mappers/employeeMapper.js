/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from './converter';
import { extractPreferredName } from '../../../../common/helpers/strings';

export const EXCEL_HEADERS = ['userUniqueId', 'registrationEmail', 'fullName', 'businessTitle', 'preferredName', 'employmentType', 'calendarAccount'];

export const CSV_HEADERS = ['Property_Code', 'Ref_Property_ID', 'Agent_Name'];

const MAPPING = [
  { csv: 'Agent_Name', excel: 'fullName' },
  { excel: 'preferredName', fn: row => extractPreferredName(row.Agent_Name) },
  { default: 'permanent', excel: 'employmentType' },
];

const SKIP_VALUES = ['ResAgentNames', 'Property_Code'];
const isValid = row => !SKIP_VALUES.includes(row.Property_Code);

export const employeeMapper = row => ({
  valid: isValid(row),
  data: converter(row, EXCEL_HEADERS, MAPPING),
});
