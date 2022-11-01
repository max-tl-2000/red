/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export interface IAuditEntity {
  created_at?: string | Date; // eslint-disable-line camelcase
  updated_at?: string | Date; // eslint-disable-line camelcase
}

type DbTransaction = any;

export interface IDbContext {
  tenantId: string;
  trx: DbTransaction;
  [key: string]: any;
}

export interface IDictionaryHash<TValue> {
  [key: string]: TValue;
}

export type IDataDiff = IDictionaryHash<any> | null | undefined;

export interface IConsumerResult {
  processed: boolean;
}
