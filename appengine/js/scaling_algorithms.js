
// this won't be necessary if running on coordinator
host = ''

var ithQuery = 0
var configs = [4,6,8,10,12]

function getRequest(command)
{
  return $.ajax({
                type: 'GET',
                url: host + ":8753" + command,
                dataType: 'json',
                global: false,
                async: false,
                success: function(data) {
            		return data;
        		}
            });
}

function initializeScaling()
{
    ithQuery = 0
	var initializeScalingObj = createInitializeScalingObj()

    console.log(initializeScalingObj)

 	// call the initialize POST function
	$.ajax({
                type: 'POST',
                url: host + ":8753/perfenforce/initializeScaling",
                dataType: 'json',
                headers: { 'Accept': 'application/json','Content-Type': 'application/json' },
                data: JSON.stringify(initializeScalingObj),
                global: false,
                async: false,
                success: function (data) {
                    return data;
                }
            });
}

function createInitializeScalingObj() {
		initializeObject = {}
		initializeObject.tier = getTier()

		var radioSelection = getSequenceValue();
		initializeObject.path = "/mnt/myria/perfenforce_files/ScalingAlgorithms/Replay/Seq" + radioSelection + "/"

		var scalingAlgorithmObj = createScalingAlgorithmObj()
		initializeObject.scalingAlgorithm = scalingAlgorithmObj



		return initializeObject
}

function createScalingAlgorithmObj()
{
	scalingAlgorithmObj = {}
	scalingAlgorithmObj.name = getScalingAlgorithm()

	if(scalingAlgorithmObj.name == "RL")
	{
	scalingAlgorithmObj.alpha = getAlpha()
	scalingAlgorithmObj.beta = getBeta()
	}
	else if(scalingAlgorithmObj.name == "PI")
	{
	scalingAlgorithmObj.kp = getKP()
	scalingAlgorithmObj.ki = getKI()
	scalingAlgorithmObj.w = getW()
	}
	else if(scalingAlgorithmObj.name == "OML")
	{
	scalingAlgorithmObj.lr = getLR()
	}
	return scalingAlgorithmObj
}

function setupNextQuery(){
    console.log("ITH " + ithQuery)
    ithQuery = ithQuery + 1



    var scalingAlgorithmObj = createScalingAlgorithmObj()

    // Make it block :( 
    $.ajax({
                type: 'POST',
                url: host + ":8753/perfenforce/setup-fake",
                headers: { 'Accept': 'application/json','Content-Type': 'application/json' },
                dataType: 'json',
                data: JSON.stringify(scalingAlgorithmObj),
                global: false,
                async: false,
                success: function (data) {
                    return data;
                }
            });

    $.when(getRequest('/perfenforce/get-current-query'), getRequest('/perfenforce/get-previous-query'), getRequest('/perfenforce/cluster-size')).done(function(currentQuery, previousQuery, clusterSize){

        var upcomingQueryLabel = document.getElementById("upcomingQueryLabel")
        var upcomingQuerySLALabel = document.getElementById("upcomingQuerySLA")
        if ( typeof currentQuery[0]!="undefined" && currentQuery[0].description!=null ){
        upcomingQueryLabel.innerHTML = currentQuery[0].description;
        upcomingQueryLabel.className = "queryStatusLabel customBorderWhite"
        upcomingQuerySLALabel.innerHTML = "Expected Runtime: " + currentQuery[0].slaRuntime;
        }
        else
        {
        upcomingQueryLabel.innerHTML = "End of Query Sequence";
        upcomingQueryLabel.className = "queryStatusLabel customBorderWhite"
        upcomingQuerySLALabel.innerHTML = "";
        document.getElementById("nextButton").disabled = true;
        
        }
        // for previous query
        if ( typeof previousQuery[0]!="undefined" && previousQuery[0].description!=null ){
            console.log("adding to previous list")
            addRuntimeToList(previousQuery[0].description, (previousQuery[0].runtimes)[configs.indexOf(clusterSize[0])], previousQuery[0].slaRuntime)
        }

    });
}

function getLabelColor(labelText)
{
        if(labelText.includes("100%"))
        {
            return " customBorderRed"
        }
        else if(labelText.includes("10%"))
        {
            return " customBorderOrange"
        }

        else if(labelText.includes("WHERE 1%"))
        {
            return " customBorderYellow"
        }
        else if(labelText.includes("0.1%")){
            return " customBorderLightYellow"
        }

}

