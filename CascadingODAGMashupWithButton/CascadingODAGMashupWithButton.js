var prefix = window.location.pathname.substr( 0, window.location.pathname.toLowerCase().lastIndexOf( "/extensions" ) + 1 );
var config = {
    host: window.location.hostname,
    prefix: prefix,
    port: window.location.port,
    isSecure: window.location.protocol === "https:"
};
require.config( {
    baseUrl: ( config.isSecure ? "https://" : "http://" ) + config.host + (config.port ? ":" + config.port: "") + config.prefix + "resources"
} );

require(['js/qlik'], function (qlik) {

/*   <---CHANGE ODAG SETTINGS/PARAMETERS HERE--->   */	       
    var serverHostname = 'sensedemo7';
    var summaryAppID = '4c172998-37dd-45e1-a048-ee583a3af95c';
    var summarySheetID = '349eea40-7c56-4425-a108-c606568d6dfa';
    var summaryAppFiltersObjectID = 'rZmJgfV';
    var summaryAppODAGLinkID = '57e2bbfb-b74d-445a-ad83-3d1b8fb78ac9';
    var maxNumberOfRecords = 50000;
    var bindingFields = ["Rate_Code|O","Payment_Type|O","Pickup_Date|S","Pickup_Year|O"];
    var expressionToEvaluateRecordsAndValues = 
        "=Sum([#Fares]) & '|' & Concat(Distinct Rate_Code,',') & '|' & Concat(Distinct Payment_Type,',') & '|' & Concat(Distinct Pickup_Date,',') & '|' & Concat(Distinct Pickup_Year,',')";

    
    
    var summaryApp = qlik.openApp(summaryAppID);
    summaryApp.getObject('summaryAppSelections', 'CurrentSelections');
    summaryApp.getObject('summaryAppFilters',summaryAppFiltersObjectID);

    var result = '';
    summaryApp.createCube({
        qMeasures : [{
            qDef : {
                qDef : expressionToEvaluateRecordsAndValues
            }
        }],
        qInitialDataFetch : [{
            qTop : 0,
            qLeft : 0,
            qHeight : 1,
            qWidth : 1
        }]
    }, function(reply) {
        result = reply.qHyperCube.qDataPages[0].qMatrix[0][0].qText;
        if(Number(result.split('|')[0])>=maxNumberOfRecords){
            document.getElementById('ODAGButton').className = 'ODAGButtonDisabled';
        }
        else{
            document.getElementById('ODAGButton').className = 'ODAGButton';
        }
    });


    ODAGButton.onclick = function(){
        if(document.getElementById('ODAGButton').className == 'ODAGButton'){
            document.getElementById('ODAGButton').className = 'ODAGButtonDisabled';
            document.getElementById('ODAGButton').innerHTML = 'Generating New App...';

            var generateAppRequestXHR = new XMLHttpRequest();
            generateAppRequestXHR.open("POST", 'https://sensedemo7/api/odag/v1/links/'+ summaryAppODAGLinkID +'/requests', true);
            generateAppRequestXHR.setRequestHeader('Content-Type', 'application/json');

            generateAppRequestXHR.onload = function(){
                generateAppResponse = JSON.parse(generateAppRequestXHR.response);
                console.log('generateAppResponse',generateAppResponse);

                var recursiveCheckAppStatus = function() {
                    setTimeout(function() {
                        var checkAppStatusXHR = new XMLHttpRequest();
                        checkAppStatusXHR.open('GET', 'https://'+ serverHostname +'/api/odag/v1/requests/'+ generateAppResponse["id"]);
                        checkAppStatusXHR.onload = function() {
                            checkAppStatusResponse = JSON.parse(checkAppStatusXHR.response);

                            if (checkAppStatusResponse["state"] == "succeeded") {
                                console.log('App created!',checkAppStatusResponse);
                                var generatedAppID = checkAppStatusResponse["generatedApp"]["id"];
                                var generatedAppSheetID = checkAppStatusResponse["targetSheet"];

                                var detailsAppDiv = document.getElementById('detailsApp');

                                var detailsAppSelections = '<div id="detailsAppSelections" style="position: absolute; top: 942px; left: 20px; width: 97%; height: 32px; border-radius: 4px;" class="qvobject"></div>';
                                var detailsApp = qlik.openApp(generatedAppID);
                                detailsApp.getObject('detailsAppSelections', 'CurrentSelections');
                                
                                var detailsAppiframe = '<iframe id="detailsAppiframe" src="https://sensedemo7/single/?appid='+ generatedAppID +'&sheet='+ generatedAppSheetID +'" style="position:absolute; top: 984px; left: 20px; right: 20px; width: 97%; height: 750px; border-style:none;"></iframe>';	

                                detailsAppDiv.style="height:950px;";
                                detailsAppDiv.innerHTML = detailsAppSelections + detailsAppiframe;
                                window.scrollBy({ 
                                    top: 1050,
                                    behavior: 'smooth' 
                                });

                                document.getElementById('ODAGButton').className = 'ODAGButton';
                                document.getElementById('ODAGButton').innerHTML = 'Generate New App';
                            }
                            else{
                                console.log('App still pending...',checkAppStatusResponse);
                                recursiveCheckAppStatus();
                            }
                        };

                        checkAppStatusXHR.send();
                    }, 1000);
                };

                recursiveCheckAppStatus();
            };

            var bindingFieldsAndTheirSelectedValues = 
                {
                    "selectionApp": summaryAppID,
                    "sheetname": summarySheetID,
                    "actualRowEst": Number(result.split('|')[0]),
                    "bindSelectionState": []
                };

            bindingFields.forEach(function(field, fieldIndex){
                var newFieldSection = 
                    {
                        "selectionAppParamType": "Field",
                        "selectionAppParamName": field.split('|')[0],
                        "values": []
                    };

                var newFieldValues = result.split('|')[fieldIndex+1].split(',');
                newFieldValues.forEach(function(value, valueIndex){
                    var numericValue = (!Number(value)) ? "NaN" : Number(value);
                    var newValueSection =                  
                        {
                            "selStatus": field.split('|')[1],
                            "strValue": value,
                            "numValue": numericValue
                        };
                    newFieldSection["values"].push(newValueSection); 
                });

                bindingFieldsAndTheirSelectedValues["bindSelectionState"].push(newFieldSection); 
            });
            console.log('generateAppRequest',bindingFieldsAndTheirSelectedValues);
            generateAppRequestXHR.send(JSON.stringify(bindingFieldsAndTheirSelectedValues));
        }
    };

});