/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import { parsePropertyCriteria } from '../../../../screening/fadv/screening-report-parser';
import { IParsedCriteriaObject, IScreeningResponse, IApplicantScreening } from '../../../../helpers/applicant-types';
import { IDbContext } from '../../../../../../common/types/base-types';
import nullish from '../../../../../../common/helpers/nullish';

abstract class ReportData {
  // For screening v2 this property is not needed due to one person is always asociated to one report
  // Screening applicantId, e.g.: 30072231
  public applicantId?: string;

  constructor(applicantId?: string) {
    this.applicantId = applicantId;
  }

  abstract get setters(): Array<string>;

  public hasFailingCode({ propertyCriteria }: IBuildReportParameters, creditCode: string): boolean | null {
    const criteriaKey = Object.keys(propertyCriteria || {}).find(key => {
      const { criteriaId, criteriaType } = propertyCriteria[key];
      return `${criteriaType}${criteriaId}` === creditCode;
    });

    if (!criteriaKey) return null;
    const { applicantResults } = propertyCriteria[criteriaKey];
    const key = this.applicantId || Object.keys(applicantResults)[0];

    const criteriaValue = (key && applicantResults[key]) || '';

    // P = Pass   F = Fail    * = UnEvaluated   N = Not applicable   -- = Unavailable
    return /(P|F)/i.test(criteriaValue) ? /(F)/i.test(criteriaValue) : null;
  }

  public hasFailingCodes(...args): boolean | null {
    if (args.every(code => code === null)) return null;

    if (args.every(code => code === null || code === false)) return false;

    return true;
  }
}

interface IBuildReportParameters {
  propertyCriteria: IParsedCriteriaObject;
  applicantScreening: IApplicantScreening;
}

export interface ICreditReport {
  // Credit score
  // TYPE: Integer
  // BackgroundReport
  creditScore: number | null;

  // No established credit
  // CR100 fail = true, CR100 pass = false, else = null
  // TYPE: Bool
  // BackgroundReport
  hasNoEstablishedCredit: boolean | null;

  // Bankruptcy found
  // CR101 fail = true, CR101 pass = false, else = null
  // TYPE: Bool
  // BackgroundReport
  hasBankruptcy: boolean | null;

  // Foreclosure found
  // CR102 fail = true, CR102 pass = false, else = null
  // TYPE: Bool
  // BackgroundReport
  hasForeclosure: boolean | null;

  // Legal items found
  // (CR104 null AND CR107 null) = null, (CR104 null OR pass) AND (CR107 null OR pass) = false, ELSE = true
  // TYPE: Bool
  // BackgroundReport
  hasLegalItems: boolean | null;

  // Tax liens found
  // CR105 fail = true, CR105 pass = false, else = null
  // TYPE: Bool
  // BackgroundReport
  hasTaxLiens: boolean | null;

  // Mortgage debt found
  // CR115 fail = true, CR115 pass = false, else = null
  // TYPE: Bool
  // BackgroundReport
  hasMortgageDebt: boolean | null;

  // Property rental debt found
  // NOTE: CANNOT be used with propertyRentalDebtMin/Max or propertyRentalDebtCountMin/Max
  // CR116 fail = true, CR116 pass = false, else = null
  // TYPE: Bool
  // BackgroundReport
  hasPropertyRentalDebt: boolean | null;

  // Utility debt
  // CR117 fail = true, CR117 pass = false, else = null
  // TYPE: Bool
  // BackgroundReport
  hasUtilityDebt: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  CUSTOMEROLD = 60 months, Maximus = 36 months.

  // Rental collections
  // (CR103 null AND CO806 null) = null, (CR103 null OR pass) AND (CO806 null OR pass) = false, ELSE = true
  // NOTE: CANNOT be used with rentalCollectionsMin/Max
  // TYPE: Bool
  // BackgroundReport
  hasRentalCollections: boolean | null;

  // ** FADV SkipWatch database **
  // These may not have equivalents in other services

  // Minimum NSF or late pays in a given period
  // SW849 fail = true, SW849 pass = false, else = null
  // TYPE: Bool
  hasNsfOrLatePayMin: boolean | null;

