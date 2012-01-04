// TestCloud
// When ready...
(function () {

    var TestCloud, Tracks, Track, Controls, TrackView, Scrubber, App, app, Router, Screen,
        Home, TrackDetail,
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
                $(self.currentScreen()).css({
                    width: width,
                    float: 'left',
                    display: 'block'
                });
                var nextScreen = $(self.createScreen()).css({
                    width: width,
                    float: 'left',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    // this could be a negative or positive
                    // depending on the transition
                    left: width 
                });
                if(!view.rendered){
                    view.render();
                    $(nextScreen).append(view.el);
                } else {
                    $(nextScreen).html(view.el);
                }
                $('#container').css({
                    width: width * 2,
                    '-webkit-transform' : 'translate3d(' + -1 * width + 'px,0,0)',
                    '-webkit-transition' : '-webkit-transform .5s ease-out',
                    'overflow': 'hidden'
                });
                $('#container').bind('webkitTransitionEnd', function(e){
                    if(e.srcElement === $('#container')[0]){
                        var container = $('#container')[0];
                        container.removeChild(container.childNodes[0]);
                        $('#container').attr('style', '');
                        $('.screen').attr('style', '');
                        $('#container').unbind('webkitTransitionEnd');
                        self.screens = self.screens.slice(0,1);
                        view.trigger('transitionEnd');
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
           //console.log('stream!', app);
           //console.log('app.home!!', app.home);
           if(app.home){
                console.log('dont create new!');
                app.transitionTo(app.home);
           } else {
                console.log('create new!!!');
               app.home = new Home();
               app.transitionTo(app.home);
           }
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
                        this.onposition(100, function(){
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
            this.trigger('destruct');
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
            this.rendered = true;
            $(this.el).append(this.template());
            return this;
        },
        events: {
            'click #previous': 'previous',
            'click #play': 'play',
            'click #next': 'next'
        },
        play: function(e){
            e.preventDefault();
            var track = this.collection.currentTrack;
            switch(this.status){
                case 'playing':
                    this.status = 'paused';
                    //console.log(status, ' so pause track!');
                    track.pause();
                    $('#play').html('unpause');
                break;
                case 'paused':
                    this.status = 'resumed';
                    //console.log(status, ' so play track!');
                    track.pause();
                    $('#play').html('pause');
                break;
                case 'resumed':
                    this.status = 'playing';
                    //console.log(status, ' so pause track!');
                    $('#play').html('pause');
                    track.pause();
                break;
                default:
                    console.log(status, ' so play track!');
                    track.play();
                break;
            }            
        },
        previous: function(e){
            e.preventDefault();
            this.collection.select('previous');
        },
        next: function(e){
            e.preventDefault();
            this.collection.select('next');
        },
        template: Templates.Controls,
        id: 'controls',
        tagName: 'div',
        collection: Tracks,
        initialize: function(){
            var self = this;
            // it bubbles up
            var track = this.collection;
            this.rendered = false;
            this.status = null;

            // these listeners are to protect
            // against button hits while the 
            // track is buffering or loading
            track.bind('play', function(){
                self.status = 'playing';
                $('#play').html('pause');
            });
            track.bind('pause', function(){
                self.status = 'paused';
                $('#play').html('unpause');
            });
            track.bind('resume', function(){
                self.status = 'resumed';
                $('#play').html('pause');
            });
        }
    });

    Scrubber = Backbone.View.extend({
        className: 'scrubber',
        tagName: 'div',
        model: Track,
        initialize: function(){            
            var self = this;
            this.model.bind('play', function(){
                self.setScrubber(); 
            });
            this.model.bind('pause', function(){
                self.pauseScrubber();
            });
            this.model.bind('resume', function(){
                self.setScrubber();
            });
            this.model.bind('finish', function(){
                console.log('track finish from scrubber');
            });
        },
        setScrubber: function(){
            console.log('set scrubber!');
            var self = this;
            var stream = self.model.stream;
            var duration = self.model.attributes.duration;
            var position = stream.position || 0;
            //console.log(stream.bytesLoaded, stream.bytesTotal, stream.bytesTotal / stream.bytesLoaded)
            setTimeout(function(){
                console.log($(self.el).find('.scrubber-knob'));
                $(self.el).find('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)',
                '-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);
        },
        pauseScrubber: function(){
            console.log('pause scrubber!');
            var stream = this.model.stream;
            var position = stream.position;
            var duration = this.model.attributes.duration;
            $(this.el).find('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(' + (position/duration) * 100 + '%,0,0)',
                '-webkit-transition-duration': '0s'});
        },
        render: function(){
            var self = this;
            var track = this.model;
            //console.log('scrubber render: ', track, this);
            $(this.el).html(self.template(track.toJSON()));
            $(this.el).find('.scrubber-control').bind('touchstart', function(e){
               e.preventDefault();
               self.pauseScrubber();
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
            this.rendered = false;
            var self = this;
            this.model.bind('change', function(){
                self.mark();
            });
        },
        template: Templates.TrackView,
        mark: function(){
            var self = this;
            if(self.model.get('selected')){
                $(self.el).addClass('selected');
            } else {
                $(self.el).removeClass('selected');
            }
        },
        render: function(){
            var self = this;
            this.rendered = true;
            //console.log('TRACK RENDER THIS: ', this, this.el);
            //changes details of track, play icon
            $(this.el).html(this.template(this.model.toJSON()));

            // uses zeptos tap binding if a touch device
            $(this.el)[(hasTouch) ? 'tap' : 'click'](function(e){
                app.router.navigate('tracks/' + self.model.id, true);
                $(self.el).unbind((hasTouch) ? 'touchstart' : 'click');
            });
            self.mark();
            return this;   
        },
        model: Track
    });

    Home = Backbone.View.extend({
        id: 'home',
        tagName: 'div',
        initialize: function(){
            this.rendered = false;
        },
        render: function(){
            this.rendered = true;
            var screen = app.currentScreen();
            screen.id = 'tracks';
            var trackView;
            var self = this;
            _.each(app.tracks.models, function(model){
                trackView = new TrackView({model: model});
                trackView.render();
                trackView.el.id = 'track-' + model.id;
                trackView.el.className = 'track';
                self.el.appendChild(trackView.el);
            });
            return this;
        }
    });

    TrackDetail = Backbone.View.extend({
        id: 'trackDetail',
        tagName: 'div',
        initialize: function(){
            this.rendered = false;  
        },
        render: function(){
            this.rendered = true;

            console.log('this.controls', this.controls);
            console.log('this.scrubber', this.scrubber);

            this.scrubber = new Scrubber({model: this.model});
            this.controls = new Controls({collection: app.tracks});
            
            this.scrubber.render();
            this.controls.render();
            
            $(this.scrubber.el).appendTo(this.el);
            $(this.controls.el).appendTo(this.el);

            // other view stuff here

            // decide if autoplay or not
            if(app.settings.autoplay) this.model.play();
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

