
// this won't be necessary if running on coordinator
host = ''

var ithQuery = 0


function getRequest(command)
{
  return $.ajax({
                type: 'GET',
                url: host + ":8753" + command,
                dataType: 'json',
                global: false,
                async: true,
                success: function(data) {
            		return data;
        		}
            });
}

function initializeScaling()
{
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
		initializeObject.path = "/mnt/myria/perfenforce_files/ScalingAlgorithms/Replay/Seq" + radioSelection + "/Reactive/"

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
	scalingAlgorithmObj.kp = getKI()
	scalingAlgorithmObj.ki = getKP()
	}
	else if(scalingAlgorithmObj.name == "OML")
	{
	scalingAlgorithmObj.lr = getLearningRate()
	}
	return scalingAlgorithmObj
}


function stepFake() {
	ithQuery = ithQuery + 1

	if(ithQuery == 1){
          console.log("initializing");
          initializeScaling()
    }

    console.log("STEP FAKE")
    var scalingAlgorithmObj = createScalingAlgorithmObj()
    console.log(scalingAlgorithmObj)
	// Make it block :( 
	$.ajax({
                type: 'POST',
                url: host + ":8753/perfenforce/step-fake-reactive",
                headers: { 'Accept': 'application/json','Content-Type': 'application/json' },
                dataType: 'json',
                data: JSON.stringify(scalingAlgorithmObj),
                global: false,
                async: false,
                success: function (data) {
                    return data;
                }
            });
}