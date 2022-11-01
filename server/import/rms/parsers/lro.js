/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sax from 'sax';
import { createReadStream, readFileSync } from 'fs';
import Promise from 'bluebird';
import {
  getLROUnitInfo,
  addLeaseTerms,
  addAmenity,
  buildUnitStructure,
  isThereAnErrorForTheInventory,
  addErrors,
  getLRORenewalInfo,
  getRenewalLeaseTerm,
  getDateByAttribute,
} from '../helpers';
import { RmsImportError } from '../../../../common/enums/enums';
import loggerModule from '../../../../common/helpers/logger';
import { getPropertyByRmsExternalId } from '../../../dal/propertyRepo';
import { now } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';

const logger = loggerModule.child({ subType: 'LRO parser' });

const strict = true;
const UNIT_TAG = 'unit';
const LEASETERM_TAG = 'offeredterm';
const PROPERTY_TAG = 'community';
const AMENITY_TAG = 'amenity';
const RENEWAL_TAG = 'renewal';
const RENEWALS_TAG = 'renewals';
const encoding = 'utf8';

export const parseFile = async (ctx, file) => {
  const xmlString = readFileSync(file.filePath, 'utf8');
  const propertyIdRegex = new RegExp('(?<=ID=")[^"]*', 'gm');
  const matches = xmlString.match(propertyIdRegex);
  let propertyTimezone;

  if (matches && matches.length) {
    const propertyExternalId = matches[0].trim();
    const { timezone } = (await getPropertyByRmsExternalId(ctx, propertyExternalId)) || {};
    propertyTimezone = timezone;
  }

  return new Promise((resolve, reject) => {
    const units = [];
    let propertyExternalId = null;
    let currentUnit = {};
    let leaseTerms = {};
    let currentLeaseTerm = null;
    let errors = [];
    let amenityList = [];
    let currentAmenity = null;
    let currentRenewal = null;
    let isRenewalsNode = false;

    const fileName = file.originalName;
    const parser = sax.createStream(strict, { lowercase: true, trim: true });

    parser.on('opentag', node => {
      const { name } = node;

      if (name === UNIT_TAG) {
        currentUnit = getLROUnitInfo(ctx, { ...node, fileName });
        isRenewalsNode = false;
      }

      if (name === RENEWALS_TAG) {
        isRenewalsNode = true;
      }

      if (name === RENEWAL_TAG) {
        currentRenewal = getLRORenewalInfo({ ...node, fileName });
      }

      if (name === PROPERTY_TAG) {
        propertyExternalId = node.attributes.ID;
      }

      if (name === LEASETERM_TAG) {
        currentLeaseTerm = isRenewalsNode
          ? getRenewalLeaseTerm({ nodeAttributes: node.attributes, currentRenewal, timezone: propertyTimezone })
          : {
              ...node.attributes,
              STARTDATE: node.attributes.STARTDATE
                ? getDateByAttribute(node.attributes.STARTDATE, propertyTimezone)
                : now({ propertyTimezone }).format(YEAR_MONTH_DAY_FORMAT),
              ENDDATE: node.attributes.ENDDATE
                ? getDateByAttribute(node.attributes.ENDDATE, propertyTimezone)
                : now({ propertyTimezone }).add(1, 'years').format(YEAR_MONTH_DAY_FORMAT),
              AVAILDATE: node.attributes.AVAILDATE ? getDateByAttribute(node.attributes.AVAILDATE, propertyTimezone) : '',
            };
      }

      if (name === AMENITY_TAG) {
        currentAmenity = node.attributes.DESCRIPTION;
      }
    });

    parser.on('closetag', nodeName => {
      if (!currentLeaseTerm && !currentAmenity) return;

      if (nodeName === LEASETERM_TAG) {
        const isTotalConcessionZero = parseFloat(currentLeaseTerm.TOTALCONCESSION) === 0;

        if (!isRenewalsNode && !isTotalConcessionZero) {
          errors = addErrors(errors, { externalId: currentUnit.externalId, message: 'Non-zero concession for' });
        }

        leaseTerms = addLeaseTerms(leaseTerms, currentLeaseTerm);
      }

      if (nodeName === AMENITY_TAG) {
        amenityList = addAmenity(amenityList, currentAmenity);
      }

      if (nodeName === UNIT_TAG || nodeName === RENEWAL_TAG) {
        const currentUnitOrRenewal = isRenewalsNode ? currentRenewal : currentUnit;
        const { unitStructure, error } = buildUnitStructure(leaseTerms, amenityList, currentUnitOrRenewal, propertyTimezone);

        if (error) {
          errors = addErrors(errors, { externalId: currentUnit.externalId, message: error });
        }

        if (!isThereAnErrorForTheInventory(errors, currentUnit.externalId)) {
          units.push(unitStructure);
        }
        currentUnit = {};
        currentRenewal = {};
        leaseTerms = {};
        currentAmenity = {};
        amenityList = [];
      }

      if (nodeName === RENEWALS_TAG) {
        isRenewalsNode = false;
      }
    });

    parser.on('error', error =>
      reject(addErrors([], { externalId: currentUnit.externalId, message: error.message, rmsErrorType: RmsImportError.PARSING_FAILED_ERROR })),
    );

    parser.on('end', () => {
      logger.info({ ctx, file }, `Parsed Units: ${units.length}`);
      resolve({ units, errors, propertyExternalId });
    });

    const stream = createReadStream(file.filePath, { encoding });
    stream.on('error', error => reject(addErrors([], { message: error.message, rmsErrorType: RmsImportError.FILE_NOT_FOUND_ERROR })));
    stream.pipe(parser);
  });
};
