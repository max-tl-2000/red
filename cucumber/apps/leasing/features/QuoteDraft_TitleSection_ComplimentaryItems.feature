@QuoteDraft_TitleSection @Regression @Integration @Sanity @Smoke @Ignore
Feature: Quote Draft - Title section show complimentary item(s)
         CPM-1535: The following story points will be covered in this feature file:
                  - #1c. Show items that satisfy the following conditions
          * In the inventory sheet IF there are inventory item(s) that have parentInventory value that matches this unit,OR
          * In the Fees sheet, IF the fee for this unit has an additionalFee that is of 0 price OR is tied to an inventoryGroup with 0 price,
          Then
          * Show those inventory item name(s) in this complimentary list. e.g. storage that is included with a unit.
                  - #3 Storage 240 has 1001 listed in its parentInventory column in the Inventory sheet. That is why it is shown here.

Background:
  Given    The user opened a 'party prospect details' page with guest:
   | guest |
   | Foo   |
  And    User Filtered units by number of bedrooms

@TODO @Positive @Core
Scenario: CPM-1535: #1c. Show items that satisfy the following conditions -
  When   User clicks on QUOTE link to the Unit result '1002'
  Then   'Title' section of the 'Quotes details' page should be displayed on screen
  And    A label 'Large room(1002 #3)' should be displayed for a linked inventory that does not have any inventory group association
  And    A label 'Small room(1002 #4)' should be displayed for a linked inventory that has a value for Inventory Group
  And    A label 'Large room(1002 #1)' should be displayed for an Additional Fee that is of price 0
  And    A label 'Small room(1002 #2)' should be displayed for an Additional Fee that of the feeType Inventory Group has price 0

@TODO @Positive @Core
Scenario Outline: CPM-1535: #3 Storage 240 has 1001 listed in its parentInventory column in the Inventory sheet. That is why it is shown here.
  When   User clicks on QUOTE link to the <Unit> results
  Then   'Title' section of the 'Quotes details' page should be displayed on screen
  And    Complimentary list <item> should be storage:

Examples:
  | unit | item  |
  | 1001 | 240   |
  | 1001 | 245   |
  | 1010 | 130   |
  | 1011 | 330   |
