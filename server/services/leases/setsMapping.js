/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import { fieldsMapping } from './fieldsMapping';
import { documentsMapping } from './documentsMapping';
import { getLeaseSettingsForProperty } from './propertySetting';

const defaultSetsMapping = {
  // cove
  479: {
    applicable: true,
  },
  // woodchase
  483: {
    applicable: true,
  },
  // serenity
  481: {
    applicable: true,
  },
  // parkmerced
  482: {
    applicable: true,
  },
  // sharon
  484: {
    applicable: true,
  },
};

const setsMapping = templateData => {
  const sets = templateData.sets || {};
  const enhancedSets = Object.keys(sets).reduce((acc, setId) => {
    acc[setId] = {
      ...sets[setId],
      applicable: !!(defaultSetsMapping[setId] || {}).applicable,
    };
    return acc;
  }, {});

  return enhancedSets;
};

export const getEnhancedLeaseObject = (ctx, templateData, data, mapFields = true) => {
  const { propertyName } = data;
  const propertySettings = getLeaseSettingsForProperty(propertyName);
  const setsMappedObject = setsMapping(templateData, data);
  const documentsMappedObject = documentsMapping(templateData, data, propertySettings);
  const { globalFields, guarantorFields, ...fieldsMappedObject } = mapFields ? fieldsMapping(ctx, templateData, data) : {};

  const setIds = Object.keys(templateData.sets || {});
  const setId = setIds.find(currentId => setsMappedObject[currentId].applicable) || setIds[0];

  if (!setId) throw new Error('NO VALID LEASE TEMPLATE FOUND!');

  const { applicable, documents } = setsMappedObject[setId];

  const sortedDocsKeys = orderBy(
    documents,
    [
      key => (documentsMappedObject[key] || {}).mainForm,
      key => (documentsMappedObject[key] || {}).marinCountyTenantRights,
      key => (documentsMappedObject[key] || {}).booklet,
      key => (documentsMappedObject[key] || {}).handbook,
      key => (documentsMappedObject[key] || {}).displayName,
    ],
    ['desc', 'asc', 'asc', 'asc', 'asc'],
  );

  const setDocuments = sortedDocsKeys.reduce((docsAcc, docId, index) => {
    if (!(docId in documentsMappedObject)) return docsAcc;

    const { fields = {} } = documentsMappedObject[docId];

    const docFields = Object.keys(fields || {}).reduce((acc, current) => {
      acc[current] = {
        ...fieldsMappedObject[current],
      };
      return acc;
    }, {});

    docsAcc[docId] = {
      ...documentsMappedObject[docId],
      sortOrder: index,
      fields: docFields,
    };

    return docsAcc;
  }, {});

  const enhancedSet = {
    setId,
    ...setsMappedObject[setId],
    applicable,
    guarantorFields,
    documents: setDocuments,
    globalFields,
  };

  return enhancedSet;
};
