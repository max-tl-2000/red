/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createQuoteFromRaw } from 'helpers/models/quote';
import orderBy from 'lodash/orderBy';
import { updateInventoryHolds } from 'helpers/inventory';
import { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } from './dataStore';
import { now } from '../../../common/helpers/moment-utils';

const GET_QUOTE_MODEL = 'GET_QUOTE_MODEL';
const CLEAR_QUOTE_MODEL = 'CLEAR_QUOTE_MODEL';
const CLEAR_QUOTE_LIST = 'CLEAR_QUOTE_LIST';
const CLEAR_INVENTORY_WITH_UNAVAILABLE_PRICES = 'CLEAR_INVENTORY_WITH_UNAVAILABLE_PRICES';

const FETCH_QUOTES_REQUEST = 'fetch_quotes_request';
const FETCH_QUOTES_SUCCESS = 'fetch_quotes_success';
const FETCH_QUOTES_FAILURE = 'fetch_quotes_failure';
const FETCH_QUOTES_SILENT_REQUEST = 'quotes/fetch_quotes_silent_request';
const FETCH_QUOTES_SILENT_SUCCESS = 'quotes/fetch_quotes_silent_success';
const FETCH_QUOTES_SILENT_FAILURE = 'quotes/fetch_quotes_silent_failure';
const UPDATE_QUOTES_ON_INVENTORY_HOLD = 'update_quotes_on_inventory_hold';
const UPDATE_QUOTES_ON_INVENTORY_UPDATED = 'update_quotes_on_inventory_updated';

const CREATE_QUOTE_DRAFT_REQUEST = 'create_quote_draft_request';
const CREATE_QUOTE_DRAFT_SUCCESS = 'create_quote_draft_success';
const CREATE_QUOTE_DRAFT_FAILURE = 'create_quote_draft_failure';

const FETCH_QUOTE_REQUEST = 'fetch_quote_request';
const FETCH_QUOTE_SUCCESS = 'fetch_quote_success';
const FETCH_QUOTE_FAILURE = 'fetch_quote_failure';

const PUBLISH_QUOTE_REQUEST = 'publish_quote_request';
const PUBLISH_QUOTE_SUCCESS = 'publish_quote_success';
const PUBLISH_QUOTE_FAILURE = 'publish_quote_failure';

const DELETE_QUOTE_REQUEST = 'delete-quotes-request';
const DELETE_QUOTE_SUCCESS = 'delete-quotes-success';
const DELETE_QUOTE_FAILURE = 'delete-quotes-failure';

const UPDATE_QUOTE_REQUEST = 'update-quotes-request';
const UPDATE_QUOTE_SUCCESS = 'update-quotes-success';
const UPDATE_QUOTE_FAILURE = 'update-quotes-failure';

const SEND_QUOTE_EMAIL_REQUEST = 'send-quote-email-request';
const SEND_QUOTE_EMAIL_SUCCESS = 'send-quote-email-succes';

const SCREEN_RESULTS_REQUEST = 'screen-results-request';
export const SCREEN_RESULTS_SUCCESS = 'screen-results-success';
const SCREEN_RESULTS_FAILURE = 'screen-results-failure';

const DEMOTE_APPLICATION_REQUEST = 'demote-application-request';
const DEMOTE_APPLICATION_SUCCESS = 'demote-application-success';
const DEMOTE_APPLICATION_FAILURE = 'demote-application-failure';

const FETCH_QUOTE_TEMPLATE_REQUEST = 'fetch-quote-template-request';
const FETCH_QUOTE_TEMPLATE_SUCCESS = 'fetch-quote-template-success';
const FETCH_QUOTE_TEMPLATE_FAILURE = 'fetch-quote-template-failure';

const UPDATE_QUOTE_PROMOTION_FAIL = 'quotes/update-quote-promotion-fail';
const PROMOTE_QUOTE_FAIL = 'quotes/promote-quote-promotion-fail';
const CLOSE_NO_LEASE_TEMPLATES_WARNING = 'quotes/close-no-lease-templates-warning';
const QUOTE_DIALOG_OPEN_STATE = 'quotes/quote_dialog_open_state';

