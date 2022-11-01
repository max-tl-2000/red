@Ignore @ScheduleAppointment_Edit @Regression @Integration @Sanity @Smoke
Feature: Edit an existing appointment inline
         CPM-140: As a sales agent, I want to edit or remove an appointment

Background:
  Given   A 'party prospect details' page is opened with one appointment in it
  And     The appointment has no Units or Notes

@TODO
Scenario: CPM-577: Edit appointment - note inline editing (auto save)
  When    User clicks on 'appointment Note' field
  And     Types 'New inline Note' in the 'Note' field
  And     Refresh the page
  Then    The 'appointment Note' field should contain 'New inline Note'

@TODO
Scenario: CPM-640: Edit appointment - Units search, inline editing
  When    User clicks on 'Units shorthand' or 'address' field
  And     Types three letters from an existing unit in db
  Then    The 'suggestions' window should display the matching units

@TODO
Scenario: CPM-640: Edit appointment - Units search without results, inline editing
  When    User clicks on 'Units shorthand' or 'address' field
  And     Types three letters without matching unit in db
  Then    The 'suggestions' window should display the message for no matching results

@TODO
Scenario: CPM-640: Edit appointment - Add unit, inline editing (auto save)
  When    User clicks on 'Units shorthand' or 'address' field
  And     Types three letters from an existing unit in db
  And     Clicks on one of the returned units
  And     Refresh the page
  Then    The 'unit' chip should be displayed in the 'Units' field
