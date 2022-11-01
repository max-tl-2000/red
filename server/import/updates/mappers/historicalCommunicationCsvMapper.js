/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import trim from '../../../../common/helpers/trim';
import { DALTypes } from '../../../../common/enums/DALTypes';

const SKIP_VALUES = ['scode'];

const hasMandatoryFields = ({ scode, scode1, dtdate }) => !!(trim(scode) && trim(scode1) && trim(dtdate));

const isValid = row => !SKIP_VALUES.includes(row.scode) && hasMandatoryFields(row);

export const CSV_HEADERS = ['scode', 'scode1', 'stype', 'sagent', 'dtdate', 'snotes'];

export const NEW_CSV_HEADERS = ['property', 'prospectId', 'contactEventType', 'agent', 'contactEventDate', 'note'];

const MAPPING = [
  { csv: 'scode', excel: 'property' },
  { csv: 'scode1', excel: 'prospectId' },
  {
    excel: 'contactEventType',
    fn: row => {
      switch (row.stype) {
        case 'Appointment':
        case 'Return Visit':
        case 'Show':
        case 'Showing':
        case 'Walk-In':
          return DALTypes.ContactEventTypes.WALKIN;
        case 'Call':
          return DALTypes.ContactEventTypes.CALL;
        case 'SMS':
        case 'Text':
          return DALTypes.ContactEventTypes.SMS;
        case 'Email':
          return DALTypes.ContactEventTypes.EMAIL;
        case 'Chat':
          return DALTypes.ContactEventTypes.CHAT;
        default:
          return DALTypes.ContactEventTypes.OTHER;
      }
    },
  },
  { csv: 'sagent', excel: 'agent' },
  { csv: 'dtdate', excel: 'contactEventDate' },
  { csv: 'snotes', excel: 'note' },
];

export const REQUIRED_HEADERS = ['scode', 'scode1', 'stype', 'sagent', 'dtdate', 'snotes'];

export const historicalCommunicationCsvMapper = row => ({
  valid: isValid(row),
  data: converter(row, NEW_CSV_HEADERS, MAPPING),
});
