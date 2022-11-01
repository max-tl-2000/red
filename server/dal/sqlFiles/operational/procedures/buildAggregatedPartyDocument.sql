CREATE OR REPLACE FUNCTION db_namespace.buildAggregatedPartyDocument(party_id uuid)
    RETURNS SETOF record
    LANGUAGE sql
AS $function$
SELECT (row_to_json(party)::jsonb ||
    json_build_object(
        'members', "members",
        'children', "children",
        'pets', "pets",
        'vehicles', "vehicles",
        'comms', "comms",
        'tasks', "tasks",
        'invOnHolds', "invOnHolds",
        'quotes', "quotes",
        'promotions', "promotions",
        'partyApplications', "partyApplications",
        'personApplications', "personApplications",
        'invoices', "invoices",
        'transactions', "transactions",
        'leases', "leases",
        'events', "events",
        'screeningResults', "screeningResults",
        'activeLeaseData', "activeLeaseData",
        'property', "property",
        'ownerTeamData', "ownerTeamData"
    )::jsonb) AS result
    FROM db_namespace."Party" party
    LEFT JOIN LATERAL (SELECT json_agg(json_build_object('partyMember', row_to_json(pm),
                                                        'person', row_to_json(person),
                                                        'contactInfo', "contactInfo".c,
                                                        'company', row_to_json(company))) AS "members"
                    FROM db_namespace."PartyMember" pm
                    INNER JOIN db_namespace."Person" person ON pm."personId" = person."id"
                    LEFT JOIN db_namespace."Company" company ON pm."companyId" = company."id"
                    LEFT JOIN LATERAL (SELECT json_agg(contact) AS c
                                        FROM db_namespace."ContactInfo" contact
                                        WHERE contact."personId" = person.id) "contactInfo" ON true
                    WHERE pm."partyId" = party.id) pm ON true
LEFT JOIN LATERAL (SELECT json_agg(pai) as children FROM db_namespace."Party_AdditionalInfo" pai
                            WHERE pai."partyId" = party_id AND type='child') child ON true
LEFT JOIN LATERAL (SELECT json_agg(pai) as pets FROM db_namespace."Party_AdditionalInfo" pai
                            WHERE pai."partyId" = party_id AND type='pet') pet ON true
