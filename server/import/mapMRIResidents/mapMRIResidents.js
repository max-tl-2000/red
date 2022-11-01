/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import path from 'path';
import newUUID from 'uuid/v4';
import fse from 'fs-extra';
import { retrieveData } from '../../services/importActiveLeases/retrieve-data';
import loggerModule from '../../../common/helpers/logger';
import { closePool, knex, rawStatement } from '../../database/factory';
import { getPartyMembersByPartyIds } from '../../dal/partyRepo';
import { insertExternalInfo, getExternalInfoByExternalIdAndPartyId } from '../../dal/exportRepo';

const properties = [
  '13780',
  '12160',
  '12440',
  '13130',
  '13320',
  '13290',
  '14000',
  '11270',
  '11301',
  '11400',
  '13650',
  '13880',
  '13890',
  '13970',
  '11640',
  '13710',
  '11351',
  '11500',
  '13830',
  '14170',
  '12450',
  '13870',
  '13900',
  '14070',
  '11220',
  '13000',
  '13640',
  '14180',
  '13700',
  '13720',
  '13740',
  '13840',
  '11330',
  '12510',
  '11540',
  '11571',
  '14050',
  '11720',
  '13510',
  '11601',
  '12461',
  '12462',
  '12630',
  '12930',
  '14090',
  '14100',
  '14110',
  '14130',
  '11120',
  '12150',
  '13850',
  '14010',
  '14020',
  '12982',
  '14040',
  '11140',
  '11190',
  '11291',
  '11590',
  '11700',
  '11960',
  '14190',
  '14120',
  '14200',
  '14160',
  '11340',
  '14150',
  '11020',
];

const logger = loggerModule.child({ subType: 'mapMRIResidents' });

const generateCsvFileForMembersThatHaveAnExternalId = async (mappedPMs, propertyId) => {
  await fse.ensureDirSync(`MRIMappings/${propertyId}`);
  const newFilePath = path.join(`MRIMappings/${propertyId}`, `${propertyId}_existingExternalIdsInReva.csv`);
  const header = 'NameId,revaName,email,phone,partyId,partyMemberId\n';
  let content = '';

  mappedPMs.forEach(mappedPM => {
    content += `${mappedPM.id},${mappedPM.fullName},${mappedPM.email},${mappedPM.phone},${mappedPM.partyId},${mappedPM.partyMemberId}\n`;
  });

  await fse.outputFileSync(newFilePath, header + content);
};

const insertMappedToExternalPartyMemberInfo = async (ctx, mappedPMs, propertyId) => {
  const alreadyHaveExternalId = [];

  await mapSeries(mappedPMs, async partyMember => {
    const externalInfoForMapped = await getExternalInfoByExternalIdAndPartyId(ctx, partyMember.id, partyMember.partyId);

    if (externalInfoForMapped) {
      alreadyHaveExternalId.push(partyMember);
    } else {
      const externalInfo = {
        id: newUUID(),
        partyId: partyMember.partyId,
        partyMemberId: partyMember.partyMemberId,
        leaseId: partyMember.leaseId,
        externalId: partyMember.id,
        propertyId: partyMember.propertyId,
        isPrimary: partyMember.isPrimary,
        metadata: {
          matching: 'residents',
        },
      };

      await insertExternalInfo(ctx, externalInfo);
    }
  });

  logger.trace({ totalMapped: mappedPMs.length, totalFoundAlreadyInEPMI: alreadyHaveExternalId.length }, 'Total Mapped vs Already in EPMI in Reva');

  await generateCsvFileForMembersThatHaveAnExternalId(alreadyHaveExternalId, propertyId);
};

const generateMappedMembersCsvFile = async (mappedPMs, propertyId) => {
  await fse.ensureDirSync(`MRIMappings/${propertyId}`);
  const newFilePath = path.join(`MRIMappings/${propertyId}`, `${propertyId}_mapped.csv`);
  const header = 'NameId,mriFirstName,mriLastName,revaName,email,phone,mappedValue,partyId,partyMemberId,partyType,matchingType\n';
  let content = '';

  mappedPMs.forEach(mappedPM => {
    content += `${mappedPM.id},${mappedPM.firstName},${mappedPM.lastName},${mappedPM.fullName},${mappedPM.email},${mappedPM.phone},${mappedPM.value},${mappedPM.partyId},${mappedPM.partyMemberId},${mappedPM.partyType},${mappedPM.type}\n`;
  });

  await fse.outputFileSync(newFilePath, header + content);
};