const PRINT_QUOTE_REQUEST = 'print-quote-request';
const PRINT_QUOTE_SUCCESS = 'print-quote-success';
const PRINT_QUOTE_FAILURE = 'print-quote-failure';

const CLOSE_DUPLICATE_WARNING = 'quotes-close-duplicate-warning';

const initialState = {
  loading: false,
  // top bar spinner
  // TODO "loading" is not enough?
  savingChanges: false,
  inventoryWithUnavailablePrices: false,
  duplicateWarningOpen: false,
  quotes: [],
  publishingQuote: false,
  quote: null,
  existingQuoteId: null,
  quoteFetchFailed: false,
  isLeaseTemplateMissingWarning: false,
  isDemoting: false,
  isQuoteDialogOpen: false,
};

// returns a quote like object with extended attrs like inventory and property
// similar to a single entry of quotes.
const buildAugmentedQuote = (quote, inventory) => {
  const {
    id,
    leaseTerms,
    marketRent,
    publishDate,
    expirationDate,
    leaseStartDate,
    additionalAndOneTimeCharges,
    selections,
    allowBaseRentAdjustment,
    defaultLeaseStartDate,
    defaultLeaseLengths,
    rentMatrix,
    renewalDate,
    propertyTimezone,
    leaseState,
  } = quote;

  const { name, buildingShorthand, buildingName, propertyName, propertyDisplayName, fullQualifiedName } = inventory;

  return {
    id,
    leaseTerms,
    defaultLeaseStartDate,
    defaultLeaseLengths,
    marketRent,
    publishDate,
    expirationDate,
    leaseStartDate,
    additionalAndOneTimeCharges,
    selections,
    allowBaseRentAdjustment,
    rentMatrix,
    renewalDate,
    leaseState,
    pristine: true,
    propertyTimezone,
    inventory: {
      id: inventory.id,
      name,
      fullQualifiedName,
      building: {
        name: buildingShorthand,
        displayName: buildingName,
      },
      property: {
        id: inventory.propertyId,
        name: propertyName,
        displayName: propertyDisplayName,
      },
    },
  };
};

const updateQuotesInventoriesOnHoldAction = (quotes, { inventoryOnHold, hold }) => {
  if (!inventoryOnHold) return quotes;
  return quotes.map(quote => {
    const { inventory } = quote;
    if (inventoryOnHold.inventoryId !== inventory.id) return quote;

    const currentInventoryHolds = quote.inventory.inventoryHolds || [];
    const inventoryHolds = updateInventoryHolds(currentInventoryHolds, inventoryOnHold, hold);

    return { ...quote, inventory: { ...inventory, inventoryHolds } };
  });
};