  // Maximum NSF or late pays in a given period
  // SW850 fail = true, SW850 pass = false, else = null
  // TYPE: Bool
  hasNsfOrLatePayMax: boolean | null;
  // IMPORTANT: Not used by CUSTOMEROLD or Maximus

  // Eviction notices in a given period
  // SW851 fail = true, SW851 pass = false, else = null
  // TYPE: Bool
  hasEvictionNotice: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 1/24, CUSTOMEROLD = 2/84

  // Lease violation in a given period
  // SW853 fail = true, SW853 pass = false, else = null
  // TYPE: Bool
  hasLeaseViolation: boolean | null;

  // ** END FADV SkipWatch database **5

  // SSN fraud analysis failed
  // (SN901 null AND SN900 null AND SN903 null AND SN904 AND SN905 AND SN906) = null, (SN901 null OR pass) AND (SN900 null OR pass) AND (SN903 null OR pass) AND (SN904 null OR pass) AND (SN905 null OR pass) AND (SN906 null OR pass) = false, ELSE = true
  // TYPE: Bool
  hasSuspiciousSsn: boolean | null;

  // member results have a required SSN response
  // BlockedStatus containts SS# REQUIRED TO ACCESS CONSUMERS FILE
  // TYPE: Bool
  hasRequiredSsnResponse: boolean | null;
  // TODO: Need to confirm these are the only indicators to look for after the SSN improvements from FADV
}

class CreditReport extends ReportData implements ICreditReport {
  // eslint-disable-next-line
  constructor(applicantId?: string) {
    super(applicantId);
  }

  public creditScore: number | null = null;

  public hasNoEstablishedCredit: boolean | null = null;

  public hasBankruptcy: boolean | null = null;

  public hasForeclosure: boolean | null = null;

  public hasLegalItems: boolean | null = null;

  public hasTaxLiens: boolean | null = null;

  public hasMortgageDebt: boolean | null = null;

  public hasPropertyRentalDebt: boolean | null = null;

  public hasUtilityDebt: boolean | null = null;

  public hasRentalCollections: boolean | null = null;

  public hasNsfOrLatePayMin: boolean | null = null;

  public hasNsfOrLatePayMax: boolean | null = null;

  public hasEvictionNotice: boolean | null = null;

  public hasLeaseViolation: boolean | null = null;

  public hasSuspiciousSsn: boolean | null = null;

  public hasRequiredSsnResponse: boolean | null = null;

  get setters(): Array<string> {
    return [
      'setCreditScore',
      'setHasNoEstablishedCredit',
      'setHasBankruptcy',
      'setHasForeclosure',
      'setHasLegalItems',
      'setHasTaxLiens',
      'setHasMortgageDebt',
      'setHasPropertyRentalDebt',
      'setHasUtilityDebt',
      'setHasRentalCollections',
      'setHasNsfOrLatePayMin',
      'setHasNsfOrLatePayMax',
      'setHasEvictionNotice',
      'setHasLeaseViolation',
      'setHasSuspiciousSsn',
      'setHasRequiredSsnResponse',
    ];
  }

  public setCreditScore({ applicantScreening }: IBuildReportParameters) {
    const applicants = get(applicantScreening, 'CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].RentToIncomes[0].Applicant', []);
    const applicant = this.applicantId ? applicants.find(({ ApplicantID: { 0: id } }) => id === this.applicantId) : applicants[0];
    const [score] = (applicant || {}).CreditScore || [null];
    this.creditScore = nullish(score) ? null : parseInt(score, 10);
  }

  public setHasNoEstablishedCredit(reportParaneters: IBuildReportParameters) {
    this.hasNoEstablishedCredit = super.hasFailingCode(reportParaneters, 'CR100');
  }

  public setHasBankruptcy(reportParaneters: IBuildReportParameters) {
    this.hasBankruptcy = super.hasFailingCode(reportParaneters, 'CR101');
  }