const generateUnMappedMembersFromUnidentifiedPartiesCsvFile = async unmappedPMs => {
  await fse.ensureDirSync('MRIMappings/');
  const newFilePath = path.join('MRIMappings/', 'unmapped-allUnmappedPMsFromReva.csv');

  const header =
    'fullName,partyId,partyMemberId,contactInfo,type,isMemberVacated,memberType,inventoryId,buildingId,partyState,stage,leaseType,propertyName,propertyId,propertyExternalId,leaseStartDate,leaseEndDate,inventoryState\n';
  let content = '';

  unmappedPMs.forEach(unmappedPM => {
    content += `${unmappedPM.fullName},${unmappedPM.partyId},${unmappedPM.partyMemberId},${unmappedPM.value},${unmappedPM.type},${unmappedPM.isMemberVacated},${unmappedPM.memberType},${unmappedPM.inventoryId},${unmappedPM.buildingId},${unmappedPM.partyState},${unmappedPM.stage},${unmappedPM.leaseType},${unmappedPM.propertyName},${unmappedPM.propertyId},${unmappedPM.propertyExternalId},${unmappedPM.leaseStartDate},${unmappedPM.leaseEndDate},${unmappedPM.inventoryState}\n`;
  });

  await fse.outputFileSync(newFilePath, header + content);
};

const generateUnMappedMembersCsvFileForAllProperties = async unmappedPMs => {
  await fse.ensureDirSync('MRIMappings/');
  const newFilePath = path.join('MRIMappings/', 'unmapped_PMs_from_identified_parties.csv');
  const header =
    'RevaName,PartyId,PartyMemberId,MemberType,LeaseStartDate,InventoryState,InventoryId,PartyState,Email,Phone,PropertyName,PropertyExternalId,otherPMNames,otherPMEmails,otherPMPhones,error\n';
  let content = '';

  unmappedPMs.forEach(unmappedPM => {
    content += `${unmappedPM.fullName.replace(/,/g, '')},${unmappedPM.partyId},${unmappedPM.partyMemberId || unmappedPM.id},${unmappedPM.memberType},${
      unmappedPM.leaseStartDate
    },${unmappedPM.inventoryState},${unmappedPM.inventoryId},${unmappedPM.partyState},${
      unmappedPM.contactInfo ? unmappedPM.contactInfo.defaultEmail : unmappedPM.email
    },${unmappedPM.contactInfo ? unmappedPM.contactInfo.defaultPhone : unmappedPM.phone},${unmappedPM.propertyName},${unmappedPM.propertyExternalId},${
      unmappedPM.otherPMNames
    },${unmappedPM.otherPMEmails},${unmappedPM.otherPMPhones},${unmappedPM.error}\n`;
  });

  await fse.outputFileSync(newFilePath, header + content);
};

const getPartiesForUnit = async (tenantId, resident, propertyExternalId) => {
  const residentEmails = resident.members
    .filter(member => member.email && member.email.includes('@'))
    .map(member => `'${member.email.replace(/'/g, '').toLowerCase()}'`);
  const residentPhones = resident.members.filter(member => member.phone).map(member => `'1${member.phone}'`);
  const residentNames = resident.members
    .filter(member => member.firstName || member.lastName)
    .map(
      member =>
        `'${member.firstName ? member.firstName.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase() : ''} ${
          member.lastName ? member.lastName.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase() : ''
        }'`,
    );

  const query = `
    SELECT l."partyId", prop."displayName" as "propertyName", prop.id as "propertyId",
           prop."name" as "propertyExternalId",
           l."baselineData"->'publishedLease'->>'leaseStartDate' as "leaseStartDate", 
           i.state as "inventoryState", p.state as "partyState", i."externalId" as "inventoryId", 
           l.id as "leaseId", p.stage
    FROM db_namespace."Lease" l
    INNER JOIN db_namespace."Party" p ON p.id = l."partyId"
    INNER JOIN db_namespace."PartyMember" pm ON pm."partyId" = l."partyId" AND pm."endDate" IS NULL
    INNER JOIN db_namespace."Person" pers ON pers."id" = pm."personId"
    INNER JOIN db_namespace."ContactInfo" ci ON pers."id" = ci."personId"
    INNER JOIN db_namespace."Inventory" i ON i."id"::text = l."baselineData"->'quote'->>'inventoryId'
    INNER JOIN db_namespace."Property" prop ON i."propertyId" = prop.id
    INNER JOIN db_namespace."Building" b ON i."buildingId" = b.id
    WHERE (l.status = :executedStatus OR l.status = :submittedStatus)
      AND i."externalId" = :unitName
      AND b."externalId" = :buildingName
      AND l."baselineData"->>'propertyName' = :propertyExternalId
      AND p.state IN ('Lease', 'FutureResident', 'Resident')
    GROUP BY l."partyId", l."baselineData"->'publishedLease'->>'leaseStartDate', prop."displayName", 
             i.state, p.state, i."externalId", l.id, prop.id, p.stage
    HAVING (
      ARRAY[${residentEmails}]::text[] && array_agg(lower(ci.value)) = true OR
      ARRAY[${residentPhones}]::varchar[] && array_agg(ci.value) = true OR
      ARRAY[${residentNames}]::text[] && array_agg(trim(lower(regexp_replace("fullName", '[^A-Za-z0-9]', ' ', 'g')))) = true)
    ORDER BY TO_DATE(l."baselineData"->'publishedLease'->>'leaseStartDate', 'YYYY/MM/DD') DESC`;

  const { rows } = await rawStatement({ tenantId }, query, [
    {
      executedStatus: 'executed',
      submittedStatus: 'submitted',
      unitName: resident.unitId,
      buildingName: resident.buildingId,
      propertyExternalId,
    },
  ]);

  return rows;
};

