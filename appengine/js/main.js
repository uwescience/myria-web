

$(function() {
  jQuery.timeago.settings.allowFuture = true;

  Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
  }

  //warn if not in Chrome
  if (!window.chrome) {
    $("#page-body").prepend('<div class="alert alert-danger alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button><strong>Warning!</strong> Myria is developed and tested in Google Chrome, and other browsers may not support all the features.</div>');
  }

  //warn if backend is not available
  if (connectionString.indexOf('error') === 0) {
    $("#page-body").prepend('<div class="alert alert-danger alert-dismissible" role="alert"><strong>Error!</strong> Unable to connect to Myria. Most functionality will not work.</div>');
  }

  var apiKey = "AIzaSyCIB8MWWVeix26boS_WLJGmW41A9oNj8fw";
  var calId = "cs.washington.edu_i1gk4il65dj31mcfgid1t9t1o8@group.calendar.google.com";

  // warn if there are experiments running
  $.ajax({
    url: "https://www.googleapis.com/calendar/v3/freeBusy?key=" + apiKey,
    type: "POST",
    data: JSON.stringify({
      "timeMin": (new Date().addHours(-100)).toISOString(),
      "timeMax": (new Date().addHours(100)).toISOString(),
      "timeZone": "UTC",
      "items": [
        {
          "id": calId
        }
      ]
    }),
    contentType: "application/json; charset=utf-8",
    dataType: "json",
    success: function(data){
      var now = new Date(),
          later = (new Date()).addHours(3);

      // filter by overlap with now and later
      var busy = _.filter(data.calendars[calId].busy, function(b) {
        var start = new Date(b.start),
            end = new Date(b.end);
        return start < later && end > now;
      });

      if (busy.length > 0) {
        var times = [];
        _.forEach(busy, function(el) {
          times.push('<abbr class="timeago" title="' + el.start + '">' + el.start + '</abbr> to <abbr class="timeago" title="' + el.end + '">' + el.end + '</abbr>')
        });
        $("#page-body").prepend('<div class="alert alert-warning alert-dismissible" role="alert"><strong>Cluster is reserved or will be reserved very soon</strong>. Please don\'t use the cluster during the following times: ' + times.join(' and ') + '. For more information, check the <a href="https://www.google.com/calendar/embed?src=cs.washington.edu_i1gk4il65dj31mcfgid1t9t1o8%40group.calendar.google.com&ctz=America/Los_Angeles">calendar</a></div>');
        jQuery("abbr.timeago").timeago();
      }
    }
  });

  //back to top button
  var offset = 220;
  var duration = 300;
  $('.back-to-top').hide();
  $(window).scroll(function() {
    if ($(this).scrollTop() > offset) {
      $('.back-to-top').fadeIn(duration);
    } else {
      $('.back-to-top').fadeOut(duration);
    }
  });

  $('.back-to-top').click(function(event) {
    event.preventDefault();
    $('html, body').animate({scrollTop: 0}, duration);
    return false;
  });

  $("[data-toggle=tooltip]").tooltip();

  $("abbr.timeago").timeago();
});