const updateQuotesInventoriesOnStateChangedAction = (quotes, { inventoryId, state }) => {
  if (!state || !inventoryId) return quotes;
  return quotes.map(quote => {
    const { inventory } = quote;
    if (inventoryId !== inventory.id) return quote;

    return { ...quote, inventory: { ...inventory, state } };
  });
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case CLOSE_DUPLICATE_WARNING:
      return {
        ...state,
        duplicateWarningOpen: false,
      };
    case CREATE_QUOTE_DRAFT_REQUEST:
      return {
        ...state,
        quote: null,
        existingQuoteId: null,
      };
    case CREATE_QUOTE_DRAFT_FAILURE: {
      const { data, token } = action.error;
      const existingQuoteId = (token === 'MULTIPLE_QUOTE_DRAFT_NOT_ALLOWED' && data?.quoteId) || null;
      const inventoryWithUnavailablePrices = token === 'INVENTORY_WITH_UNAVAILABLE_PRICES';
      return {
        ...state,
        quote: null,
        duplicateWarningOpen: !!existingQuoteId,
        inventoryWithUnavailablePrices,
        existingQuoteId,
      };
    }
    case CREATE_QUOTE_DRAFT_SUCCESS: {
      // prepare the quote to be added to the list of quotes
      const quote = buildAugmentedQuote(action.result, action.inventory);
      let { quotes } = state;

      const index = quotes.findIndex(q => q.id === quote.id);

      if (index < 0) {
        quotes = [quote, ...quotes.slice()];
      } else {
        quotes[index] = quote;
      }

      return {
        ...state,
        quotes,
        existingQuoteId: null,
        inventoryWithUnavailablePrices: false,
        quote,
      };
    }
    case FETCH_QUOTE_REQUEST:
      return {
        ...state,
        quote: null,
      };
    case FETCH_QUOTE_SUCCESS:
      return {
        ...state,
        existingQuoteId: null,
        quote: action.result,
      };
    case FETCH_QUOTE_FAILURE:
      return {
        ...state,
        quote: null,
        quoteFetchFailed: action.error.status !== 200,
        isRecentlyPublished: false,
      };
    case GET_QUOTE_MODEL: {
      const quote = state.quote;

      // TODO: move this to a selector as it is derived data
      const model = createQuoteFromRaw(quote, action.settings);

      return {
        ...state,
        model,
      };
    }
    case FETCH_QUOTES_REQUEST:
      return {
        ...state,
        loading: true,
        quotes: [],
      };
    case FETCH_QUOTES_SUCCESS:
      return {
        ...state,
        loading: false,
        quotes: action.result.data,
        existingQuoteId: null,
      };
    case FETCH_QUOTES_FAILURE:
      return {
        ...state,
        quotes: [],
        loading: false,
      };
    case FETCH_QUOTES_SILENT_REQUEST:
    case FETCH_QUOTES_SILENT_FAILURE:
      return state;
    case FETCH_QUOTES_SILENT_SUCCESS:
      return {
        ...state,
        quotes: action.result.data,
      };
    case UPDATE_QUOTES_ON_INVENTORY_HOLD:
      return {
        ...state,
        quotes: updateQuotesInventoriesOnHoldAction(state.quotes, action.result),
      };
    case UPDATE_QUOTES_ON_INVENTORY_UPDATED:
      return {
        ...state,
        quotes: updateQuotesInventoriesOnStateChangedAction(state.quotes, action.result),
      };
    case PUBLISH_QUOTE_REQUEST:
      return {
        ...state,
        publishingQuote: true,
      };
    case PUBLISH_QUOTE_FAILURE:
      return {
        ...state,
        publishingQuote: false,
      };
    case PUBLISH_QUOTE_SUCCESS: {
      const quote = action.result;
      let quotes = [...state.quotes];
      // update the quotes array, this will rerender the quotes table
      // aka summary
      const aQuote = quotes.find(q => q.id === quote.id);

      aQuote.publishDate = quote.publishDate;
      aQuote.expirationDate = quote.expirationDate;
      aQuote.leaseStartDate = quote.leaseStartDate;
      aQuote.leaseTerms = action.result.leaseTerms;
      aQuote.selections = action.result.selections;

      if (state.model) {
        state.model.publishDate = quote.publishDate;
        state.model.expirationDate = quote.expirationDate;
      }
      quotes = orderBy(quotes, ['publishDate', 'created_at'], ['desc', 'desc']);

      return {
        ...state,
        quote,
        quotes,
        publishingQuote: false,
      };
    }
    case CLEAR_QUOTE_MODEL:
      return {
        ...state,
        model: null,
        deletingQuote: false,
        savingChanges: false,
      };
    case DELETE_QUOTE_REQUEST:
      return {
        ...state,
        deletingQuote: true,
      };
    case DELETE_QUOTE_FAILURE:
      return {
        ...state,
        deletingQuote: false,
      };
    case DELETE_QUOTE_SUCCESS:
      return {
        ...state,
        deletingQuote: false,
        model: null,
        quotes: state.quotes.filter(quote => quote.id !== action.deletedQuoteId),
      };
    case UPDATE_QUOTE_REQUEST:
      return {
        ...state,
        quotes: state.quotes.map(quote => {
          if (quote.id === state.quote.id) {
            quote.selections = action.data.selections;
            quote.leaseStartDate = action.data.leaseStartDate;
          }
          return quote;
        }),
        savingChanges: true,
      };
    case UPDATE_QUOTE_SUCCESS:
      return {
        ...state,
        quotes: state.quotes.map(quote => {
          if (quote.id === action.result.id) {
            quote.leaseTerms = action.result.leaseTerms;
            quote.selections = action.result.selections;
          }
          return quote;
        }),
        quote: action.result,
        savingChanges: null,
      };
    case UPDATE_QUOTE_FAILURE:
      return {
        ...state,
        savingChanges: true,
      };
    case SEND_QUOTE_EMAIL_REQUEST:
      return {
        ...state,
        emailing: true,
        emailError: null,
        emailSuccess: null,
      };
    case SEND_QUOTE_EMAIL_SUCCESS:
      return {
        ...state,
        emailing: false,
        emailSuccess: 'QUOTE_EMAIL_SUCCESSFULLY_SENT',
      };
    case SCREEN_RESULTS_SUCCESS: {
      return {
        ...state,
        screeningSummary: action.result,
      };
    }
    case UPDATE_QUOTE_PROMOTION_FAIL:
    case PROMOTE_QUOTE_FAIL:
      return {
        ...state,
        isLeaseTemplateMissingWarning: action.error.token === 'NO_LEASE_TEMPLATE_AVAILABLE',
      };
    case CLOSE_NO_LEASE_TEMPLATES_WARNING:
      return {
        ...state,
        isLeaseTemplateMissingWarning: false,
      };
    case PRINT_QUOTE_REQUEST:
    case PRINT_QUOTE_FAILURE:
    case PRINT_QUOTE_SUCCESS:
      return state;
    case DEMOTE_APPLICATION_REQUEST:
      return {
        ...state,
        isDemoting: true,
      };
    case DEMOTE_APPLICATION_SUCCESS:
      return {
        ...state,
        isDemoting: false,
      };
    case QUOTE_DIALOG_OPEN_STATE:
      return {
        ...state,
        isQuoteDialogOpen: action.isOpen,
      };
    case FETCH_QUOTE_TEMPLATE_REQUEST:
      return {
        ...state,
        isFetchingQuoteTemplate: true,
      };
    case FETCH_QUOTE_TEMPLATE_SUCCESS:
      return {
        ...state,
        template: action.result.template,
        fetchingQuoteTemplateError: null,
        isFetchingQuoteTemplate: false,
      };
    case FETCH_QUOTE_TEMPLATE_FAILURE:
      return {
        ...state,
        fetchingQuoteTemplateError: action.result,
        isFetchingQuoteTemplate: false,
      };
    case CLEAR_QUOTE_LIST:
      return initialState;
    case CLEAR_INVENTORY_WITH_UNAVAILABLE_PRICES:
      return {
        ...state,
        inventoryWithUnavailablePrices: false,
      };
    default:
      return state;
  }
}