  public setHasForeclosure(reportParaneters: IBuildReportParameters) {
    this.hasForeclosure = super.hasFailingCode(reportParaneters, 'CR102');
  }

  public setHasLegalItems(reportParaneters: IBuildReportParameters) {
    const CR104 = super.hasFailingCode(reportParaneters, 'CR104');
    const CR107 = super.hasFailingCode(reportParaneters, 'CR107');
    this.hasLegalItems = super.hasFailingCodes(CR104, CR107);
  }

  public setHasTaxLiens(reportParaneters: IBuildReportParameters) {
    this.hasTaxLiens = super.hasFailingCode(reportParaneters, 'CR105');
  }

  public setHasMortgageDebt(reportParaneters: IBuildReportParameters) {
    this.hasMortgageDebt = super.hasFailingCode(reportParaneters, 'CR115');
  }

  public setHasPropertyRentalDebt(reportParaneters: IBuildReportParameters) {
    this.hasPropertyRentalDebt = super.hasFailingCode(reportParaneters, 'CR116');
  }

  public setHasUtilityDebt(reportParaneters: IBuildReportParameters) {
    this.hasUtilityDebt = super.hasFailingCode(reportParaneters, 'CR117');
  }

  public setHasRentalCollections(reportParaneters: IBuildReportParameters) {
    const CR103 = super.hasFailingCode(reportParaneters, 'CR103');
    const CO806 = super.hasFailingCode(reportParaneters, 'CO806');
    this.hasRentalCollections = super.hasFailingCodes(CR103, CO806);
  }

  public setHasNsfOrLatePayMin(reportParaneters: IBuildReportParameters) {
    this.hasNsfOrLatePayMin = super.hasFailingCode(reportParaneters, 'SW849');
  }

  public setHasNsfOrLatePayMax(reportParaneters: IBuildReportParameters) {
    this.hasNsfOrLatePayMax = super.hasFailingCode(reportParaneters, 'SW850');
  }

  public setHasEvictionNotice(reportParaneters: IBuildReportParameters) {
    this.hasEvictionNotice = super.hasFailingCode(reportParaneters, 'SW851');
  }

  public setHasLeaseViolation(reportParaneters: IBuildReportParameters) {
    this.hasLeaseViolation = super.hasFailingCode(reportParaneters, 'SW853');
  }

  public setHasSuspiciousSsn(reportParaneters: IBuildReportParameters) {
    const SN900 = super.hasFailingCode(reportParaneters, 'SN900');
    const SN901 = super.hasFailingCode(reportParaneters, 'SN901');
    const SN903 = super.hasFailingCode(reportParaneters, 'SN903');
    const SN904 = super.hasFailingCode(reportParaneters, 'SN904');
    const SN905 = super.hasFailingCode(reportParaneters, 'SN905');
    const SN906 = super.hasFailingCode(reportParaneters, 'SN906');
    this.hasSuspiciousSsn = super.hasFailingCodes(SN900, SN901, SN903, SN904, SN905, SN906);
  }

  public setHasRequiredSsnResponse({ applicantScreening }: IBuildReportParameters) {
    const {
      Response: { 0: response },
    } = applicantScreening;
    const blockedStatus = (response.BlockedStatus && response.BlockedStatus[0]) || '';
    if (!blockedStatus) {
      this.hasRequiredSsnResponse = null;
      return;
    }

    const matchRequiredSsnResponse = new RegExp(/^.*SS# REQUIRED TO ACCESS CONSUMERS FILE.*$/, 'im').test(blockedStatus);
    let matchApplicant = true;
    if (this.applicantId && matchRequiredSsnResponse) {
      matchApplicant = new RegExp(`^.*applicant\\s+\\(${this.applicantId}\\).*$`, 'im').test(blockedStatus);
    }
    this.hasRequiredSsnResponse = matchRequiredSsnResponse && matchApplicant;
  }
}

export interface ICriminalReport {
  // Drugs - Felony
  // CM321 fail = true, CM321 pass = false, else = null
  // TYPE: Bool
  hasDrugsFelony: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 70, CUSTOMEROLD = 25

