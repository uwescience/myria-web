
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
        console.log("Upcoming Query " )
        console.log(currentQuery[0]) 
        if ( typeof currentQuery[0]!="undefined" && currentQuery[0].description!=null ){
        upcomingQueryLabel.innerHTML = currentQuery[0].description;
        upcomingQueryLabel.className = "queryStatusLabel" + getLabelColor(currentQuery[0].description)
        upcomingQuerySLALabel.innerHTML = "SLA: " + currentQuery[0].slaRuntime;
        }
        else
        {
        upcomingQueryLabel.innerHTML = "End of Query Sequence";
        upcomingQueryLabel.className = "queryStatusLabel customBorderWhite"
        upcomingQuerySLALabel.innerHTML = "";
        document.getElementById("nextButton").disabled = true;
        }


        var previousQueryLabel = document.getElementById("previousQueryLabel")
        var previousQuerySLALabel = document.getElementById("previousQuerySLA")
        var previousQueryActualLabel = document.getElementById("previousQueryActual")
        console.log("Previous Query ")
        console.log(previousQuery[0]) 
        if (previousQuery[0].description != null && typeof previousQuery[0]!='undefined'){
         previousQueryLabel.innerHTML = previousQuery[0].description;
         previousQueryLabel.className = "queryStatusLabel" +  getLabelColor(previousQuery[0].description)
         previousQuerySLALabel.innerHTML = "SLA: " + previousQuery[0].slaRuntime;
         previousQueryActualLabel.innerHTML = "Actual Runtime: " + (previousQuery[0].runtimes)[configs.indexOf(clusterSize[0])];
        }
        else
        {
         previousQueryLabel.innerHTML = "";
         previousQuerySLALabel.innerHTML = "";
         previousQueryActualLabel.innerHTML = "";
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
    ithQuery = 0
    document.getElementById("nextButton").disabled = false;
    makeThreeVisible();
    clearGraphs();
    initializeScaling();
    setupNextQuery();
}

function clearGraphs()
{
    userPoints = []
    var firstObj = {}
    firstObj.queryID = "0"
    firstObj.actual = configs[getTier()]
    firstObj.ideal = configs[getTier()]
    userPoints.push(firstObj)
}

function nextButtonPress()
{
    recordRL();
    stepFake();
    updateActualIdealLineGraph();
    updateRLAwardChart();
    setupNextQuery();
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