const closeDuplicateWarning = () => ({ type: CLOSE_DUPLICATE_WARNING });

export const closeNoLeaseTemplatesWarning = () => ({
  type: CLOSE_NO_LEASE_TEMPLATES_WARNING,
});

const getQuoteModel = settings => (makeRequest, dispatch, getState) => {
  const { duplicateWarningOpen, inventoryWithUnavailablePrices, quote } = getState().quotes;
  if (duplicateWarningOpen) return undefined;
  if (inventoryWithUnavailablePrices) return undefined;
  if (!quote) return undefined;

  dispatch({ type: GET_QUOTE_MODEL, settings });

  const { model } = getState().quotes;
  return model;
};

const clearQuoteModel = () => ({ type: CLEAR_QUOTE_MODEL });

const createQuoteDraft = ({ inventory, partyId, defaultStartDate, unitShortHand, isRenewalQuote }) => async (makeRequest, dispatch) => {
  dispatch({ type: CREATE_QUOTE_DRAFT_REQUEST });

  const payload = {
    inventoryId: inventory.id,
    inventoryName: inventory.name,
    partyId,
    defaultStartDate,
    unitShortHand,
    isRenewalQuote,
  };

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/quotes',
    payload,
  });
  if (error) {
    error.__handled = true;
    dispatch({ type: CREATE_QUOTE_DRAFT_FAILURE, error });
  } else {
    dispatch({ type: CREATE_QUOTE_DRAFT_SUCCESS, result: data, inventory });
  }
};