function radioButtonPress()
{
    console.log("radio button press")
    ithQuery = 0
    
    document.getElementById("nextButton").disabled = false;
    document.getElementById("stepChoiceButton").disabled = false;
    document.getElementById("workloadChoiceButton").disabled = false;
    clearGraphs();

    document.getElementById('step3Graphs').style.visibility='hidden'
    document.getElementById('upcomingQuery').style.visibility='hidden'
    document.getElementById('previousQueryList').style.visibility='hidden'
    document.getElementById('previousQueryHeader').style.visibility='hidden'

    document.getElementById('restart').style.visibility='hidden'
    document.getElementById('previousQueryList').innerHTML = '<ul><li></li></ul>';
    initializeScaling();
    setupNextQuery();
}

function clearGraphs()
{
    userPoints = []
    var firstObj = {}
    firstObj.queryID = 0
    firstObj.actual = configs[getTier()]
    firstObj.ideal = firstObj.actual
    userPoints.push(firstObj)

    if(getScalingAlgorithm() == "PI")
    {
        userPoints_pi  = []

        var firstObj_pi = {}
        firstObj_pi.queryID = "0"
        firstObj_pi.PIControlProportionalErrorValue = "0"
        firstObj_pi.PIControlIntegralErrorSum = "0"
        userPoints_pi.push(firstObj_pi)
    }
}

function hideCharts()
{
    document.getElementById('idealactual').style.visibility='hidden'
    if(getScalingAlgorithm() == "RL")
    {
    document.getElementById('rl-barchart').style.visibility='hidden'
    }
    else if (getScalingAlgorithm() == "PI")
    {   
    document.getElementById('piError').style.visibility='hidden'
    }
    else if (getScalingAlgorithm() == "OML"){
    
    }      
}

function showCharts()
{
    document.getElementById('idealactual').style.visibility='visible'
    if(getScalingAlgorithm() == "RL")
    {
    document.getElementById('rl-barchart').style.visibility='visible'
    }
    else if (getScalingAlgorithm() == "PI")
    {   
    document.getElementById('piError').style.visibility='visible'
    }
    else if (getScalingAlgorithm() == "OML"){
    
    } 
}

function nextButtonPress()
{
        showCharts()
        recordMetrics();
        stepFake();

        updateGraphs();

        //prepare upcoming
        setupNextQuery();

}

function updateGraphs()
{
    // update graphs
        updateActualIdealLineGraph();
        if(getScalingAlgorithm() == "RL")
        {
        updateRLAwardChart();
        }
        else if (getScalingAlgorithm() == "PI")
        { 
        updatePIErrorLines();   
        }
}

function recordMetrics()
{
    if(getScalingAlgorithm() == "RL")
    {console.log("record ml")
    recordRL();
    }
    else if (getScalingAlgorithm() == "PI")
    {   
    recordPI();
    }
    else if (getScalingAlgorithm() == "OML"){
    recordOML();
    }         

}


function stepFake() {

	// Make it block :( 
	$.ajax({
                type: 'POST',
                url: host + ":8753/perfenforce/step-iteration",
                global: false,
                async: false,
                success: function (data) {
                    return data;
                }
            });
}


function addRuntimeToList(queryDesc, runtime, sla, id)
{
  $("#previousQueryList ul").prepend('<li><p>QueryID: '+ ((ithQuery)-1) + '<br>Query: ' + queryDesc + '<br>Runtime performance: ' + runtime + '<br>Expected Runtime: ' + sla+ ' </p></li>');
}

function showStepGraphsAndDisable()
{
    if(typeof getSequenceValue()=="undefined")
    {
        alert("please select a workload")
    }
    else  {
    
    document.getElementById('upcomingQuery').style.visibility='visible'
    document.getElementById('previousQueryList').style.visibility='visible'
    document.getElementById('previousQueryHeader').style.visibility='visible'
    document.getElementById('step3Graphs').style.visibility='visible'
    document.getElementById('restart').style.visibility='visible'
    document.getElementById("stepChoiceButton").disabled = true;
    document.getElementById("workloadChoiceButton").disabled = true;
    }

}

function runStepsAndDisable()
{
    if(typeof getSequenceValue()=="undefined")
    {
        alert("please select a workload")
    }
    else  {

    document.getElementById('previousQueryList').style.visibility='visible'
    document.getElementById('previousQueryHeader').style.visibility='visible'
    document.getElementById('step3Graphs').style.visibility='visible'
    document.getElementById('restart').style.visibility='visible'
    document.getElementById("stepChoiceButton").disabled = true;
    document.getElementById("workloadChoiceButton").disabled = true;
    }
    //run all queries
    while (true)
    {
        nextButtonPress()
        if(document.getElementById("nextButton").disabled == true)
        {
            break;
        }
    }
}