  // Drugs - Misdemeanor
  // CM322 fail = true, CM322 pass = false, else = null
  // TYPE: Bool
  hasDrugsMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 6, CUSTOMEROLD = 2

  // DUI - Felony
  // CM323 fail = true, CM323 pass = false, else = null
  // TYPE: Bool
  hasDuiFelony: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 35, CUSTOMEROLD = 25

  // DUI - Misdameanor
  // CM324 fail = true, CM324 pass = false, else = null
  // TYPE: Bool
  hasDuiMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = NOT_APPLICABLE, CUSTOMEROLD = 5

  // Unclassified - Felony
  // CM325 fail = true, CM325 pass = false, else = null
  // TYPE: Bool
  hasUnclassifiedFelony: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 69, CUSTOMEROLD = 25

  // Unclassified - Misdameanor
  // CM326 fail = true, CM326 pass = false, else = null
  // TYPE: Bool
  hasUnclassifiedMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 3, CUSTOMEROLD = 5

  // Property - Felony
  // CM327 fail = true, CM327 pass = false, else = null
  // TYPE: Bool
  hasPropertyFelony: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 6, CUSTOMEROLD = 25

  // Property - Misdameanor
  // CM328 fail = true, CM328 pass = false, else = null
  // TYPE: Bool
  hasPropertyMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 6, CUSTOMEROLD = 5

  // Sex - Felony
  // CM329 fail = true, CM329 pass = false, else = null
  // TYPE: Bool
  hasSexFelony: boolean | null;

  // Sex - Misdameanor
  // CM330 fail = true, CM330 pass = false, else = null
  // TYPE: Bool
  hasSexMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 8, CUSTOMEROLD = 25

  // Theft - Felony
  // CM331 fail = true, CM331 pass = false, else = null
  // TYPE: Bool
  hasTheftFelony: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 69, CUSTOMEROLD = 25

  // Theft - Misdameanor
  // CM332 fail = true, CM332 pass = false, else = null
  // TYPE: Bool
  hasTheftMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 3, CUSTOMEROLD = 5

  // Theft by Check - Felony
  // CM333 fail = true, CM333 pass = false, else = null
  // TYPE: Bool
  hasTheftByCheckFelony: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 2, CUSTOMEROLD = 25

  // Theft by Check - Misdameanor
  // CM334 fail = true, CM334 pass = false, else = null
  // TYPE: Bool
  hasTheftByCheckMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 2, CUSTOMEROLD = 5

  // Traffic - Felony
  // CM335 fail = true, CM335 pass = false, else = null
  // TYPE: Bool
  hasTrafficFelony: boolean | null;

  // Traffic - Misdameanor
  // CM336 fail = true, CM336 pass = false, else = null
  // TYPE: Bool
  hasTrafficMisdemeanor: boolean | null;

  // Violent Crime - Felony
  // CM337 fail = true, CM337 pass = false, else = null
  // TYPE: Bool
  hasViolentCrimeFelony: boolean | null;

  // Violent Crime - Misdameanor
  // CM338 fail = true, CM338 pass = false, else = null
  // TYPE: Bool
  hasViolentCrimeMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 8, CUSTOMEROLD = 5

  // Weapons - Felony
  // CM339 fail = true, CM339 pass = false, else = null
  // TYPE: Bool
  hasWeaponsFelony: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 69, CUSTOMEROLD = 25

  // Weapons - Misdameanor
  // CM340 fail = true, CM340 pass = false, else = null
  // TYPE: Bool
  hasWeaponsMisdemeanor: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 6, CUSTOMEROLD = 5

  // Registered Sex Offender Match
  // SX500 fail = true, SX500 pass = false, else = null
  // TYPE: Bool
  hasRegisteredSexOffender: boolean | null;

  // Registered Sex Offender Match against name + DOB only
  // SX501 fail = true, SX501 pass = false, else = null
  // TYPE: Bool
  hasRegisteredSexOffenderDobOnly: boolean | null;
  // IMPORTANT: Used by Maximus only, which doesn't make sense with SX500 also enabled

