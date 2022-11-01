/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { PetTypes, PetSizes, MRIPetSizes } from '../../../../common/enums/petTypes';
import trim from '../../../../common/helpers/trim';
import { mapDataToFields, MAX_LENGTH_PET_NAME } from './utils';

const getPetType = pet => {
  switch (pet.info.type) {
    case PetTypes.CAT:
      return 'C';
    case PetTypes.DOG:
      return 'D';
    case PetTypes.OTHER:
    default:
      return 'O'; // other
  }
};

const getPetSize = pet => {
  switch (pet.info.size) {
    case PetSizes.LIBS5:
      return MRIPetSizes.Tiny;
    case PetSizes.LIBS15:
      return MRIPetSizes.Small;
    case PetSizes.LIBS25:
      return MRIPetSizes.Medium;
    case PetSizes.LIBS50:
    case PetSizes.LIBS50M:
      return MRIPetSizes.Large;
    default:
      return MRIPetSizes.Medium;
  }
};

const fields = {
  ResidentID: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
  PetType: {
    fn: ({ pet }) => getPetType(pet),
  },
  PetName: {
    fn: ({ pet }) => trim(pet.info.name).substring(0, MAX_LENGTH_PET_NAME),
  },
  PetSize: {
    fn: ({ pet }) => getPetSize(pet),
  },
  ServiceAnimalForSpecialNeeds: 'N',
};

export const createPetInformationMapper = data => {
  const { pets } = data;
  if (!pets.length) return [];

  return pets.map(pet => mapDataToFields({ ...data, pet }, fields));
};
