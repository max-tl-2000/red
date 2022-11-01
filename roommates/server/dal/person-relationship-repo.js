/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertInto, updateOne, getOneWhere } from '../../../server/database/factory';
import { DALTables } from '../../common/enums/dal-tables';

export const createPersonRelationship = (tenantId, personRelationship) => insertInto(tenantId, DALTables.Tables.PERSON_RELATIONSHIP, personRelationship);

export const updatePersonRelationship = (tenantId, id, personRelationship) => updateOne(tenantId, DALTables.Tables.PERSON_RELATIONSHIP, id, personRelationship);

export const getPersonRelationshipByFilter = (tenantId, filter) => getOneWhere(tenantId, DALTables.Tables.PERSON_RELATIONSHIP, filter);
