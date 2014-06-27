var qid = 1;
var source;
$(document).ready(function() {
    
    var url = 'http://localhost:8080/compile?query=A(x)+%3A-+R(x%2C3)&language=datalog&backend=clang';
// execute is unable to connect due to query.js checks with current myriaweb
//'http://localhost:8080/execute';
  // Retrieves compiled query to send to localserver to execute plan
  $.getJSON(url).success(function(json) {
      $('#info').text(json.plan);
      source = json.plan;

      var request = $.post("http://localhost:4444/cgi-bin/parser.py", {
	  qid: qid
      }).done(function (data) {
	  console.log(data);
      }).fail(function() {
	  console.log("failed")
      });


      var info = {"qid": qid, "plan": source};
      
/*      var request = $.ajax('http://localhost:13373', {
          type: "POST",
          datatype:"JSON",
          data: {
    "glossary": {
        "title": "example glossary",
		"GlossDiv": {
            "title": "S",
			"GlossList": {
                "GlossEntry": {
                    "ID": "SGML",
					"SortAs": "SGML",
					"GlossTerm": "Standard Generalized Markup Language",
					"Acronym": "SGML",
					"Abbrev": "ISO 8879:1986",
					"GlossDef": {
                        "para": "A meta-markup language, used to create markup languages such as DocBook.",
						"GlossSeeAlso": ["GML", "XML"]
                    },
					"GlossSee": "markup"
                }
            }
        }
    }
},
	  contentType: 'application/json',
          success: function(data, textStatus){
              console.log('success');
          }
      });
      request.error(function(jqXHR, textStatus, errorThrown) {
	  console.log(info);
	  console.log('err');
	  console.log(errorThrown);
      });

  }) 
    .fail(function(jqXHR, textStatus) {
	    $('#info').text(jqXHR.responseText);
    });*/

});   
});
