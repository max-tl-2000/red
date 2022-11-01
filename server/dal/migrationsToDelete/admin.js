/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const migrationsToDelete = [
  '20170104122117_updateCloneSchema.js',
  '20170501182733_users_email_lowercase_ck.js',
  '20171115102010_updateCloneSchema.js',
  '20171121213720_clone_schema_fixes.js',
  '20171228235248_remove_reserved_phoneNumbers_from_tenant_table.js',
  '20180111173311_updateCloneSchema.js',
  '20180215175314_update_tenants_sftp_accounts.js',
  '20180223114039_sftp_add_watched_folders.js',
  '20180226133818_truncate_tables.js',
  '20180320173149_updateCloneSchema.js',
  '20180330143024_updateCloneSchema.js',
  '20180412151135_add_calendar_integration_flag_in_tenant_metadata.js',
  '20180419123510_add_partySettings_column_to_tenant_table.js',
  '20180529124450_set_tenant_password.js',
  '20180820154614_enableDuplicateDetection.js',
  '20180904143402_updateCloneSchema.js',
  '20180913161808_encrypt_tenant_settings.js',
  '20180928111222_updateCloneSchema.js',
  '20181005125031_updateCloneSchema.js',
  '20181016150729_updateCloneSchema.js',
  '20190130122812_updateCloneSchema.js',
  '20190218162334_updateCloneSchema.js',
  '20190221161621_updateCloneSchema.js',
  '20190226155013_updateCloneSchema.js',
  '20190312123510_add_is_training_column_to_tenant_table.js',
  '20190313172654_updateCloneSchema.js',
  '20190326175325_add_host_to_create_sandbox.js',
  '20190423162438_moveRecurringJobs.js',
  '20190509101808_add_cleanupPhysicalAssets_to_recurringJobs.js',
  '20190830103154_rename_analytics_schema.js',
  '20200325152631_move_CleanupAnalyticsLogTables_recurring_job.js',
  '20200702173001_addSandboxDisabledConfig.js',
  '20200716153745_disableSendGridSandbox.js',
  '20200729161145_alter_add_to_publication.js',
  '20200730212906_alter_add_to_publication.js',
  '20201110132422_updateCloneSchema_add_function_to_order.js',
  '20201203191434_tenant_metadata_replace_mergedTenant_with_previousTenantNames.js',
  '20210305121034_modify_clone_schema_last_step.js',
  '20210528151321_remove_cleanup_analytics_job.js',
];
