DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis";				

CREATE TABLE "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" ( 				

	"metricName"	varchar(255)	, 
	"metricAggregationType"	varchar(10)	,
	"eventDt"		date		,
	"partyId"		uuid		,
	"ownerId"		uuid		,
	"propertyId"		uuid		,
	"pipelineStateId"	integer	,
	"metricFloat"   float   ,
	"metricBigint"  bigint   ,
	"updated_at"	timestamptz		
);	