LEFT JOIN LATERAL (SELECT json_agg(pai) as vehicles FROM db_namespace."Party_AdditionalInfo" pai
                            WHERE pai."partyId" = party_id AND type='car') vehicle ON true
    LEFT JOIN LATERAL (SELECT json_agg(jsonb_build_object('created_at', "created_at", 'id', "id", 'parties', "parties", 'persons', "persons",
                                                        'direction', "direction", 'type', "type", 'userId', "userId", 'messageId', "messageId",
                                                        'message', "message" - 'rawMessage', 'status', "status", 'threadId', "threadId",
                                                        'teams', "teams", 'category', "category", 'unread', "unread")) as comms
                        FROM db_namespace."Communication" comm
                        WHERE ARRAY[party.id::varchar(36)] <@ comm.parties) comm ON true
    LEFT JOIN LATERAL (SELECT json_agg(task) AS tasks
                        FROM db_namespace."Tasks" task
                        WHERE task."partyId" = party.id
                        AND (task.state <> 'Canceled' OR task.name = 'APPOINTMENT')
                    ) task ON true
    LEFT JOIN LATERAL (SELECT json_agg(invOnHold) AS "invOnHolds"
                        FROM db_namespace."InventoryOnHold" invOnHold
                        WHERE invOnHold."partyId" = party.id) invOnHold ON true
    LEFT JOIN LATERAL (SELECT json_agg(quote) AS quotes
                        FROM db_namespace."Quote" quote
                        WHERE quote."partyId" = party.id) quote ON true
    LEFT JOIN LATERAL (SELECT json_agg(activeLease) AS "activeLeaseData"
                        FROM db_namespace."ActiveLeaseWorkflowData" activeLease
                        WHERE (
                          (party."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}' AND activeLease."partyId" = party.id) OR
                          (party."workflowName" = '${DALTypes.WorkflowName.RENEWAL}' AND activeLease."partyId" = party."seedPartyId")
                      )) activeLease ON true
    LEFT JOIN LATERAL (SELECT json_agg(promotion) AS "promotions"
                        FROM db_namespace."PartyQuotePromotions" promotion
                        WHERE promotion."partyId" = party.id) promotion ON true
    LEFT JOIN LATERAL (SELECT json_agg(partyApp) AS "partyApplications"
                        FROM db_namespace."rentapp_PartyApplication" partyApp
                        WHERE partyApp."partyId" = party.id) partyApp ON true
    LEFT JOIN LATERAL (SELECT json_agg(personApp) AS "personApplications"
                        FROM db_namespace."rentapp_PersonApplication" personApp
                        WHERE personApp."partyId" = party.id) personApp ON true
    LEFT JOIN LATERAL (SELECT json_agg(invoice) AS "invoices"
                        FROM db_namespace."rentapp_ApplicationInvoices" invoice
                        INNER JOIN db_namespace."rentapp_PartyApplication" partyApp ON invoice."partyApplicationId" = partyApp.id
                        WHERE partyApp."partyId" = party.id) invoice ON true
    LEFT JOIN LATERAL (SELECT json_agg(transaction) AS "transactions"
                        FROM db_namespace."rentapp_ApplicationTransactions" transaction
                        INNER JOIN db_namespace."rentapp_ApplicationInvoices" invoice ON transaction."invoiceId" = invoice.id
                        INNER JOIN db_namespace."rentapp_PartyApplication" partyApp ON invoice."partyApplicationId" = partyApp.id
                        WHERE partyApp."partyId" = party.id) transaction ON true
    LEFT JOIN LATERAL (SELECT json_agg(events) AS "events"
                        FROM db_namespace."PartyEvents" events
                        WHERE events."partyId" = party.id
                        AND events.transaction_id = txid_current()) events ON true
    LEFT JOIN LATERAL (SELECT json_build_object('submissionResponses', json_agg(jsonb_build_object('id', submissionResponse."id", 'status', submissionResponse."status", 'submissionRequestId', submissionResponse."submissionRequestId")),
                                              'submissionRequests', json_agg(json_build_object('id', submissionRequest."id", 'rentData', submissionRequest."rentData"))) AS "screeningResults"
                      FROM db_namespace."rentapp_SubmissionResponse" submissionResponse
                        INNER JOIN db_namespace."rentapp_SubmissionRequest" submissionRequest ON submissionResponse."submissionRequestId" = submissionRequest.id
                        INNER JOIN db_namespace."rentapp_PartyApplication" partyApplication ON submissionRequest."partyApplicationId" = partyApplication.id
                        WHERE partyApplication."partyId" = party.id AND submissionRequest."isObsolete" = false AND submissionRequest."requestType" <> 'ResetCredit') screening ON true
    LEFT JOIN LATERAL (SELECT json_agg(json_build_object('id', id, 'partyId', "partyId", 'quoteId', "quoteId", 'leaseTermId', "leaseTermId",
                                    'leaseTemplateId', "leaseTemplateId", 'status', "status", 'external', "external", 'externalLeaseId', "externalLeaseId",
                                    'created_at', created_at, 'updated_at', updated_at, 'signDate', "signDate", 'baselineData',
                                    "baselineData", 'signatures', leaseSignatures.signatures))
                                    AS "leases"
                        FROM db_namespace."Lease" lease
                        LEFT JOIN LATERAL (
                            SELECT json_agg(ls) AS signatures
                            FROM db_namespace."LeaseSignatureStatus" ls
                            WHERE ls."leaseId" = lease.id) leaseSignatures ON true
                        WHERE lease."partyId" = party_id) lease ON true
    LEFT JOIN LATERAL (SELECT json_agg(jsonb_build_object('id', id, 'name', name, 'propertyLegalName', "propertyLegalName", 'displayName', "displayName", 'timeZone', timezone, 'settings', settings->'residentservices', 'app', settings -> 'rxp' -> 'app')) AS "property"
                          FROM db_namespace."Property" property
                          WHERE property.id = party."assignedPropertyId") property ON true
    LEFT JOIN LATERAL (SELECT json_agg(ownerTeam) AS "ownerTeamData"
                        FROM db_namespace."Teams" ownerTeam
                        WHERE ownerTeam."id" = party."ownerTeam") ownerTeam ON true
    WHERE party."id" = party_id;
    $function$