//general tier functions
function tierSelect(tierNumber) {
localStorage.setItem("tier", tierNumber);
}

function getTier(){
	return localStorage.getItem("tier");
}

function getSequenceValue() {
	var inputs = document.getElementsByName("workloadSelection");
	for (var i = 0; i < inputs.length; i++) {
	  if (inputs[i].checked) {
	    return inputs[i].value;
	  }
	}
}

function getScalingAlgorithm(){
	return localStorage.getItem("SA");
}

// RL functions
function recordRL(alpha, beta){
	localStorage.setItem("SA", "RL")
	localStorage.setItem("RL-alpha", document.getElementById("RL-ALPHA-TEXTBOX").value);
	localStorage.setItem("RL-beta", document.getElementById("RL-BETA-TEXTBOX").value);
	printRL();
}

function printRL(){
	console.log("RL-alpha: " + localStorage.getItem("RL-alpha"));
	console.log("RL-beta: " + localStorage.getItem("RL-beta"));
}

function getAlpha(){
	return +localStorage.getItem("RL-alpha");
}

function getBeta(){
	return +localStorage.getItem("RL-beta");
}

function updateRLTextboxes(){
	document.getElementById("RL-ALPHA-TEXTBOX").value = getAlpha()
	document.getElementById("RL-BETA-TEXTBOX").value = getBeta()
}

// PI functions
function recordPI(kp, ki){
	localStorage.setItem("SA", "PI")
	localStorage.setItem("PI-KP", document.getElementById("PI-KP-TEXTBOX").value);
	localStorage.setItem("PI-KI", document.getElementById("PI-KI-TEXTBOX").value);
}

function getKP(){
	return +localStorage.getItem("PI-KP");
}

function getKI(){
	return +localStorage.getItem("PI-KI");
}

function printPI(){
	console.log("PI-KP: " + localStorage.getItem("PI-KP"));
	console.log("PI-KI: " + localStorage.getItem("PI-KI"));
}


// OML functions
function recordOML(lr){
	localStorage.setItem("SA", "OML")
	localStorage.setItem("OML-LR", document.getElementById("OML-LR-TEXTBOX").value);
}

function getLR(){
	return +localStorage.getItem("OML-LR");
}

function printOML(){
	console.log("OML-LR: " + localStorage.getItem("OML-LR"));
}