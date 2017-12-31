/*global require*/
/*
 * Bootstrap-based responsive mashup
 * @owner Erik Wetterberg (ewg)
 */
/*
 *   Todo:
 *  display title of object that has been kommented on
 *
 */
// counter for rows
var rowNumber = 1;
var apiServer = "http://pcm.itellidemo.dk/commentService/";

var request = {};
var today = new Date();
// get last month
var lastmonth = new Date(today.getFullYear(),-1,-1);
request['year'] =  lastmonth.getFullYear().toString();
request['month'] = lastmonth.getMonth().toString();

var prefix = '/';
var config = {
    host: 'qs.itellidemo.dk',
    prefix: prefix,
    port: window.location.port,
    isSecure: window.location.protocol === "https:"
};

require.config({
    baseUrl: (config.isSecure ? "https://" : "http://") + config.host + (config.port ? ":" + config.port : "") + config.prefix + "resources"
});


require(["js/qlik"], function(qlik) {

    $("#closeerr").on('click', function() {
        $("#errmsg").html("").parent().hide();
    });
    qlik.setOnError(function(error) {
        $("#errmsg").append("<div>" + error.message + "</div>").parent().show();
    });


    //
    function AppUi(app) {
        var me = this;
        this.app = app;
        app.global.isPersonalMode(function(reply) {
            me.isPersonalMode = reply.qReturn;
        });
        app.getAppLayout(function(layout) {
            //console.log(layout);
            $("#title").html(layout.qTitle);
            $("#title").on("click", function() {
                window.open('http://qs.itellidemo.dk/sense/app/' + layout.qFileName, 'qlik');
            });
            $("#title").attr("title", "Last reload:" + layout.qLastReloadTime.replace(/T/, ' ').replace(/Z/, ' '));
            //TODO: bootstrap tooltip ??
        });
        app.getList('SelectionObject', function(reply) {
            $("[data-qcmd='back']").parent().toggleClass('disabled', reply.qSelectionObject.qBackCount < 1);
            $("[data-qcmd='forward']").parent().toggleClass('disabled', reply.qSelectionObject.qForwardCount < 1);
        });
        app.getList("BookmarkList", function(reply) {
            var str = "";
            reply.qBookmarkList.qItems.forEach(function(value) {
                if (value.qData.title) {
                    str += '<li><a href="#" data-id="' + value.qInfo.qId + '">' + value.qData.title + '</a></li>';
                }
            });
            str += '<li><a href="#" data-cmd="create">Create</a></li>';
            $('#qbmlist').html(str).find('a').on('click', function() {
                var id = $(this).data('id');
                if (id) {
                    app.bookmark.apply(id);
                } else {
                    var cmd = $(this).data('cmd');
                    if (cmd === "create") {
                        $('#createBmModal').modal();
                    }
                }
            });
        });
        $("[data-qcmd]").on('click', function() {
            var $element = $(this);
            switch ($element.data('qcmd')) {
                //app level commands
                case 'clearAll':
                    app.clearAll();
                    break;
                case 'back':
                    app.back();
                    break;
                case 'forward':
                    app.forward();
                    break;
                case 'lockAll':
                    app.lockAll();
                    break;
                case 'unlockAll':
                    app.unlockAll();
                    break;
                case 'createBm':
                    var title = $("#bmtitle").val(),
                        desc = $("#bmdesc").val();
                    app.bookmark.create(title, desc);
                    $('#createBmModal').modal('hide');
                    break;
                case 'reload':
                    if (me.isPersonalMode) {
                        app.doReload().then(function() {
                            app.doSave();
                        });
                    } else {
                        qlik.callRepository('/qrs/app/' + app.id + '/reload', 'POST').success(function(reply) {
                            //TODO:handle errors, remove alert
                            alert("App reloaded");
                        });
                    }
                    break;
            }
        });
    }
    var app = qlik.openApp('e04ecb62-cc37-4b2a-9ea5-faa3203f6adf', config);

    app.getObject('Filter-01', 'bLLUsDg');
    app.getObject('Filter-02', 'CAvwmkV');
    app.getObject('Filter-03', 'xHeZc');
    app.getObject('Filter-04', 'sjmwqdz');
    app.getObject('qlik-status-message', 'JJsSKn');
    //create cubes and lists -- inserted here --
    if (app) {
        new AppUi(app);
    }
    //	select default selection
    app.field('FiscalMonth').selectValues([request['month']], false, true);
    app.field('Fiscal Year').selectValues([request['year']], false, true);

    app.createGenericObject({
            shortname: {
                qStringExpression: '=OSUSER()'
            },
            area: {
                qStringExpression: "=('holbæk')"
            },
            department: {
                qStringExpression: "=('holbæk')"
            } //use =maxtring()
        })
        .then(model => {
            // do some selections via app.field etc
            request['department'] = model.layout.department;
            request['area'] = model.layout.area;
            useridParts = model.layout.shortname.split(' ');

            request['ShortName'] = useridParts[0].split('=').pop().split(';').shift() + '\\' + useridParts[1].split('=').pop().split(';').shift();

            model = null; // removing the model
            // pass paramters to json and get respons to render
            getUserConfiguration();

        })


    /* add listener to detect if selection changes */
    var selState = app.selectionState();
    var listener = function() {
      // get current selections
      app.createGenericObject({
              year: {
                  qStringExpression: "=Max([Fiscal Year])"
              },
              month: {
                  qStringExpression: "=Num(Max([FiscalMonth]),'00')"
              } //use =maztring()
          })
          .then(model => {
              // do some selections via app.field etc
              request['year'] = model.layout.year;
              request['month'] = model.layout.month;
              // YYYY-MM-DD
              request['period'] = request['year']+'-'+request['month']+'-01';
              model = null; // removing the model
              renderComments();
          })
    };
    // bind function to selection state
   selState.OnData.bind(listener);

    function renderPage(configuration) {
        $('#user').html(configuration.ShortName);
        // api returns a comma seperated list
        var QSObjID = configuration.QSObjID.split(';');
        $.each(QSObjID, function(row, value) {
          app.getObjectProperties(value).then(function(model){
            // var title = model.properties.title;
            $('#main').append(renderRow(rowNumber,model.properties.title, value));
            app.getObject('Qlik-' + rowNumber, value);
            rowNumber++;

            });
        });

        //renderComments();
    };
    setTimeout(function(){
      // the wait until everything is rendered
      // the we request th comments, we do this because the get comments based on data attr of textbox
      // hook save funtion
      $(".saveToApi").on("click", function() {
          var elementId = $(this).attr('id');
          $('#' + elementId).addClass('disabled');
          saveComment(elementId);
      });
      $('.comment-form').on('keyup', function() {
          var elementId = $(this).attr('id');
          var maxLength = $(this).attr('maxlength');
          var length = $(this).val().length;
          $('#' + elementId.replace('Comment-', 'Save-')).removeClass('disabled');
          $('#' + elementId.replace('Comment-', 'Message-')).html(maxLength - length + ' tegn tilbage');
      });
      renderComments();

    }, 2000);


    function renderRow(counter, title, qsId) {
        var html = '<div class="row" id="Row-' + counter + '" data-qsid=' + qsId + '>';
        html += '<div class="col-sm-8 qvobject" id="Qlik-' + counter + '">Loading...</div>';
        html += '<div class="col-sm-4 textarea" id="Text-' + counter + '">';
        html += '<div class="form-group">';
        html += '<label for="comment">Kommentar:</label>';
        html += '<textarea class="form-control comment-form" rows="10" maxlength="255" id="Comment-' + counter + '"  data-qsid=' + qsId + '></textarea>';
        html += '<button type="button" class="btn btn-primary disabled saveToApi" id="Save-' + counter + '" data-title="'+title+'"> Gem </button>';
        html += '<span class="message-form" id="Message-' + counter + '"></span>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        return html;
    };
    function renderComments () {
      $('.comment-form').each(function(index, value) {
         var QSObjID = $('#' + this.id.replace('Comment-', 'Row-')).data('qsid');
           getComment(this.id,request['ShortName'],QSObjID , '');
       });
    };
    function statusMessage(message, status) {
        html = '<div class="alert alert-success alert-dismissable" id="Status-' + rowNumber + '">';
        html += '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>';
        html += '<strong>' + status + '</strong> ' + message;
        html += '</div>';
        $("#status-message").append(html);
        $("#Status-" + rowNumber).delay(2000).fadeOut();
        rowNumber++;
    };

    function getComment(elementid,ShortName, QSObjID, Selections) {
        var data = {  ShortName: 'itellidemo\\tse$',
                      QSObjID: QSObjID	,
                    	Omrade :   request['area'] ,
                      Afdeling :  request['department'] ,
                      Period: request['period']
                };
        $.ajax({
           url: apiServer+"api/GetUserComment",
           type: 'POST',
           data:  JSON.stringify(data),
           dataType: 'json',
           contentType: 'application/json',
           crossDomain: true,
           cache: false,
       success: function (data) {
          $('#' + elementid).val(data.Text);
          console.log(data);
          if (data.Locked==1) {
          //  $('#' + elementid).attr('disabled',true);
          }
        }
        });
    };

    function saveComment(elementId) {
        // UserID,QSObjID,Selections
        var title = $('#' + elementId).data('title');
        var QSObjID = $('#' + elementId.replace('Save-', 'Row-')).data('qsid');
        var comment = $('#' + elementId.replace('Save-', 'Comment-')).val();
      //  localStorage.setItem('Comment-' + QSObjID, comment);

        var data = {  ShortName: 'itellidemo\\tse$',
                      QSObjID: QSObjID	,
                      Text: comment,
                    	Omrade :   request['area'] ,
                      Afdeling :  request['department'] ,
                      Period: request['period']
                };
        $.ajax({
           url: apiServer+"api/SaveUserComment",
           type: 'POST',
           data:  JSON.stringify(data),
           dataType: 'json',
           contentType: 'application/json',
           crossDomain: true,
           cache: false,
       success: function (data) {
          //$('#' + elementid).val(data);
          statusMessage('Kommentaren til "'+title+'" er: '+data, 'Gemt!')
        }
        });
//        statusMessage('Kommentaren til "'+title+'" er blevet gemt', 'Gemt!')
    };

    function getUserConfiguration() {
        var user = { ShortName: 'itellidemo\\tse$'  };
        $.ajax({
           url: apiServer+"api/GetUserConfig",
           type: 'POST',
           data:  JSON.stringify(user),
           dataType: 'json',
           contentType: 'application/json',
           crossDomain: true,
           cache: false,
       success: function (data) {
          renderPage( data );
        }
        });
    }
});
