/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields, MAX_LENGTH_VEHICLE_MODEL, MAX_LENGTH_VEHICLE_MAKE, MAX_LENGTH_VEHICLE_LICENSE_PLATE, MAX_LENGTH_VEHICLE_COLOR } from './utils';
import trim from '../../../../common/helpers/trim';
import { ALPHANUMERIC_PLUS_SPACE } from '../../../../common/regex';

const getVehicleMakeAndModel = vehicle => {
  let vehicleMake;
  let vehicleModel;

  const vehicleMakes = ['alfa romeo', 'am general', 'aston martin', 'avanti motors', 'land rover', 'mercedes benz', 'rolls royce'];
  const makeAndModel = vehicle.info.makeAndModel.split(' ');

  if (vehicleMakes.find(make => vehicle.info.makeAndModel.toLowerCase().includes(make))) {
    vehicleMake = makeAndModel.slice(0, 2).join(' ');
    vehicleModel = makeAndModel.slice(2).join(' ');
  } else {
    vehicleMake = makeAndModel.slice(0, 1).join(' ');
    vehicleModel = makeAndModel.slice(1).join(' ');
  }

  return {
    vehicleMake: vehicleMake.substring(0, MAX_LENGTH_VEHICLE_MAKE),
    vehicleModel: vehicleModel.substring(0, MAX_LENGTH_VEHICLE_MODEL),
  };
};

const formatVehicleLicensePlate = vehicle => {
  const licensePlateWithoutSpecialCharacteres = vehicle.info.tagNumber.replace(ALPHANUMERIC_PLUS_SPACE, '');

  return trim(licensePlateWithoutSpecialCharacteres).substring(0, MAX_LENGTH_VEHICLE_LICENSE_PLATE);
};

const fields = {
  ResidentID: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
  LicensePlate: {
    fn: ({ vehicle }) => formatVehicleLicensePlate(vehicle),
    isMandatory: true,
  },
  State: {
    fn: ({ vehicle }) => vehicle.info.state,
  },
  Color: {
    fn: ({ vehicle }) => trim(vehicle.info.color).substring(0, MAX_LENGTH_VEHICLE_COLOR),
  },
  Make: {
    fn: ({ vehicle }) => getVehicleMakeAndModel(vehicle).vehicleMake,
  },
  Model: {
    fn: ({ vehicle }) => getVehicleMakeAndModel(vehicle).vehicleModel,
  },
};

export const createVehicleInformationMapper = data => {
  const { vehicles } = data;
  if (!vehicles.length) return [];

  return vehicles.map(vehicle => mapDataToFields({ ...data, vehicle }, fields));
};
