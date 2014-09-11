var editorBackendKey = 'myria',
    backendProcess = 'myria';

function updateBackend() {
  backendProcess = $(".backend-menu option:selected").val();
  changeLinks(backendProcess);
  changeConnection(backendProcess);
  changeUrl(backendProcess);
}

function changeUrl(backend) {
  $("#projecturl").empty();
  var request = $.post("page", {
    backend: backendProcess
  });
  request.success(function (data) {
    $("#projecturl").attr("href", JSON.parse(data).backendUrl);
  });
  if (backend === "myriamultijoin") {
    backend = "myria";
  }
  var urlname = backend.charAt(0).toUpperCase() + backend.slice(1);
  $("#projecturl").html(urlname + ' Project');
}

function changeLinks(backend) {
  var backends = [ 'myria', 'grappa', 'clang', 'myriamultijoin'];
  if (!_.contains(backends, backend)) {
    console.log('Backend not supported: ' + backend);
    return;
  }

  $('.backends').each(function () {
    var href = $(this).attr('href');
    var newhref;
    if (href.indexOf('?') === -1) {
      newhref = href + '?backend=' + backend;
    } else {
      newhref = href.replace(/backend=[\w]+/, 'backend=' + backend);
    }
    $(this).attr('href', newhref);
  });
}

function changeConnection(backend) {
  $("#connectionstr").empty();
  var request = $.post("page", {
    backend: backendProcess
  });
  request.success(function (data) {
    var d = JSON.parse(data);
    $("#connectionstr").append('<a href="' + d.connection + '/workers" target="_blank">' + d.connectionString + '</a>');
  });
}

$(function() {
  //warn if not in Chrome
  if (!window.chrome) {
    $("#page-body").prepend('<div class="alert alert-danger alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button><strong>Warning!</strong> Myria is developed and tested in Google Chrome, and other browsers may not support all the features.</div>');
  }


  $(".backend-menu").change(updateBackend);
  var backendProcess = localStorage.getItem(editorBackendKey);
  restoreState();
  changeLinks(backendProcess);
  changeConnection(backendProcess);
  changeUrl(backendProcess);

  //warn if backend is not available
  if (connectionString.indexOf('error') === 0) {
    $("#page-body").prepend('<div class="alert alert-danger alert-dismissible" role="alert"><strong>Error!</strong> Unable to connect to Myria. Most functionality will not work.</div>');
  }

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
