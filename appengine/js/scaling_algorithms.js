
// this won't be necessary if running on coordinator
host = ''

var ithQuery = 0

function initializeScaling()
{
	var initializeScalingObj = createInitializeScalingObj()
 	// call the initialize POST function
	$.ajax({
                type: 'POST',
                url: host + ":8753/perfenforce/initializeScaling",
                dataType: 'json',
                data: initializeObject,
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

	console.log(createScalingAlgorithmObj())

	// call the initialize POST function
	$.ajax({
                type: 'POST',
                url: host + ":8753/perfenforce/step-fake",
                headers: { 'Accept': 'application/json','Content-Type': 'application/json' },
                dataType: 'json',
                data: JSON.stringify(createScalingAlgorithmObj()),
                global: false,
                async: false,
                success: function (data) {
                    return data;
                }
            })
}