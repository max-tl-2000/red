/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import differenceBy from 'lodash/differenceBy';
import partition from 'lodash/partition';
import getUUID from 'uuid/v4';
import { Promise } from 'bluebird';

import { DALTypes } from '../../../common/enums/DALTypes';
import * as mergeRepo from '../../dal/mergePartyRepo';
import loggerModule from '../../../common/helpers/logger';
import { removeGuaranteedByLink } from '../../dal/partyRepo';
import { isGuarantor, isResident, isOccupant } from '../../../common/helpers/party-utils';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

// external field stores Yardi data, so we need to clear them out before saving
const prepareMember = (member, basePartyId) => ({
  ...member,
  id: getUUID(),
  partyId: basePartyId,
});

const copyMembers = async (ctx, members, basePartyId) =>
  await Promise.reduce(
    members,
    async (result, member) => {
      const copiedMember = await mergeRepo.saveMember(ctx, prepareMember(member, basePartyId));
      const copiedMembers = [...result.members, { ...copiedMember, mergedPartyMember: member }];

      return {
        members: copiedMembers,
        messagesToSend: result.messagesToSend,
      };
    },
    { members: [], messagesToSend: [] },
  );

const copyPartyMembers = async (ctx, basePartyId, basePartyMembers, mergedPartyMembers) => {
  const membersToCopy = differenceBy(mergedPartyMembers, basePartyMembers, 'personId');
  const [guarantorsToCopy, nonGuarantorsToCopy] = partition(membersToCopy, isGuarantor);
  const copiedGuarantors = await copyMembers(ctx, guarantorsToCopy, basePartyId);
  const copiedNonGuarantors = await copyMembers(ctx, nonGuarantorsToCopy, basePartyId);

  return {
    copiedGuarantors,
    copiedNonGuarantors,
  };
};

const updateGuarantorId = async (ctx, memberId, guarantor) =>
  await mergeRepo.updateMember(ctx, { id: memberId, guaranteedBy: guarantor ? guarantor.id : null });

// if a person is Garuantor in the target party and Resident in the merged party,
// he will be set as Resident in the target party (as part of getCommonMembers function);
// because of the member type change, he cannot be anymore a guarantor for other members, so we need to break the existing links
const breakGuarantorLinksForBasePartyMembers = async (ctx, basePartyId) => {
  const basePartyMembers = await mergeRepo.getAllPartyMembers(ctx, basePartyId);
  const [basePartyGuarantors, basePartyNonGuarantors] = partition(basePartyMembers, isGuarantor);

  return await Promise.reduce(
    basePartyNonGuarantors,
    async (result, member) => {
      if (!member.guaranteedBy) return result;
      const guarantor = basePartyGuarantors.find(g => g.id === member.guaranteedBy);
      const updatedMember = await updateGuarantorId(ctx, member.id, guarantor);
      return [...result, updatedMember];
    },
    [],
  );
};

const updateGuarantorLinks = async ({ ctx, basePartyId, commonMembers, copiedGuarantors, copiedNonGuarantors }) => {
  const [commonGuarantors, commonNonGuarantors] = partition(commonMembers, isGuarantor);

  const copiedMembersWithUpdatedLink = await Promise.reduce(
    copiedNonGuarantors,
    async (result, member) => {
      if (!member.mergedPartyMember.guaranteedBy) return result;
      const guarantor = [...commonGuarantors, ...copiedGuarantors].find(g => g.mergedPartyMember.id === member.guaranteedBy && isGuarantor(g));
      const updatedMember = await updateGuarantorId(ctx, member.id, guarantor);
      return [...result, updatedMember];
    },
    [],
  );

  const commonMembersWithUpdatedLinks = await Promise.reduce(
    commonNonGuarantors,
    async (result, member) => {
      if (member.guaranteedBy || !member.mergedPartyMember.guaranteedBy) return result;
      const guarantor = copiedGuarantors.find(g => g.mergedPartyMember.id === member.mergedPartyMember.guaranteedBy && isGuarantor(g));
      const updatedMember = await updateGuarantorId(ctx, member.id, guarantor);
      return [...result, updatedMember];
    },
    [],
  );

  const baseMembersWithUpdatedLinks = await breakGuarantorLinksForBasePartyMembers(ctx, basePartyId);

  return {
    copiedMembersWithUpdatedLink,
    commonMembersWithUpdatedLinks,
    baseMembersWithUpdatedLinks,
  };
};

const getCommonMembers = async (ctx, basePartyMembers, mergedPartyMembers) =>
  await Promise.reduce(
    mergedPartyMembers,
    async (commonMembers, member) => {
      const baseMember = basePartyMembers.find(m => m.personId === member.personId);
      return baseMember ? [...commonMembers, { ...baseMember, mergedPartyMember: member }] : commonMembers;
    },
    [],
  );

// if a person is Resident in the merged party and Guarantor in the target party,
// the member type should be set to Resident in the target party
const updateTypeForCommonMembers = async (ctx, commonMembers) =>
  await Promise.reduce(
    commonMembers,
    async (result, member) => {
      if (isGuarantor(member) && isResident(member.mergedPartyMember)) {
        await removeGuaranteedByLink(ctx, member.partyId, member.id);
        await mergeRepo.updateMember(ctx, { id: member.id, memberType: DALTypes.MemberType.RESIDENT });
        return [...result, { ...member, memberType: DALTypes.MemberType.RESIDENT }];
      }

      if (isGuarantor(member) && isOccupant(member.mergedPartyMember)) {
        await removeGuaranteedByLink(ctx, member.partyId, member.id);
        await mergeRepo.updateMember(ctx, { id: member.id, memberType: DALTypes.MemberType.OCCUPANT });
        return [...result, { ...member, memberType: DALTypes.MemberType.OCCUPANT }];
      }

      if (isOccupant(member) && isResident(member.mergedPartyMember)) {
        await mergeRepo.updateMember(ctx, { id: member.id, memberType: DALTypes.MemberType.RESIDENT });
        return [...result, { ...member, memberType: DALTypes.MemberType.RESIDENT }];
      }
      return [...result, member];
    },
    [],
  );

export const mergePartyMembers = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergePartyMembers - params');
  const start = new Date().getTime();

  const basePartyMembers = await mergeRepo.getAllPartyMembers(ctx, basePartyId);
  const mergedPartyMembers = await mergeRepo.getAllPartyMembers(ctx, mergedPartyId);

  const commonMembers = await getCommonMembers(ctx, basePartyMembers, mergedPartyMembers);
  const updatedCommonMembers = await updateTypeForCommonMembers(ctx, commonMembers);
  const { copiedGuarantors, copiedNonGuarantors } = await copyPartyMembers(ctx, basePartyId, basePartyMembers, mergedPartyMembers);
  const copiedMembers = [...copiedGuarantors.members, ...copiedNonGuarantors.members];

  const membersWithUpdatedLinks = await updateGuarantorLinks({
    ctx,
    basePartyId,
    commonMembers: updatedCommonMembers,
    copiedGuarantors: copiedGuarantors.members,
    copiedNonGuarantors: copiedNonGuarantors.members,
  });
  const result = {
    members: [...copiedMembers.map(m => ({ ...m, copied: true })), ...updatedCommonMembers.map(m => ({ ...m, copied: false }))],
    messagesToSend: [...copiedGuarantors.messagesToSend, ...copiedNonGuarantors.messagesToSend],
    membersWithUpdatedLinks,
  };
  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergePartyMembers - duration');
  return result;
};