const addToUnmappedList = (unmappedPMs, party, partyMember, partyMembers, error) => {
  const otherPMs = partyMembers.filter(member => member.id !== partyMember.id);

  unmappedPMs.push({
    ...partyMember,
    otherPMNames: otherPMs.map(pm => (pm.fullName ? pm.fullName.replace(/,/g, '') : '')).join(';'),
    otherPMEmails: otherPMs.map(pm => pm.contactInfo.defaultEmail).join(';'),
    otherPMPhones: otherPMs.map(pm => pm.contactInfo.defaultPhone).join(';'),
    propertyName: party.propertyName,
    propertyExternalId: party.propertyExternalId,
    leaseStartDate: party.leaseStartDate,
    inventoryState: party.inventoryState,
    inventoryId: party.inventoryId,
    partyState: party.partyState,
    error,
  });
};

const mapByEmail = (partyMember, resident) => {
  const found = resident.members.find(member => {
    if (member && member.email && partyMember.contactInfo.defaultEmail) {
      return member.email.toLowerCase() === partyMember.contactInfo.defaultEmail.toLowerCase();
    }
    return false;
  });

  if (found) {
    return {
      ...found,
      value: partyMember.contactInfo.defaultEmail,
    };
  }

  return undefined;
};

const mapByPhone = (partyMember, resident) => {
  const phone =
    partyMember.contactInfo.defaultPhone && partyMember.contactInfo.defaultPhone.charAt(0) === '1'
      ? partyMember.contactInfo.defaultPhone.substr(1)
      : partyMember.contactInfo.defaultPhone;
  const found = resident.members.find(member => member.phone === phone);

  if (found) {
    return {
      ...found,
      value: partyMember.contactInfo.defaultPhone,
    };
  }

  return undefined;
};

const getFullNameWithoutMiddleName = fullName => {
  const nameArray = fullName
    .trim()
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .toLowerCase()
    .split(' ');

  const firstName = nameArray[0];
  const lastName = nameArray.pop();

  return firstName === lastName ? firstName : `${firstName}${lastName}`;
};

const mapByName = (partyMember, resident) => {
  const fullNameWithoutMiddleName = partyMember.fullName ? getFullNameWithoutMiddleName(partyMember.fullName) : '';

  const findByName = (pmFullName, member) => {
    const mriNameWithoutMiddleName = getFullNameWithoutMiddleName(
      `${member.firstName ? member.firstName.trim() : ''} ${member.lastName ? member.lastName.trim() : ''}`,
    );

    return mriNameWithoutMiddleName === pmFullName;
  };

  const found = fullNameWithoutMiddleName && resident.members.find(member => findByName(fullNameWithoutMiddleName, member));

  if (found) {
    return {
      ...found,
      value: partyMember.fullName,
    };
  }

  return undefined;
};

const searchForMultipleEmails = (members, type) => {
  if (type === 'reva') {
    const emails = members
      .map(member => member.contactInfo.defaultEmail)
      .filter(email => email)
      .map(email => email.toLowerCase());
    return new Set(emails).size !== emails.length;
  }

  const emails = members
    .map(member => member.email)
    .filter(email => email)
    .map(email => email.toLowerCase());
  return new Set(emails).size !== emails.length;
};

const searchForMultiplePhones = (members, type) => {
  if (type === 'reva') {
    const phones = members.map(member => member.contactInfo.defaultPhone).filter(phone => phone);
    return new Set(phones).size !== phones.length;
  }

  const phones = members.map(member => member.phone).filter(phone => phone);
  return new Set(phones).size !== phones.length;
};

