DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_PipelineStateAnalysis"; 				
CREATE TABLE "dstStarDB"."dstStarSchema"."f_PipelineStateAnalysis" ( 				

	"eventDt"				date		,
	"partyId"				uuid		,
	"ownerId"				uuid		,
	"propertyId"			uuid		,
	"pipelineStateId" 		integer	,

	"activeStateQty" 		bigint ,   
	"resolvedStateQty"		bigint ,
	"newStateQty" 			bigint ,
	"historyStateQty" 		bigint ,
	"MTDactiveStateQty" 	bigint ,
	"fullCycleProcessQty" 	bigint ,

	"activeStateDurationHours" 		float ,   
	"resolvedStateDurationHours" 	float ,
	"historyStateDurationHours" 	float ,
	"MTDactiveStateDurationHours" 	float ,
	"fullCycleProcessDurationHours" float ,

	"updated_at"	timestamptz		
);	

