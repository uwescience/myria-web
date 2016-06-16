configs = [4,6,8,10,12]

//general tier functions
function getTier(){
	return +localStorage.getItem("tier");
}

function getSequenceValue() {
	var inputs = document.getElementsByName("workloadSelection");
	for (var i = 0; i < inputs.length; i++) {
	  if (inputs[i].checked) {
	  	console.log("checked")
	    return i;
	  }
	}
}

function getScalingAlgorithm(){
	return localStorage.getItem("SA");
}

function makeThreeVisible(){
	document.getElementById('step3Tuning').style.visibility='visible'
	document.getElementById('step3Graphs').style.visibility='visible'
}

// RL functions
function recordRL(){
	localStorage.setItem("SA", "RL")
	localStorage.setItem("RL-alpha", document.getElementById("RL-ALPHA-TEXTBOX").value);
	localStorage.setItem("RL-beta", document.getElementById("RL-BETA-TEXTBOX").value);
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
	localStorage.setItem("PI-W", document.getElementById("PI-WINDOW-TEXTBOX").value);
}

function getKP(){
	return +localStorage.getItem("PI-KP");
}

function getKI(){
	return +localStorage.getItem("PI-KI");
}

function getW(){
	return +localStorage.getItem("PI-W");
}

function printPI(){
	console.log("PI-KP: " + localStorage.getItem("PI-KP"));
	console.log("PI-KI: " + localStorage.getItem("PI-KI"));
	console.log("PI-W: " + localStorage.getItem("PI-W"));
}

function updatePITextboxes(){
	document.getElementById("PI-KP-TEXTBOX").value = getKP()
	document.getElementById("PI-KI-TEXTBOX").value = getKI()
	document.getElementById("PI-WINDOW-TEXTBOX").value = getW()
}


// OML functions
function recordOML(){
	localStorage.setItem("SA", "OML")
	localStorage.setItem("OML-LR", document.getElementById("OML-LR-TEXTBOX").value);
}

function getLR(){
	return +localStorage.getItem("OML-LR");
}

function printOML(){
	console.log("OML-LR: " + localStorage.getItem("OML-LR"));
}

function updateOMLTextboxes(){
	document.getElementById("OML-LR-TEXTBOX").value = getLR()
}