const listAllUnmappedPMsFromProperty = async (tenantId, personIds, propertiesToRunFor) => {
  const query = `
    SELECT pers."fullName", ci.value, ci."type", p.id as "partyId", pm.id as "partyMemberId", pm."memberType",
           p.state as "partyState", p.stage, p."leaseType",
           prop."displayName" as "propertyName", prop.name as "propertyId", l."baselineData"->'publishedLease'->>'leaseStartDate' as "leaseStartDate",
           l."baselineData"->'publishedLease'->>'leaseEndDate' as "leaseEndDate",
           i.state as "inventoryState", i."externalId" as "inventoryId", b."externalId" as "buildingId",
           case 
           		when to_timestamp(l."baselineData"->'publishedLease'->>'leaseEndDate', 'YYYY-MM-DD HH24:MI:SS') < now() then 'vacated'
           		else 'not vacated'
           end "isMemberVacated"
    FROM db_namespace."PartyMember" pm 
    INNER join db_namespace."Party" p ON pm."partyId" = p.id
    INNER join db_namespace."Person" pers ON pers.id = pm."personId"
    INNER join db_namespace."ContactInfo" ci ON pers.id = ci."personId"
    INNER join db_namespace."Property" prop ON p."assignedPropertyId" = prop.id
    INNER JOIN db_namespace."Lease" l on l."partyId" = p.id
    INNER JOIN db_namespace."Inventory" i ON i."id"::text = l."baselineData"->'quote'->>'inventoryId'
    INNER JOIN db_namespace."Building" b ON b.id = i."buildingId"
    WHERE prop.name IN (${propertiesToRunFor.map(property => `'${property}'`)})
    AND l.status = :leaseStatus
    AND p.state IN ('FutureResident', 'Resident')
    AND pm."endDate" IS NULL
    AND pers.id NOT IN (${personIds.map(personId => `'${personId}'`)})
  `;

  const { rows } =
    personIds &&
    personIds.length &&
    (await rawStatement({ tenantId }, query, [
      {
        leaseStatus: 'executed',
      },
    ]));

  logger.error({ total: (rows && rows.length) || 0 }, 'PartyMembers from Reva for which we could not identify a mapping based on MRI Unified API data');

  return rows || [];
};

const addToMapped = (mappedPMs, unmappedPMs, mapped, partyMember, party, type, allPartyMembers, ambiguous, ambiguousTry) => {
  if (mappedPMs.find(mappedPM => mappedPM.id === mapped.id && mappedPM.partyId === partyMember.partyId)) {
    logger.error({ mapped, partyMember }, 'NameId - PartyId combination has already been mapped. Trying to map by name');

    const alreadyMapped = mappedPMs.find(pm => pm.id === mapped.id);
    const index = mappedPMs.findIndex(pm => pm.id === mapped.id);
    if (index > -1) {
      mappedPMs.splice(index, 1);
    }

    // we will attempt mapping by name for this party before declaring unmapable.
    if (ambiguous && !ambiguousTry) {
      ambiguous.push(partyMember);
      const alreadyMappedPM = allPartyMembers.find(pm => pm.id === alreadyMapped.partyMemberId);
      alreadyMappedPM && ambiguous.push(alreadyMappedPM);
    } else {
      addToUnmappedList(unmappedPMs, party, partyMember, allPartyMembers, 'Ambiguous');
    }

    return;
  }

  mappedPMs.push({
    ...mapped,
    partyMemberId: partyMember.id,
    memberType: partyMember.memberType,
    partyId: partyMember.partyId,
    fullName: partyMember.fullName,
    leaseId: party.leaseId,
    isPrimary: partyMember.isPrimary,
    propertyId: party.propertyId,
    partyType: party.stage,
    type,
  });
};

const isPrimaryResident = (resident, mappedPM) => resident.primaryExternalId === mappedPM.id;

