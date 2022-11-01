@QuotePromotionWithNoApplication @Regression @Integration @Sanity @Smoke @PR
Feature: LAA promotes a quote with no application
		Cucumber test to check that the LAA can make a promotion of a quote without an application.

Scenario: CPM-9712: Can't promote a quote to lease for party without application in dev
  Given User logs in as "sally@reva.tech" with password "red&reva#"
  And   User clicks: "#switchTodayOnly"
  And   User clicks: "[data-component='party-guests'] [data-id='Kevin Andreson']"
  And   Clicks step with id "1"
  When  User clicks 'Quote' on unit card "1013"
  And   User publishes the quote but doesnt send the quote
  Then  User shares quote by email
  When  'Leasing' agent selects a quote for promotion for item "1013" from 'Party Details' page
  Then  The screening is reviewed for unit "1013"
  # TODO. Add this flow separate as now the default lease term will just be one (taken from the rent matrix)
  # And   Reviews the application for the quoted item "1013" with lease term "6 months"
  Then  The "approvalSummary" dialog should open
  When  User clicks approve application button
  Then  The "screeningIncompleteDialog" dialog should open
  And   User clicks: "#screeningIncompleteDialog [data-command='OK']"
  Then  The "approveApplication" dialog should open
  When  User types in field "internalNotes" : "Approved with Conditions"
  And   Increases the deposit condition to "$8,792.00 (2x deposit)"
  And   User clicks: "#approveApplication [data-action='OK']"
  Then  The "leaseForm" dialog should open
  And   User goes back to Dashboard and logs out
