/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFieldsForOneToManys } from './mapUtils';

const oneToManysFields = {
  Table_Name: 'Table_Name',
  Entity_Record_Code: 'Entity_Record_Code',
  Field_Name1: 'Field_Name1',
  Field_Value1: 'Field_Value1',
  Field_Name2: 'Field_Name2',
  Field_Value2: 'Field_Value2',
  Field_Name3: 'Field_Name3',
  Field_Value3: 'Field_Value3',
  Field_Name4: 'Field_Name4',
  Field_Value4: 'Field_Value4',
  Field_Name5: 'Field_Name5',
  Field_Value5: 'Field_Value5',
  Field_Name6: 'Field_Name6',
  Field_Value6: 'Field_Value6',
  Field_Name7: 'Field_Name7',
  Field_Value7: 'Field_Value7',
  Field_Name8: 'Field_Name8',
  Field_Value8: 'Field_Value8',
  Field_Name9: 'Field_Name9',
  Field_Value9: 'Field_Value9',
  Field_Name10: 'Field_Name10',
  Field_Value10: 'Field_Value10',
};

export const createOneToManysMapper = data => data.map(item => mapDataToFieldsForOneToManys(item, oneToManysFields));
