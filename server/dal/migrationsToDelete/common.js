/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const migrationsToDelete = [
  '20170501182200_users_email_lowercase_ck.js',
  '20190206165415_reset_token.js',
  '20190416114336_cascadeOnDeleteCommonUserResetToken.js',
  '20190513132130_add_new_source_to_master_source_list.js',
  '20200413092130_add_new_source_to_master_source_list.js',
  '20200714092130_add_new_source_to_master_source_list.js',
  '20200717121733_create_common_commsTemplate_table.js',
  '20200728230414_add_devices_table.js',
  '20200729145850_add_constraints_to_userPerson_table.js',
  '20200730082619_update_CommsTemplate_default_values.js',
  '20200812114146_create_UserPaymentMethod_table.js',
  '20200813153521_create_common_accessedProperties_table.js',
  '20200825175500_update_common_device_table_cascade_on_delete_common_user.js',
  '20200901091942_add_externalId_to_UserPaymentMethod_table.js',
  '20200925130826_add_on_delete_cascade_to_CommonUser_UserPaymentMethod.js',
  '20201002121826_add_successDate_cancelDate_to_UserPaymentMethod_table.js',
  '20201013144932_drop_successDate_and_cancelDate_from_UserPaymentMethod.js',
  '20201015150004_add_scheduled_payments_info.js',
  '20201020181044_add_tenantId_column_to_UserPaymentMethod_table.js',
  '20201030082114_add_integrationId_column_to_paymentMethod_table.js',
  '20201116102905_update_userPaymentMethod_integrationId.js',
  '20201118095744_update_UserPaymentMethod_constraint.js',
  '20201208161756_update_CommsTemplate_default_values.js',
  '20201221154502_add_reset_password_for_non_user_email_template.js',
];
