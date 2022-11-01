/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as mobx from 'mobx';
import get from 'lodash/get';
import debounce from 'debouncy';
import isEmpty from 'lodash/isEmpty';
import {
  getConcessionValue,
  calculateRelativeAdjustment,
  updateLeaseTermsWithMatrixRents,
  getLeaseTermsWithoutRent,
  isAValidLeaseStartDateInRentMatrix,
  setDepositsRelativeAmount,
  setLeaseTermsEndDate,
  getLowestPriceStartDateFromMatrixForDatesRange,
} from '../../../common/helpers/quotes';
import { formatUnitAddress } from '../../../common/helpers/addressUtils';
import { setStatesAdditionalAndOneTimeFees, getIdsOfDefaultLeaseTerms, getMaxAmountLimit } from '../quotes';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { updateAdditionalChargesParentFee, setDefaultVariableAmount } from '../../../common/helpers/fee';
import { DALTypes } from '../../../common/enums/DALTypes';
const { extendObservable, observable, toJS, reaction } = mobx;

const updateConcessionAmount = (concession, { adjustedMarketRent, termLength }) => {
  const {
    variableAdjustment,
    relativeDefaultAdjustment,
    absoluteDefaultAdjustment,
    variableAmountUpdatedByAgent,
    absoluteAdjustment,
    floorCeilingAmount,
  } = concession;
  const relativeAdjustment = parseFloat(concession.relativeAdjustment);

  if (!variableAmountUpdatedByAgent && variableAdjustment) {
    const maxAmount = getMaxAmountLimit(adjustedMarketRent, Math.abs(concession.relativeAdjustment), Math.abs(absoluteAdjustment), floorCeilingAmount);
    concession.amountVariableAdjustment = setDefaultVariableAmount(
      {
        variableAdjustment,
        relativeDefaultPrice: relativeDefaultAdjustment,
        absoluteDefaultPrice: absoluteDefaultAdjustment,
        parentFeeAmount: adjustedMarketRent,
      },
      maxAmount,
    );
  }
  if (concession.recurring && relativeAdjustment !== 0 && !concession.adjustmentFloorCeiling) {
    concession.relativeAmount = calculateRelativeAdjustment(adjustedMarketRent, Math.abs(relativeAdjustment));
  }
  extendObservable(concession, {
    amount: getConcessionValue(concession, {
      amount: adjustedMarketRent,
      length: termLength,
    }),
  });
};

const isLeaseTermSelected = (selectedLeaseTermIds, leaseTermId) => selectedLeaseTermIds.some(selectedId => leaseTermId === selectedId);
const doesLeaseTermHaveRent = (leaseTermsWithoutRent, leaseTermId) => !leaseTermsWithoutRent.find(lt => lt.id === leaseTermId);
const isLeaseTermSelectedAndHasRent = ({ selectedLeaseTermIds, leaseTermsWithoutRent }, leaseTermId) =>
  isLeaseTermSelected(selectedLeaseTermIds, leaseTermId) && doesLeaseTermHaveRent(leaseTermsWithoutRent, leaseTermId);

const getValidLeaseTermIds = model => model.leaseTerms.filter(leaseTerm => isLeaseTermSelectedAndHasRent(model, leaseTerm.id)).map(({ id }) => id);

const getDeselectedTermIds = (model, selectedTermIds) => model.lastLeaseSelections?.selectedLeaseTermIds.filter(id => !selectedTermIds.includes(id));

const setResetOverwrittenBaseRentToTerms = (model, deselectedTermIds = []) =>
  model.leaseTerms.map(term => {
    if (deselectedTermIds.includes(term.id)) {
      return { ...term, resetOverwrittenBaseRent: true };
    }
    return { ...term, resetOverwrittenBaseRent: false };
  });

const updateConcessionAmountOfDeselectedTerms = (model, deselectedTermIds = []) =>
  model.leaseTerms.map(term => {
    if (deselectedTermIds.includes(term.id)) {
      term.concessions.map(c => updateConcessionAmount(c, term));
      return term;
    }
    return term;
  });

