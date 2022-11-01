Feature: Inventory Card Features
         Cucumber test to check Inventory Card features

@Demo2973 @Ignore
Scenario: CPM-2973
        Agent is on Party Details page and sees a list of units matching current search criteria on the right.
        Each unit's card should have an image of the unit on it.

  Given   A user is viewing the 'PartyDetailsPhaseTwo' page
  Then    A list of inventory cards is displayed
  And     All inventory cards contain an image