async function main() {
  logger.trace('Mapping MRI residents');
  const propertyExternalIdParam = process.argv[2]; // if propertyExternalId does not exist we should map for all properties

  const tenantId = '8904deef-7cf9-4675-ac66-b9a64c8b86f8'; // CUSTOMEROLD tenantID
  const unmappedPMs = [];
  const allMappedPersonIds = [];

  // if a parameter is not passed then we run for all properties
  const propertiesToRunFor = propertyExternalIdParam ? [propertyExternalIdParam] : properties; // replace with actual properties
  await mapSeries(propertiesToRunFor, async propertyExternalId => {
    const mappedPMs = [];
    const allRevaPartyMembers = [];

    const allResidentsFromMRI = await retrieveData({ tenantId }, { propertyExternalId, shouldSaveEntries: false });
    logger.trace({ propertyExternalId }, 'Processing property data ...');

    await mapSeries(allResidentsFromMRI, async resident => {
      const parties = await getPartiesForUnit(tenantId, resident, propertyExternalId);

      if (parties.length >= 1) {
        await mapSeries(parties, async party => {
          const ambiguous = [];
          const partyMembers = await getPartyMembersByPartyIds({ tenantId }, [party.partyId]);
          allRevaPartyMembers.push(...partyMembers);
          const revaMembersShareEmail = searchForMultipleEmails(partyMembers, 'reva');
          const mriMembersShareEmail = searchForMultipleEmails(resident.members, 'mri');
          const revaMembersSharePhone = searchForMultiplePhones(partyMembers, 'reva');
          const mriMembersSharePhone = searchForMultiplePhones(resident.members, 'mri');

          partyMembers.forEach(partyMember => {
            let mappedByEmail;
            let mappedByPhone;

            if (!revaMembersShareEmail && !mriMembersShareEmail) {
              mappedByEmail = mapByEmail(partyMember, resident);
              if (mappedByEmail) {
                const isPrimary = isPrimaryResident(resident, mappedByEmail);
                addToMapped(mappedPMs, unmappedPMs, mappedByEmail, { ...partyMember, isPrimary }, party, 'email', partyMembers, ambiguous, false);
                return; // we successfully mapped by email so we skip the next steps.
              }
            }

            if (!revaMembersSharePhone && !mriMembersSharePhone) {
              mappedByPhone = mapByPhone(partyMember, resident);
              if (mappedByPhone) {
                const isPrimary = isPrimaryResident(resident, mappedByPhone);
                addToMapped(mappedPMs, unmappedPMs, mappedByPhone, { ...partyMember, isPrimary }, party, 'phone', partyMembers, ambiguous, false);
                return; // we successfully mapped by phone so we skip the next steps.
              }
            }

            const mappedByName = mapByName(partyMember, resident);

            if (mappedByName) {
              const isPrimary = isPrimaryResident(resident, mappedByName);
              addToMapped(mappedPMs, unmappedPMs, mappedByName, { ...partyMember, isPrimary }, party, 'name', partyMembers, ambiguous, false);
              return;
            }

            // Reva partyMember could not be mapped. - This will be reflected in the unmapped-foundRevaParties exported file.
            if (!mappedByEmail && !mappedByPhone && !mappedByName) {
              addToUnmappedList(unmappedPMs, party, partyMember, partyMembers, 'Cannot find match in MRI party');
            }
          });

          // try to map the ambiguous ones that were detected - by Name
          ambiguous.forEach(pm => {
            const mappedByName = mapByName(pm, resident);
            if (mappedByName) {
              const isPrimary = isPrimaryResident(resident, mappedByName);
              addToMapped(mappedPMs, unmappedPMs, mappedByName, { ...pm, isPrimary }, party, 'name', partyMembers, ambiguous, true);
            } else {
              addToUnmappedList(unmappedPMs, party, pm, partyMembers, 'Ambiguous');
            }
          });
        });
      }
    });

    if (allRevaPartyMembers.length === mappedPMs.length) {
      logger.trace({ propertyExternalId, noOfMapped: mappedPMs.length }, 'All party members successfully mapped for property');
    } else {
      const noOfUnmappedRevaPartyMembers = allRevaPartyMembers.length - mappedPMs.length;
      logger.error(
        { propertyExternalId, noOfUnmappedRevaPartyMembers, totalRevaPartyMembers: allRevaPartyMembers.length },
        'Not all party members for which parties were succesfully identified, were mapped for property: ',
      );
    }

    await insertMappedToExternalPartyMemberInfo({ tenantId }, mappedPMs, propertyExternalId);
    allMappedPersonIds.push(...allRevaPartyMembers.map(pm => pm.personId));
    await generateMappedMembersCsvFile(mappedPMs, propertyExternalId);

    logger.trace({ propertyExternalId }, 'Finished mapping for property');
  });

  logger.trace({ totalMapped: allMappedPersonIds.length }, 'Number of mapped personIds');
  const allUnmappedPMsInReva = await listAllUnmappedPMsFromProperty(tenantId, allMappedPersonIds, propertiesToRunFor);

  await generateUnMappedMembersCsvFileForAllProperties(unmappedPMs);
  await generateUnMappedMembersFromUnidentifiedPartiesCsvFile(allUnmappedPMsInReva);
}

async function closeConns() {
  await closePool();
  await knex.destroy();
}

if (require.main === module) {
  main()
    .then(closeConns)
    .catch(e => {
      console.log(e.message);
      console.log(e.stack);
    });
}
