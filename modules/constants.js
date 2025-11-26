'use-strict'
module.exports = {
   "httpsCodes": {
      "SUCCESS_CODE": 200,
      "RECORD_CREATED": 201,
      "NOT_FOUND": 404,
      "SERVER_ERROR_CODE": 500,
      "UNAUTHORIZE_CODE": 401,
      "BAD_REQUEST": 400,
      "FEATURE_BLOCKED": 403,
      "CONFLICT": 409,
      "UNPROCESSED_REQUEST": 422
      
   },
   timeIntervals: {
      "cashAnalytics": 5
   },
   socketEvents: {
      graphData: "graphData",
      dailyCollection: "dailyCollection",
      expectedCollection: "expectedCollection",
      feeReceived: "feeReceived",
      feeReceivable: "feeReceivable",
      fixedAnalytics: "fixedAnalytics",
      cashAnalytics: "cashAnalytics"
   },
   monthNames: [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC"
   ]
}
