//select the tier provided
function tierSelect(tierNumber) {
localStorage.setItem("tier", tierNumber);
}

function recordRL(alpha, beta){
	localStorage.setItem("RL-alpha", document.getElementById("RL-ALPHA-TEXTBOX").value);
	localStorage.setItem("RL-beta", document.getElementById("RL-BETA-TEXTBOX").value);
}

function recordPI(kp, ki){
	localStorage.setItem("PI-KP", document.getElementById("PI-KP-TEXTBOX").value);
	localStorage.setItem("PI-KI", document.getElementById("PI-KI-TEXTBOX").value);
}

function recordOML(lr){
	localStorage.setItem("OML-LR", document.getElementById("OML-LR-TEXTBOX").value);
}

function printRL(){
	console.log(localStorage.getItem("RL-alpha"));
	console.log(localStorage.getItem("RL-beta"));
}


function printTier(){
	return localStorage.getItem("tier");
}