  // Global sanctions exact matches only
  // CM305 fail = true, CM305 pass = false, else = null
  // TYPE: Bool
  hasGlobalSanctions: boolean | null;
  // IMPORTANT: Used by CUSTOMEROLD only

  // Global sanctions exact or fuzzy matches
  // CM306 fail = true, CM306 pass = false, else = null
  // TYPE: Bool
  hasGlobalSanctionsFuzzy: boolean | null;
  // IMPORTANT: Used by Maximus only

  // Eviction records
  // Minimum eviction records in given period accepted
  // EV700 fail = true, EV700 pass = false, else = null
  // TYPE: Bool
  hasEvictionRecordsMin: boolean | null;
  // IMPORTANT: Not used by Maximus or CUSTOMEROLD

  // Maximum eviction records in a given period accepted
  // EV701 fail = true, EV701 pass = false, else = null
  hasEvictionRecordsMax: boolean | null;

  // Minimum eviction filings in given period accepted
  // NOTE: FADV config should always define EV702 and SW852 using the same count/period
  // (EV702 null AND SW852 null) = null, (EV702 null OR pass) AND (SW852 null OR pass) = false, ELSE = true
  // TYPE: Bool
  hasEvictionFilingsMin: boolean | null;
  // IMPORTANT: Current setup between Maximus and CUSTOMEROLD differs.  Maximus = 3/24, CUSTOMEROLD = 1/84
  // IMPORTANT: Maximus setup differs for EV702 and SW852, which is illogical

  // Maximum eviction filings in given period accepted
  // EV703 fail = true, EV703 pass = false, else = null
  // TYPE: Bool
  hasEvictionFilingsMax: boolean | null;
}

class CriminalReport extends ReportData implements ICriminalReport {
  // eslint-disable-next-line
  constructor(applicantId?: string) {
    super(applicantId);
  }

  public hasDrugsFelony: boolean | null = null;

  public hasDrugsMisdemeanor: boolean | null = null;

  public hasDuiFelony: boolean | null = null;

  public hasDuiMisdemeanor: boolean | null = null;

  public hasUnclassifiedFelony: boolean | null = null;

  public hasUnclassifiedMisdemeanor: boolean | null = null;

  public hasPropertyFelony: boolean | null = null;

  public hasPropertyMisdemeanor: boolean | null = null;

  public hasSexFelony: boolean | null = null;

  public hasSexMisdemeanor: boolean | null = null;

  public hasTheftFelony: boolean | null = null;

  public hasTheftMisdemeanor: boolean | null = null;

  public hasTheftByCheckFelony: boolean | null = null;

  public hasTheftByCheckMisdemeanor: boolean | null = null;

  public hasTrafficFelony: boolean | null = null;

  public hasTrafficMisdemeanor: boolean | null = null;

  public hasViolentCrimeFelony: boolean | null = null;

  public hasViolentCrimeMisdemeanor: boolean | null = null;

  public hasWeaponsFelony: boolean | null = null;

  public hasWeaponsMisdemeanor: boolean | null = null;

  public hasRegisteredSexOffender: boolean | null = null;

  public hasRegisteredSexOffenderDobOnly: boolean | null = null;

  public hasGlobalSanctions: boolean | null = null;

  public hasGlobalSanctionsFuzzy: boolean | null = null;

  public hasEvictionRecordsMin: boolean | null = null;

  public hasEvictionRecordsMax: boolean | null = null;

  public hasEvictionFilingsMin: boolean | null = null;

  public hasEvictionFilingsMax: boolean | null = null;

