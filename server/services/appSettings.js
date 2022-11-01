/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as repo from '../dal/appSettingsRepo';

export const getAppSettings = async ctx => await repo.getAppSettings(ctx);

export const getAppSettingByName = async (ctx, name) => await repo.getAppSettingByName(ctx, name);

export const getAppSettingValue = async (ctx, name) => await repo.getAppSettingValue(ctx, name);

export const saveAppSetting = async (ctx, appSetting) => await repo.saveAppSetting(ctx, appSetting);

export const updateAppSetting = async (ctx, key, newValue) => await repo.updateAppSettingValue(ctx, key, newValue);

export const updateMultipleAppSettings = async (ctx, keyValuePairs) => await repo.updateMultipleAppSettings(ctx, keyValuePairs);

export const getMultipleAppSettingsByName = async (ctx, settingNames) => await repo.getMultipleAppSettingsByKey(ctx, settingNames);