const duplicateQuote = (quoteId, inventory) => async (makeRequest, dispatch) => {
  dispatch({ type: CREATE_QUOTE_DRAFT_REQUEST });
  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/quotes/draft?sourcePublishedQuoteId=${quoteId}`,
  });

  const errorDispatch = () => {
    error.__handled = error.token === 'MULTIPLE_QUOTE_DRAFT_NOT_ALLOWED';
    dispatch({ type: CREATE_QUOTE_DRAFT_FAILURE, error });
  };
  error ? errorDispatch() : dispatch({ type: CREATE_QUOTE_DRAFT_SUCCESS, result: data, inventory });
};

const saveQuoteDialogOpenState = isOpen => ({ type: QUOTE_DIALOG_OPEN_STATE, isOpen });

const fetchQuoteWithActionTypes = (partyId, types, reqId) => async (makeRequest, dispatch) => {
  const [request, success, failure] = types;
  dispatch({ type: request });
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/quotes?partyId=${partyId}`,
    reqId,
  });

  error ? dispatch({ type: failure, error }) : dispatch({ type: success, result: data });
};

const fetchQuotes = partyId => async (makeRequest, dispatch) => {
  const types = [FETCH_QUOTES_REQUEST, FETCH_QUOTES_SUCCESS, FETCH_QUOTES_FAILURE];
  return await fetchQuoteWithActionTypes(partyId, types)(makeRequest, dispatch);
};

const fetchQuotesIfNeeded = (partyId, reqId) => async (makeRequest, dispatch, getState) => {
  const { isQuoteDialogOpen } = getState().quotes;
  if (isQuoteDialogOpen) return;

  const types = [FETCH_QUOTES_SILENT_REQUEST, FETCH_QUOTES_SILENT_SUCCESS, FETCH_QUOTES_SILENT_FAILURE];
  await fetchQuoteWithActionTypes(partyId, types, reqId)(makeRequest, dispatch);
};

const fetchQuote = (quoteId, published, token = null) => {
  const type = published ? 'published' : 'draft';
  const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : null;

  return {
    types: [FETCH_QUOTE_REQUEST, FETCH_QUOTE_SUCCESS, FETCH_QUOTE_FAILURE],
    promise: client => client.get(`/quotes/${type}/${quoteId}`, headers),
  };
};

const deleteQuote = quoteId => ({
  types: [DELETE_QUOTE_REQUEST, DELETE_QUOTE_SUCCESS, DELETE_QUOTE_FAILURE],
  promise: client => client.del(`/quotes/${quoteId}`),
  deletedQuoteId: quoteId,
});

const updateQuoteDraft = (quoteId, data) => ({
  types: [UPDATE_QUOTE_REQUEST, UPDATE_QUOTE_SUCCESS, UPDATE_QUOTE_FAILURE],
  promise: client => client.patch(`/quotes/draft/${quoteId}`, { data }),
  data,
});

const publishQuote = (quoteId, data = {}) => {
  // TODO: change to quotes/publish/quoteId
  // remove the need to pass a publishDate
  // also protect this route to only be accessible
  // from the user that created the quote/supervisors or an admin
  const { propertyTimezone: timezone } = data;
  data = {
    ...data,
    publishDate: now({ timezone }).toJSON(),
  };

  return {
    types: [PUBLISH_QUOTE_REQUEST, PUBLISH_QUOTE_SUCCESS, PUBLISH_QUOTE_FAILURE],
    promise: client => client.patch(`/quotes/draft/${quoteId}`, { data }),
  };
};

const printQuote = ({ id, inventoryId, partyId, quoteFrameId } = {}) => async (makeRequest, dispatch) => {
  dispatch({ type: PRINT_QUOTE_REQUEST });

  if (quoteFrameId) {
    const frameContent = document.getElementById(quoteFrameId).contentWindow;
    frameContent.focus();
    frameContent.print();
  } else {
    window.print();
  }

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/printQuote',
    payload: {
      id,
      inventoryId,
      partyId,
    },
  });

  if (error) {
    dispatch({ type: PRINT_QUOTE_FAILURE, error });
  } else {
    dispatch({ type: PRINT_QUOTE_SUCCESS, result: data });
  }
};

// TODO: these do not belong in Quote store.  They are party operations.
const getScreeningForParty = data => {
  const { partyId, reqId } = data;
  return {
    types: [SCREEN_RESULTS_REQUEST, SCREEN_RESULTS_SUCCESS, SCREEN_RESULTS_FAILURE],
    promise: client => client.get(`/parties/${partyId}/screeningResult`, { reqId }),
  };
};