  get setters(): Array<string> {
    return [
      'setHasDrugsFelony',
      'setHasDrugsMisdemeanor',
      'setHasDuiFelony',
      'setHasDuiMisdemeanor',
      'setHasUnclassifiedFelony',
      'setHasUnclassifiedMisdemeanor',
      'setHasPropertyFelony',
      'setHasPropertyMisdemeanor',
      'setHasSexFelony',
      'setHasSexMisdemeanor',
      'setHasTheftFelony',
      'setHasTheftMisdemeanor',
      'setHasTheftByCheckFelony',
      'setHasTheftByCheckMisdemeanor',
      'setHasTrafficFelony',
      'setHasTrafficMisdemeanor',
      'setHasViolentCrimeFelony',
      'setHasViolentCrimeMisdemeanor',
      'setHasWeaponsFelony',
      'setHasWeaponsMisdemeanor',
      'setHasRegisteredSexOffender',
      'setHasRegisteredSexOffenderDobOnly',
      'setHasGlobalSanctions',
      'setHasGlobalSanctionsFuzzy',
      'setHasEvictionRecordsMin',
      'setHasEvictionRecordsMax',
      'setHasEvictionFilingsMin',
      'setHasEvictionFilingsMax',
    ];
  }

  public setHasDrugsFelony(reportParaneters: IBuildReportParameters) {
    this.hasDrugsFelony = super.hasFailingCode(reportParaneters, 'CM321');
  }

  public setHasDrugsMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasDrugsMisdemeanor = super.hasFailingCode(reportParaneters, 'CM322');
  }

  public setHasDuiFelony(reportParaneters: IBuildReportParameters) {
    this.hasDuiFelony = super.hasFailingCode(reportParaneters, 'CM323');
  }

  public setHasDuiMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasDuiMisdemeanor = super.hasFailingCode(reportParaneters, 'CM324');
  }

  public setHasUnclassifiedFelony(reportParaneters: IBuildReportParameters) {
    this.hasUnclassifiedFelony = super.hasFailingCode(reportParaneters, 'CM325');
  }

  public setHasUnclassifiedMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasUnclassifiedMisdemeanor = super.hasFailingCode(reportParaneters, 'CM326');
  }

  public setHasPropertyFelony(reportParaneters: IBuildReportParameters) {
    this.hasPropertyFelony = super.hasFailingCode(reportParaneters, 'CM327');
  }

  public setHasPropertyMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasPropertyMisdemeanor = super.hasFailingCode(reportParaneters, 'CM328');
  }

  public setHasSexFelony(reportParaneters: IBuildReportParameters) {
    this.hasSexFelony = super.hasFailingCode(reportParaneters, 'CM329');
  }

  public setHasSexMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasSexMisdemeanor = super.hasFailingCode(reportParaneters, 'CM330');
  }

  public setHasTheftFelony(reportParaneters: IBuildReportParameters) {
    this.hasTheftFelony = super.hasFailingCode(reportParaneters, 'CM331');
  }

  public setHasTheftMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasTheftMisdemeanor = super.hasFailingCode(reportParaneters, 'CM332');
  }

  public setHasTheftByCheckFelony(reportParaneters: IBuildReportParameters) {
    this.hasTheftByCheckFelony = super.hasFailingCode(reportParaneters, 'CM333');
  }

  public setHasTheftByCheckMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasTheftByCheckMisdemeanor = super.hasFailingCode(reportParaneters, 'CM334');
  }

  public setHasTrafficFelony(reportParaneters: IBuildReportParameters) {
    this.hasTrafficFelony = super.hasFailingCode(reportParaneters, 'CM335');
  }

  public setHasTrafficMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasTrafficMisdemeanor = super.hasFailingCode(reportParaneters, 'CM336');
  }

  public setHasViolentCrimeFelony(reportParaneters: IBuildReportParameters) {
    this.hasViolentCrimeFelony = super.hasFailingCode(reportParaneters, 'CM337');
  }

  public setHasViolentCrimeMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasViolentCrimeMisdemeanor = super.hasFailingCode(reportParaneters, 'CM338');
  }

  public setHasWeaponsFelony(reportParaneters: IBuildReportParameters) {
    this.hasWeaponsFelony = super.hasFailingCode(reportParaneters, 'CM339');
  }

  public setHasWeaponsMisdemeanor(reportParaneters: IBuildReportParameters) {
    this.hasWeaponsMisdemeanor = super.hasFailingCode(reportParaneters, 'CM340');
  }

  public setHasRegisteredSexOffender(reportParaneters: IBuildReportParameters) {
    this.hasRegisteredSexOffender = super.hasFailingCode(reportParaneters, 'SX500');
  }

  public setHasRegisteredSexOffenderDobOnly(reportParaneters: IBuildReportParameters) {
    this.hasRegisteredSexOffenderDobOnly = super.hasFailingCode(reportParaneters, 'SX501');
  }

  public setHasGlobalSanctions(reportParaneters: IBuildReportParameters) {
    this.hasGlobalSanctions = super.hasFailingCode(reportParaneters, 'CM305');
  }

  public setHasGlobalSanctionsFuzzy(reportParaneters: IBuildReportParameters) {
    this.hasGlobalSanctionsFuzzy = super.hasFailingCode(reportParaneters, 'CM306');
  }

  public setHasEvictionRecordsMin(reportParaneters: IBuildReportParameters) {
    this.hasEvictionRecordsMin = super.hasFailingCode(reportParaneters, 'EV700');
  }

  public setHasEvictionRecordsMax(reportParaneters: IBuildReportParameters) {
    this.hasEvictionRecordsMax = super.hasFailingCode(reportParaneters, 'EV701');
  }

  public setHasEvictionFilingsMin(reportParaneters: IBuildReportParameters) {
    const EV702 = super.hasFailingCode(reportParaneters, 'EV702');
    const SW852 = super.hasFailingCode(reportParaneters, 'SW852');

    this.hasEvictionFilingsMin = super.hasFailingCodes(EV702, SW852);
  }

  public setHasEvictionFilingsMax(reportParaneters: IBuildReportParameters) {
    this.hasEvictionFilingsMax = super.hasFailingCode(reportParaneters, 'EV703');
  }
}

