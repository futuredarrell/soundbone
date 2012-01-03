// TestCloud
// When ready...
(function () {

    var TestCloud, Tracks, Track, Controls, TrackView, Scrubber, App, app, Router, Screen,
        activate = ('createTouch' in document) ? 'touchstart' : 'click',
        hasTouch = ('createTouch' in document) ? true : false;

    window.TestCloud = TestCloud = {};

    App = Backbone.View.extend({
        initialize: function(){

            var self = this;

            self.screens = [];
            self.createScreen();

            self.currentView = null;

            // fake activity stream
            //self.stream = [5968824];
            self.stream = [5968824, 4456728, 291];
            //self.stream = [5968824, 4456728, 291, 31359980, 28377811, 25715240, 28925819, 28768833];
            self.tracks = new Tracks();

            self.settings = {
                autoplay: true
            };

            // load tracks at this point
            _.each(self.stream, function(value, index){
                self.tracks.add(new Track({'id': value}));
                console.log('adding!', value);
                if(index == 0){
                    // autoplay
                    // tracks.select(list[0]);
                };
            });

        },
        transitionTo: function(view){
            console.log('transition to', view);
            var width = $(window).width();
            var self = this;

            if(!self.currentView){
                console.log('no current view');
                self.currentView = view;
                view.render();
                $(view.el).appendTo(self.currentScreen());
                return false;
            } else {
                view.render();
                $(self.currentScreen()).css({
                    width: width,
                    float: 'left',
                    display: 'block'
                });

                $(self.createScreen()).css({
                    width: width,
                    float: 'left',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    // this could be a negative or positive
                    // depending on the transition
                    left: width 
                }).append(view.el);
                $('#container').css({
                    width: width * 2,
                    '-webkit-transform' : 'translate3d(' + -1 * width + 'px,0,0)',
                    '-webkit-transition' : '-webkit-transform .5s ease-out',
                    'overflow': 'hidden'
                });
                $('#container').bind('webkitTransitionEnd', function(e){
                    console.log('webkit end of transition');
                    console.log(e.srcElement == this);
                    if(e.srcElement === $('#container')[0]){
                        console.log('container switch');
                        var container = $('#container')[0];
                        var remove = container.childNodes[0];
                        container.removeChild(remove);
                        $('#container').attr('style', '');
                        $('.screen').attr('style', '');
                        $('#container').unbind('webkitTransitionEnd');
                        //$('#container').removeAttr('style');
                        self.screens = self.screens.slice(0,1);
                    }
                });   
            }
        },
        createScreen: function(){
            var screen = $('<div class="screen">').appendTo('#container')[0];
            this.screens.push(screen);
            return screen;
        },
        currentScreen: function(){
            return this.screens[0];
        }
    });

    Router = Backbone.Router.extend({
       routes: {
           '' : 'stream',
           'tracks/:id': 'track'
       },
       stream: function(){
           console.log('stream!', app);
           app.home = new Home();
           app.transitionTo(app.home);
       },
       track: function(id){
            // in a larger app we would throw up a throbber here
            // and check for a cached model
            console.log('track!!!');
            var track = app.tracks.get({'id':id});
            app.trackDetail = new TrackDetail({model:track});
            app.transitionTo(app.trackDetail);
       }
    });

    var Home = Backbone.View.extend({
        id: 'home',
        tagName: 'div',
        initialize: function(){

        },
        render: function(){
            var screen = app.currentScreen();
            screen.id = 'tracks';
            var trackView;
            var self = this;

            for(var i = 0, len = app.tracks.models.length; i < len; i++){
                (function(model){
                    trackView = new TrackView({model: model});
                    trackView.render();
                    trackView.el.id = 'track-' + model.id;
                    trackView.el.className = 'track';
                    self.el.appendChild(trackView.el);
                }(app.tracks.models[i]));
            }

            return this;
        }
    });

    var TrackDetail = Backbone.View.extend({
        id: 'trackDetail',
        tagName: 'div',
        render: function(){
            var screen = app.currentScreen();
            this.scrubber = new Scrubber({model: this.model});
            this.scrubber.render();
            $(this.scrubber.el).appendTo(this.el);

            // other view stuff here

            // decide if autoplay or not
            if(app.settings.autoplay) this.model.play();
            return this;
        },
        model: Track
    });

    Track = Backbone.Model.extend({
        localStorage: new Store('tracks'),
        initialize: function(){
            // set a load limit first ???
            this.set({'selected' : false});
            if(this.localStorage.find(this)){
                this.set(this.localStorage.find(this));
                new TrackView({model: this});
            } else {
                var self = this;
                SC.get('/tracks/' + self.id, function(data, error){
                    if(error) console.log('ERROR: ', error);
                    // set all the attributes locally
                    self.set(data);
                    self.save();
                    new TrackView({model: data});
                });
            }
        },
        play: function(){
            console.log('track play:', this, this.collection.currentTrack);
            this.collection.currentTrack.destruct();
            this.collection.currentTrack = this;
            var stream = this.load();
            console.log('stream before load', stream);
            stream.play();
            this.set({'selected' : true});
        },
        pause: function(){
            //console.log('track pause:', this);
            this.stream.togglePause();
        },
        load: function(){
            var self = this;
            if(this.stream && this.stream.playState === 1){
                return this.stream;
            } else {
                return this.stream = SC.stream(this.id, {
                    onplay: function(){
                        //self.trigger('play');
                        //self.timer = setInterval(_.bind(self.updateTime, self), 1000); 
                        this.onposition(10, function(){
                            console.log('stream reached 10');
                            self.trigger('play');
                        }); 
                    },
                    onfinish: function(){
                        self.collection.select('next');
                        self.trigger('finish');
                        //clearInterval(self.timer);
                        self.destruct();
                        console.log('destroying track');
                    },
                    onpause: function(){
                        self.trigger('pause');
                        //clearInterval(self.timer);
                    },
                    onresume: function(){
                        self.trigger('resume');
                        //self.timer = setInterval(_.bind(self.updateTime, self), 1000);
                    }
                });   
            }
        },
        destruct: function(){
            //if(self.timer) clearInterval(self.timer);
            if(this.stream) {
                this.stream.destruct();
            } else {
                console.log('no stream to destruct!');
            }
            this.set({'selected': false});
        }
    });

    Tracks = Backbone.Collection.extend({
        model: Track,
        initialize: function(){
            this.bind('add', function(obj){
                if(this.models.length == 1){
                    //console.log('set first', obj);
                    this.currentTrack = obj; 
                }
            })
        },
        select: function(obj){
            var index;
            if(typeof obj === 'number'){
                _.each(this.models, function(item, index, array){
                    //quick turn into a number
                    if(+item.id == obj){
                        app.router.navigate('tracks/' + this.models[index].id, true);
                        item.play();
                    }
                });
            };
            if(obj === 'next'){
                console.log('next')
                index = this.models.indexOf(this.currentTrack);
                if(index > -1 && index <= this.models.length - 2){
                    index += 1;
                    app.router.navigate('tracks/' + this.models[index].id, true);
                    this.models[index].play();
                }
            }; 
            if(obj === 'previous'){
                console.log('previous')
                index = this.models.indexOf(this.currentTrack);
                if(index > 0){
                    index -= 1;
                    app.router.navigate('tracks/' + this.models[index].id, true);
                    this.models[index].play();
                }
            };
        }
    });

    Controls = Backbone.View.extend({
        render: function(){
            $(this.el).append(this.template());
            return this;
        },
        events: {
            'click #previous': 'previous',
            'click #play': 'play',
            'click #next': 'next',
            'click #pause': 'pause'
        },
        play: function(){
            this.collection.currentTrack.play();
        },
        pause: function(){
            this.collection.currentTrack.pause();
        },
        previous: function(){
            this.collection.select('previous');
        },
        next: function(){
            this.collection.select('next');
        },
        template: Templates.Controls,
        id: 'controls',
        tagName: 'div',
        collection: Tracks,
        initialize: function(){
            this.render();
        }
    });

    Scrubber = Backbone.View.extend({
        className: 'scrubber',
        tagName: 'div',
        model: Track,
        initialize: function(){            
            var self = this;
            this.model.bind('play', function(){
                self.render();
                self.setScrubber(self.model.stream); 
            });
            this.model.bind('pause', function(){
                self.pauseScrubber(self.model.stream);
            });
            this.model.bind('resume', function(){
                self.setScrubber(self.model.stream);
            });
            this.model.bind('finish', function(){
                console.log('track finish from scrubber');
            });
        },
        setScrubber: function(stream){
            var self = this;
            console.log('set scrubber!');
            var duration = this.model.attributes.duration;
            var position = stream.position || 0;
            //console.log(stream.bytesLoaded, stream.bytesTotal, stream.bytesTotal / stream.bytesLoaded)
            setTimeout(function(){
                console.log($(self.el).find('.scrubber-knob'));
                $(self.el).find('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)',
                '-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);
        },
        pauseScrubber: function(stream){
            var duration = this.model.attributes.duration;
            var position = stream.position;
            $(self.el).find('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(' + (position/duration) * 100 + '%,0,0)',
                '-webkit-transition-duration': '0s'});
        },
        render: function(){
            var self = this;
            var track = this.model;
            console.log('scrubber render: ', track, this);
            $(this.el).html(self.template(track.toJSON()));
            $(this.el).find('.scrubber-control').bind(activate, function(e){
               e.preventDefault();
               self.pauseScrubber(self.model.stream);
            });
            $(this.el).find('.scrubber-control').bind('touchmove', function(e){
               e.preventDefault();
               $(this).css({
                   '-webkit-transform': 'translate3d(' + e.touches[0].screenX + 'px,0,0)'
               });
            });
            $(this.el).find('.scrubber-control').bind('touchend', function(e){
                // touchend has changedtouches on iphone
                // on android it may be different and we'll have to use touches like normal
                e.preventDefault();
                console.log(this);
                $(this).css({
                   '-webkit-transform': 'translate3d(' + e.changedTouches[0].screenX + 'px,0,0)'
                });

                var pos = e.changedTouches[0].screenX;
                var width = window.innerWidth;
                var duration = self.model.attributes.duration;
                
                //position * duration / width
                var newPos = Math.round((pos * duration) / width);
                self.model.stream.setPosition(newPos);
                self.setScrubber(self.model.stream);
            });
            return this;
        },
        template: Templates.Scrubber
    });

    //created when a new track model is created
    TrackView = Backbone.View.extend({
        className: 'track',
        tagName: 'div',
        initialize: function(){
            //console.log(this.model);
            //this.model.bind('change', this.render, this);
        },
        template: Templates.TrackView,
        render: function(){
            var self = this;
            console.log('TRACK RENDER THIS: ', this, this.el);
            //changes details of track, play icon
            $(this.el).html(this.template(this.model.toJSON()));

            if(this.model.get('selected')){
                $(this.el).addClass('selected');
            } else {
                $(this.el).removeClass('selected');
            }
                        
            $(this.el)[(hasTouch) ? 'tap' : 'click'](function(e){
                app.router.navigate('tracks/' + self.model.id, true);
                $(self.el).unbind((hasTouch) ? 'touchstart' : 'click');
            });
            
            return this;   
        },
        model: Track
    });

    TestCloud.init = function(){
        console.log('init');
        app = new App();
        app.router = new Router();
        Backbone.history.start({root: '/TestCloud/'});
        console.log(app);
    };
})();