export const promoteQuote = ({ partyId, quoteId, leaseTermId }, promotionStatus, createApprovalTask, conditions) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/quotePromotions`,
    payload: {
      partyId,
      quoteId,
      leaseTermId,
      promotionStatus,
      createApprovalTask,
      conditions,
    },
  });

  const errorDispatch = () => {
    error.__handled = error.token === 'NO_LEASE_TEMPLATE_AVAILABLE';
    dispatch({ type: UPDATE_DATA_FAIL, error });
    dispatch({ type: PROMOTE_QUOTE_FAIL, error });
  };

  error
    ? errorDispatch()
    : dispatch({
        type: UPDATE_DATA_SUCCESS,
        result: { quotePromotions: [data.quotePromotion] },
      });

  return !error && { lease: data.lease, quotePromotion: data.quotePromotion };
};

export const updateQuotePromotion = (partyId, promotedQuoteId, promotionStatus, conditions) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });

  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/parties/${partyId}/quotePromotions/${promotedQuoteId}`,
    payload: {
      promotionStatus,
      conditions,
    },
  });

  const errorDispatch = () => {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    dispatch({ type: UPDATE_QUOTE_PROMOTION_FAIL, error });
  };

  error
    ? errorDispatch()
    : dispatch({
        type: UPDATE_DATA_SUCCESS,
        result: { quotePromotions: [data.quotePromotion] },
      });

  return !error && data.lease;
};

export const demoteApplication = (partyId, quotePromotionId) => ({
  types: [DEMOTE_APPLICATION_REQUEST, DEMOTE_APPLICATION_SUCCESS, DEMOTE_APPLICATION_FAILURE],
  promise: client => client.post(`/parties/${partyId}/demoteApplication`, { data: { quotePromotionId } }),
});

export const updatePartyQuotesOnInventoryHold = ({ inventoryOnHold, hold }) => ({
  type: UPDATE_QUOTES_ON_INVENTORY_HOLD,
  result: { inventoryOnHold, hold },
});

export const updatePartyQuotesOnInventoryUpdated = ({ inventoryId, state }) => ({
  type: UPDATE_QUOTES_ON_INVENTORY_UPDATED,
  result: { inventoryId, state },
});

const clearQuotes = () => ({ type: CLEAR_QUOTE_LIST });

export const clearInventoryWithUnavailablePrices = () => ({ type: CLEAR_INVENTORY_WITH_UNAVAILABLE_PRICES });

export const sendQuoteMail = ({ quoteId, partyId, context, personIds }) => ({
  types: [SEND_QUOTE_EMAIL_REQUEST, SEND_QUOTE_EMAIL_SUCCESS],
  promise: client =>
    client.post(`/communication/${partyId}/sendQuoteMail`, {
      data: {
        quoteId,
        context,
        personIds,
      },
    }),
});

export const fetchQuoteTemplate = ({ partyId, quoteId, context, hideApplicationLink, personId, token }) => async (makeRequest, dispatch) => {
  dispatch({ type: FETCH_QUOTE_TEMPLATE_REQUEST });

  const { data: template, error } = await makeRequest({
    method: 'POST',
    url: `/quotes/${quoteId}/emailContent`,
    payload: {
      partyId,
      templateArgs: { quoteId, personId },
      templateDataOverride: { quote: { hideApplicationLink } },
      context,
    },
    authToken: token,
  });

  const { missingTokens = [], body } = template || {};
  (error || missingTokens.length > 0) &&
    dispatch({
      type: FETCH_QUOTE_TEMPLATE_FAILURE,
      result: { missingTokens, error },
    });

  dispatch({
    type: FETCH_QUOTE_TEMPLATE_SUCCESS,
    result: { template: body },
  });
};

export {
  createQuoteDraft,
  clearQuoteModel,
  getQuoteModel,
  fetchQuotes,
  fetchQuote,
  publishQuote,
  deleteQuote,
  updateQuoteDraft,
  closeDuplicateWarning,
  printQuote,
  duplicateQuote,
  getScreeningForParty,
  saveQuoteDialogOpenState,
  fetchQuotesIfNeeded,
  clearQuotes,
};