export const createQuoteFromRaw = (rawQuote, settings = {}) => {
  const model = observable({ ...rawQuote });
  const { propertyTimezone: timezone, leaseStartDate: originalLeaseStartDate, defaultLeaseStartDate, defaultLeaseLengths, leaseState } = rawQuote;

  const selectedTerms = get(rawQuote.selections, 'selectedLeaseTerms', []);
  const selectedTermIds = selectedTerms.map(term => term.id);
  const lDate = originalLeaseStartDate || defaultLeaseStartDate;
  const leaseStartDate = lDate ? toMoment(lDate, { timezone }) : now({ timezone }).startOf('day');
  const selectedLeaseTermIds = selectedTermIds.length ? selectedTermIds : getIdsOfDefaultLeaseTerms(rawQuote.leaseTerms, defaultLeaseLengths, leaseState);
  const hasDefaultStartDateAndSelectedLeaseTerms = !!(defaultLeaseStartDate && !originalLeaseStartDate && selectedLeaseTermIds.length);

  // a quote should not be considered pristine if it has default start date and selected lease terms
  const pristine = hasDefaultStartDateAndSelectedLeaseTerms ? false : rawQuote.pristine;
  model._lastLeaseSelections = { leaseStartDate, selectedLeaseTermIds };

  extendObservable(model, {
    isSavedDraft: !!originalLeaseStartDate,
    settings,
    propertyTimezone: timezone,
    leaseStartDate,
    defaultLeaseStartDate: toMoment(defaultLeaseStartDate, { timezone }),
    renewalDate: rawQuote.renewalDate ? toMoment(rawQuote.renewalDate, { timezone }) : null,
    pristine,
    expirationDate: rawQuote.expirationDate,
    isExpired: rawQuote.isExpired,
    confirmationNumber: rawQuote.confirmationNumber,
    additionalAndOneTimeCharges: rawQuote.additionalAndOneTimeCharges || [],
    selectedLeaseTermIds,
    selections: rawQuote.selections,
    leaseTerms: rawQuote.leaseTerms ? setLeaseTermsEndDate(rawQuote.leaseTerms, leaseStartDate, timezone) : [],
    _canSave: hasDefaultStartDateAndSelectedLeaseTerms,
    rentMatrix: rawQuote.rentMatrix,
    defaultLeaseLengths,
    _shouldShowPriceNAForSelection: false,
    validLeaseStartDateInRentMatrix: true,

    get canSave() {
      return this._canSave;
    },

    /**
     * Determines if pristine
     */
    get isPristine() {
      return this.pristine;
    },
    /**
     * Determines if the quote has selected terms and a leaseStartDate if not the quote is consider invalid
     *
     * @return     {boolean}  True if valid, False otherwise.
     */
    get isValid() {
      if (!this.isPublished) return true;

      return this.theSelectedTermsIds.length > 0 && !!this.leaseStartDate;
    },

    /**
     * Calculates the minDate for the Quote based on the leaseStartDate and the current day
     *
     * @computed getter
     * @return {Moment} the minDate for the quote
     */
    get minLeaseDate() {
      const { defaultLeaseStartDate: dlsd } = this;
      const nowDate = now({ timezone }).startOf('day');

      if (!dlsd) {
        return nowDate;
      }

      return dlsd.isBefore(nowDate) ? nowDate : dlsd;
    },

    get lastLeaseSelections() {
      if (this.leaseTermsWithoutRent.length && this.validLeaseStartDateInRentMatrix) return this._lastLeaseSelections;

      this._lastLeaseSelections = { leaseStartDate: this.leaseStartDate, selectedLeaseTermIds: this.selectedLeaseTermIds };
      return this._lastLeaseSelections;
    },

    get shouldShowPriceNAForSelection() {
      return this._shouldShowPriceNAForSelection;
    },

    get leaseTermsWithoutRent() {
      return getLeaseTermsWithoutRent(this.leaseTerms, this.selectedLeaseTermIds);
    },

    get hasLeaseStartDateAndSelectedTerms() {
      return this.leaseStartDate && !!this.selectedLeaseTermIds.length;
    },

    enableQuoteSaving: mobx.action(function enableQuoteSaving({ clearPristineFlag = true } = {}) {
      if (clearPristineFlag) {
        this.pristine = false;
      }
      this._canSave = true;
    }),

    disableQuoteSaving: mobx.action(function disableQuoteSaving() {
      this._canSave = false;
    }),

    validateLeaseSelections: mobx.action(({ validateDateRangePreference }) => {
      model.validLeaseStartDateInRentMatrix = isAValidLeaseStartDateInRentMatrix(model, {
        validateDateRangePreference,
        moveInDateRangePreference: model.settings.moveInDateRangePreference,
      });

      if (!model.validLeaseStartDateInRentMatrix) {
        model.updateLeaseStartDate(null);
        return;
      }

      const validLeaseTermIds = getValidLeaseTermIds(model);
      model.updateSelectedLeaseTerms({ ids: validLeaseTermIds });
      return;
    }),

    updateConcessionsAmount: mobx.action(leaseTerms => {
      leaseTerms.forEach(lt => lt.concessions.forEach(concession => updateConcessionAmount(concession, lt)));
    }),

    updateLeaseStartDate: mobx.action((value, isUserInput) => {
      model._shouldShowPriceNAForSelection = isUserInput;
      model.validLeaseStartDateInRentMatrix = isAValidLeaseStartDateInRentMatrix(model);
      model.enableQuoteSaving();

      model.leaseStartDate = value;

      model.leaseTerms = updateLeaseTermsWithMatrixRents(model, model.leaseTerms, model.propertyTimezone, true);

      // TODO: This should be a computed value
      model.leaseTerms = setLeaseTermsEndDate(model.leaseTerms, value, timezone);

      model.updateConcessionsAmount(model.leaseTerms);
    }),

    updateSelectedLeaseTerms: mobx.action(({ ids }, isUserInput = false) => {
      model._shouldShowPriceNAForSelection = isUserInput;
      model.validLeaseStartDateInRentMatrix = isAValidLeaseStartDateInRentMatrix(model);
      model.enableQuoteSaving();

      const deselectedTermIds = getDeselectedTermIds(model, ids);
      model.leaseTerms = setResetOverwrittenBaseRentToTerms(model, deselectedTermIds);

      model.selectedLeaseTermIds = ids;

      model.leaseTerms = updateLeaseTermsWithMatrixRents(model, model.leaseTerms, model.propertyTimezone);

      if (deselectedTermIds.length > 0) {
        updateConcessionAmountOfDeselectedTerms(model, deselectedTermIds);
      }

      if (model.additionalAndOneTimeCharges.length) {
        model.extendChargesConcessionsObservable && model.extendChargesConcessionsObservable();
        setDepositsRelativeAmount({
          additionalOneTimeFees: model.additionalAndOneTimeCharges,
          leaseTermsIds: ids,
          leaseTerms: model.leaseTerms,
        });
      }
    }),

    updateConcessionsAmountAndDepositsRelativeAmount: mobx.action(term => {
      term.concessions.forEach(concession => {
        updateConcessionAmount(concession, {
          adjustedMarketRent: term.adjustedMarketRent,
          termLength: term.termLength,
        });
      });
      setDepositsRelativeAmount({
        additionalOneTimeFees: model.additionalAndOneTimeCharges,
        leaseTermsIds: model.selectedLeaseTermIds,
        updatedLeaseTerms: [term],
      });
    }),

    resetPristineFlag: mobx.action(function resetPristineFlag() {
      this.pristine = true;
    }),

    /**
     * flag to check if the date is in the past considering days only
     *
     * @computed getter
     * @return {Boolean} true if the date is in the past, false otherwise
     */
    get isLeaseStartDateInThePast() {
      if (!this.leaseStartDate) {
        // if no date provided it can't be in the past
        return false;
      }
      return this.leaseStartDate.isBefore(now({ timezone }), 'day');
    },

    /**
     * Return the selected term ids
     *
     * @computed getter
     * @return {Array} the selected LeaseTermIds
     */
    get theSelectedTermsIds() {
      // mobx uses ObservableArrays for arrays
      // the component expect a real Array otherwise the
      // Array.isArray(this.selectedLeaseTermIds) will fail
      return toJS(this.selectedLeaseTermIds);
    },

    /**
     * Return the leaseDate as a `moment` instance
     *
     * @computed getter
     * @return {Moment} the lease start date as a moment instance
     */
    get isPublished() {
      return !!this.publishDate;
    },

    get selectedTerm() {
      return this.selectedLeaseTermIds.length && this.leaseTerms.find(term => term.id === this.selectedLeaseTermIds[0]);
    },

    get areAllFeesSelected() {
      return !this.additionalAndOneTimeCharges.find(period => period.name === this.selectedTerm.period).fees.some(fee => !fee.selected);
    },
  });

  model.leaseTerms = updateLeaseTermsWithMatrixRents(model, model.leaseTerms, model.propertyTimezone);
  if (leaseState === DALTypes.LeaseState.RENEWAL && !selectedTermIds.length) {
    const terms = model.leaseTerms.filter(lt => lt.adjustedMarketRent);
    model.updateSelectedLeaseTerms({ ids: terms.map(t => t.id) });
  }

  if (!rawQuote.publishDate) {
    model.leaseTerms.forEach(term => {
      const { adjustedMarketRent } = term;

      term.concessions.forEach(concession => {
        const {
          variableAdjustment,
          relativeDefaultAdjustment,
          absoluteDefaultAdjustment,
          relativeAdjustment,
          absoluteAdjustment,
          floorCeilingAmount,
        } = concession;

        const maxAmount = getMaxAmountLimit(adjustedMarketRent, Math.abs(relativeAdjustment), Math.abs(absoluteAdjustment), floorCeilingAmount);
        const amountVariableAdjustment = concession.amountVariableAdjustment
          ? concession.amountVariableAdjustment
          : setDefaultVariableAmount(
              {
                variableAdjustment,
                relativeDefaultPrice: relativeDefaultAdjustment,
                absoluteDefaultPrice: absoluteDefaultAdjustment,
                parentFeeAmount: adjustedMarketRent,
              },
              maxAmount,
            );

        extendObservable(concession, {
          amountVariableAdjustment,
          variableAmountUpdatedByAgent: concession.variableAmountUpdatedByAgent,
        });

        updateConcessionAmount(concession, {
          adjustedMarketRent: term.adjustedMarketRent,
          termLength: term.termLength,
        });

        let selected;
        if (concession.optional) {
          const selTerm = !isEmpty(rawQuote.selections) ? rawQuote.selections.selectedLeaseTerms.filter(s => s.id === term.id)[0] : null;
          const selConcession = selTerm ? selTerm.concessions.filter(c => c.id === concession.id)[0] : null;
          selected = !!selConcession;
          if (concession.variableAdjustment) {
            extendObservable(concession, {
              amountVariableAdjustment,
              shouldShowAmountEditor: false,
            });
          }
        } else {
          selected = true;
        }
        extendObservable(concession, {
          selected,
        });
      });
    });

    model.enableQuoteSaving({ clearPristineFlag: false });

    model.extendChargesConcessionsObservable = () => {
      model.additionalAndOneTimeCharges.forEach(feesPerPeriod => {
        feesPerPeriod.fees.forEach(f => {
          if (!f.concessions) return f;

          f.concessions.forEach(concession => {
            const parentFeeAmount = f.price;
            const { relativeAdjustment } = concession;
            if (concession.recurring && parseFloat(relativeAdjustment) !== 0) {
              concession.relativeAmount = calculateRelativeAdjustment(parentFeeAmount, Math.abs(relativeAdjustment));
            }

            const firstLeaseTerm = model.selectedLeaseTermIds.length && model.leaseTerms.find(lt => lt.id === model.selectedLeaseTermIds[0]);

            extendObservable(concession, {
              amount: getConcessionValue(concession, {
                amount: parentFeeAmount,
                length: firstLeaseTerm.termLength,
              }),
            });
          });

          return f;
        });
      });
    };

    model.additionalAndOneTimeCharges.forEach(feesPerPeriod => {
      feesPerPeriod.fees.forEach(f => {
        const isIGFee = !!f.minRent && !!f.maxRent;
        f.amount = isIGFee ? f.minRent : f.amount;

        setDefaultVariableAmount(f, f.amount);

        if (f.inventoryGroupId && !f.hasInventoryPool && !f.isAdditional) {
          extendObservable(f, {
            selectedInventories: [],
          });
        }
        extendObservable(f, {
          isMinAndMaxRentEqual: f.minRent === f.maxRent,
          isIGFee,
        });

        if (f.concessions) {
          let selected;
          f.concessions.forEach(concession => {
            const parentFeeAmount = f.price;
            const { relativeAdjustment, absoluteAdjustment, floorCeilingAmount } = concession;
            if (concession.recurring && parseFloat(relativeAdjustment) !== 0) {
              concession.relativeAmount = calculateRelativeAdjustment(parentFeeAmount, Math.abs(relativeAdjustment));
            }
            const maxAmount = getMaxAmountLimit(parentFeeAmount, Math.abs(relativeAdjustment), Math.abs(absoluteAdjustment), floorCeilingAmount);
            const amountVariableAdjustment = setDefaultVariableAmount(
              {
                variableAdjustment: concession.variableAdjustment,
                relativeDefaultPrice: concession.relativeDefaultAdjustment,
                absoluteDefaultPrice: concession.absoluteDefaultAdjustment,
                parentFeeAmount,
              },
              maxAmount,
            );

            const firstLeaseTerm = model.selectedLeaseTermIds.length && model.leaseTerms.find(lt => lt.id === model.selectedLeaseTermIds[0]);

            extendObservable(concession, {
              amount: getConcessionValue(concession, {
                amount: parentFeeAmount,
                length: firstLeaseTerm.termLength,
              }),
              amountVariableAdjustment,
            });
            if (concession.optional) {
              selected = f.selected && concession.selected;
              if (concession.variableAdjustment) {
                extendObservable(concession, {
                  amountVariableAdjustment: selected ? concession.amountVariableAdjustment : 0,
                  shouldShowAmountEditor: false,
                });
              }
            } else {
              selected = true;
            }
            extendObservable(concession, {
              selected,
            });
          });
        }
      });
    });
  }

  const additionalOneTimeFees = model.additionalAndOneTimeCharges;
  if (!model.additionalAndOneTimeCharges.additionalCharges) {
    model.additionalAndOneTimeCharges = setStatesAdditionalAndOneTimeFees(additionalOneTimeFees, rawQuote);
  }

  if (model.selectedLeaseTermIds.length > 0 && additionalOneTimeFees.length) {
    model.additionalAndOneTimeCharges = setDepositsRelativeAmount({
      additionalOneTimeFees,
      leaseTermsIds: model.selectedLeaseTermIds,
    });
  }

  !model.isPublished && model.validateLeaseSelections({ validateDateRangePreference: !model.isSavedDraft });

  /**
   * Reset the leaseStartDate
   * @return {void}
   */
  model.resetLeaseStartDate = mobx.action(() => {
    // the method is defined outside of the extendObservable
    // call, because by default mobx will make all methods that
    // don't receive params and return something a computed value
    // so defining it here fixes the issue.

    model.updateLeaseStartDate(now({ timezone }).startOf('day'));

    model.validateLeaseSelections({ validateDateRangePreference: false });
    return;
  });

  model.setDefaultVariableAmount = mobx.action(({ setAmount = true, updateOnlyRelativeFees = false } = {}) => {
    const selectedTerm = model.leaseTerms.find(term => term.id === selectedLeaseTermIds[0]);
    model.additionalAndOneTimeCharges.length &&
      model.additionalAndOneTimeCharges?.forEach(feesPerPeriod => {
        feesPerPeriod.fees.forEach(f => {
          if (updateOnlyRelativeFees && !(f.relativePrice || f.relativeDefaultPrice)) return;
          updateAdditionalChargesParentFee(f, selectedTerm);
          const isIGFee = !!f.minRent && !!f.maxRent;
          f.amount = isIGFee ? f.minRent : f.amount;
          setDefaultVariableAmount(f, f.amount, setAmount);
        });
      });
  });

  model.setLeaseStartDateFromPreferences = mobx.action(moveInDateRangePreference => {
    if (model.renewalDate) {
      const isRenewalDateInThePast = toMoment(model.renewalDate, { timezone }).isBefore(now({ timezone }));
      if (isRenewalDateInThePast) {
        model.updateLeaseStartDate(null);
        return;
      }

      model.updateLeaseStartDate(model.renewalDate);
      return;
    }

    if (isEmpty(moveInDateRangePreference)) return;

    const { startDate, termId } = getLowestPriceStartDateFromMatrixForDatesRange({ model, moveInDateRangePreference, startFromToday: true });

    const termIds = termId ? [termId] : [];
    model.updateLeaseStartDate(startDate);
    model.updateSelectedLeaseTerms({ ids: termIds });
    return;
  });

  model.overwriteBaseRent = mobx.action((termId, { originalBaseRent, overwrittenBaseRent }) => {
    model.leaseTerms = model.leaseTerms.map(lt => {
      if (lt.id !== termId) {
        return lt;
      }

      return { ...lt, originalBaseRent, overwrittenBaseRent };
    });

    return;
  });

  model.formatInventoryName = formatUnitAddress;

  const THRESHOLD_TO_DEBOUNCE_SAVE_REQUEST = 5000;

  // Autosave every 5 sec
  const doSave = debounce(() => {
    model.canSave && model.onSaveRequest && model.onSaveRequest();
  }, THRESHOLD_TO_DEBOUNCE_SAVE_REQUEST);

  const dispose = reaction(
    // I want to be execute the next function
    // whenever canSave or pristine changes
    () => ({ canSave: model.canSave, pristine: model.pristine }),
    () => {
      doSave();
    },
  );

  model.dispose = () => {
    model.onSaveRequest = null;
    dispose && dispose();
  };

  return model;
};