export class ReportDataBuilder {
  private propertyCriteria: IParsedCriteriaObject | null = null;

  private applicantScreening: IApplicantScreening | null = null;

  private ctx: IDbContext;

  private logger;

  constructor(ctx: IDbContext, fadvResponse: IScreeningResponse, logger: any) {
    this.logger = logger;
    this.ctx = ctx;

    if (fadvResponse == null) {
      this.logError({ ctx }, 'fadvResponse most be provided');
      throw new Error('fadvResponse not defined');
    }
    this.initReportDataBuilder(fadvResponse);
  }

  private logError = (...args) => {
    if (!this.logger) return;
    this.logger.error(...args);
  };

  private logDebug = (...args) => {
    if (!this.logger) return;
    this.logger.debug(...args);
  };

  private initReportDataBuilder(fadvResponse: IScreeningResponse) {
    this.applicantScreening = fadvResponse.ApplicantScreening!;
    const criteria = get(this.applicantScreening, 'CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].PropertyCriteria[0].Criteria');
    this.propertyCriteria = criteria && parsePropertyCriteria(criteria);
  }

  private mapReportData<T extends ReportData>(Type: new (applicantId?: string) => T, applicantId?: string): T {
    const type = new Type(applicantId);
    return type.setters.reduce((acc, key) => {
      acc[key]({
        propertyCriteria: this.propertyCriteria,
        applicantScreening: this.applicantScreening,
      } as IBuildReportParameters);
      return acc;
    }, type);
  }

  public buildCreditReport(applicantId?: string): CreditReport {
    this.logDebug({ ctx: this.ctx, applicantId }, 'buildCreditReport started');

    if (!this.applicantScreening) return new CreditReport(applicantId);

    const { applicantId: id, ...creditReport } = this.mapReportData<CreditReport>(CreditReport, applicantId);

    this.logDebug({ ctx: this.ctx }, 'buildCreditReport finished');
    return creditReport as CreditReport;
  }

  public buildCriminalReport(applicantId?: string): CriminalReport {
    this.logDebug({ ctx: this.ctx, applicantId }, 'buildCriminalReport started');

    if (!this.applicantScreening) return new CriminalReport(applicantId);

    const { applicantId: id, ...criminalReport } = this.mapReportData<CriminalReport>(CriminalReport, applicantId);

    this.logDebug({ ctx: this.ctx }, 'buildCriminalReport finished');
    return criminalReport as CriminalReport;
  }
}
