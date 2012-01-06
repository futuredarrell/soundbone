// TestCloud
// When ready...
(function () {

    var TestCloud, Tracks, Track, Controls, TrackView, Scrubber, App, app, Router, Screen,
        Home, TrackDetail, Header,
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
            self.header = new Header();

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
            var header = self.header;

            if(!self.currentView){
                console.log('no current view');
                self.currentView = view;
                view.render();
                $(header.el).appendTo(self.currentScreen());
                header.update(view);
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
                if(!view.rendered) view.render();
                $(header.el).appendTo(nextScreen);
                header.update(view);   
                $(nextScreen).append(view.el);

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
                        app.currentView = view;
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
            if(app.trackDetail) delete app.trackDetail;
            app.trackDetail = new TrackDetail({model:track});
            app.transitionTo(app.trackDetail);
       }
    });

    Track = Backbone.Model.extend({
        localStorage: new Store('tracks'),
        initialize: function(){
            // set a load limit first ???

            // TODO: rework this so that
            // trackview is loaded immediately
            // and then once trackview gets a
            // success or error it updates the view

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
                        this.onposition(100, function(){
                            console.log('stream reached 10');
                            self.trigger('play');
                        }); 
                    },
                    onfinish: function(){
                        self.collection.select('next');
                        self.trigger('finish');
                        self.destruct();
                        console.log('destroying track');
                    },
                    onpause: function(){
                        self.trigger('pause');
                    },
                    onresume: function(){
                        self.trigger('resume');
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
            var self = this;
            $(this.el).append(this.template(this.model.toJSON()));
            return this;
        },
        events: {
            'click #previous': 'previous',
            'click #play': 'play',
            'click #next': 'next'
            /*'touchstart #previous': 'previous',
            'touchstart #play': 'play',
            'touchstart #next': 'next'*/
        },
        updateControl: function(){
            console.log('update control ', this.status, this.model.stream.position);
            if(this.status === 'paused'){
                $('#play').removeClass('pause');
            } else {
                $('#play').addClass('pause');
            }
        },
        updateTime: function(){
            var stream = this.model.stream;
            var self = this;

            if(stream.playState === 1 && !stream.paused){
                $('.track-current').html(self.formatTime(stream.position));
                setTimeout(_.bind(self.updateTime, self), 900);
            }
        },
        play: function(e){
            e.preventDefault();
            var track = this.model;
            switch(this.status){
                case 'playing':
                    this.status = 'paused';
                    console.log('CASE PLAYING');
                    track.pause();
                    this.updateControl();
                break;
                case 'paused':
                    this.status = 'resumed';
                    console.log('CASE PAUSED');
                    track.pause();
                    this.updateControl();
                break;
                case 'resumed':
                    console.log('CASE RESUMED');
                    this.status = 'playing';
                    track.pause();
                    this.updateControl();
                break;
                default:
                    console.log(status, ' DEFAULT so play track!');
                    track.play();
                    this.updateControl();
                break;
            }            
        },
        previous: function(e){
            e.preventDefault();
            this.model.collection.select('previous');
        },
        next: function(e){
            e.preventDefault();
            this.model.collection.select('next');
        },
        formatTime: function(time){
            var seconds = Math.floor(time / 1000)
            var minutes = Math.floor(seconds / 60);
            seconds = ((seconds % 60) < 10) ? '0' + seconds % 60 : seconds % 60;
            minutes = (minutes < 60) ? '0'+ minutes : minutes;
            return (minutes + ':' + seconds);
        },
        template: Templates.Controls,
        id: 'controls',
        tagName: 'div',
        model: Track,
        initialize: function(){
            var self = this;
            var track = this.model;
            this.rendered = false;
            this.status = null;

            // these listeners are to protect
            // against button hits while the 
            // track is buffering or loading
            track.bind('play', function(){
                $('.track-duration').html(self.formatTime(self.model.get('duration')));
                self.status = 'playing';
                self.updateControl();
                self.updateTime();
            });
            track.bind('pause', function(){
                self.status = 'paused';
                self.updateControl();
            });
            track.bind('resume', function(){
                self.status = 'resumed';
                self.updateControl();
                self.updateTime();
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
            //console.log('set scrubber!');
            var self = this;
            var stream = self.model.stream;
            var duration = self.model.attributes.duration;
            var position = stream.position || 0;
            //console.log(stream.bytesLoaded, stream.bytesTotal, stream.bytesTotal / stream.bytesLoaded)
            setTimeout(function(){
                //console.log($(self.el).find('.scrubber-knob'));
                $(self.el).find('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)',
                '-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);
        },
        pauseScrubber: function(){
            //console.log('pause scrubber!');
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
                //console.log(this);
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

    Header = Backbone.View.extend({
        id: 'app-header',
        tagName: 'header',
        initialize: function(){
            this.render();
        },
        render: function(){
            var self = this;
            $(self.el).append(self.template());
            return this;
        },
        update: function(view){
            //accepts a view and takes its attributes
            var title = view.title || '';
            var headerRight = view.headerRight || '';
            $('#header-title').html(title);
            $('#header-right').html(headerRight);
        },
        template: _.template('<div id="header-left"></div><h1 id="header-title"></h1><div id="header-right"></div>')
    });

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
        title: '&#9729;',
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
        headerRight: _.template('<a class="icon" href="/TestCloud/">♫</a>'),
        initialize: function(){
            this.rendered = false;
            var self = this;
        },
        render: function(){
            this.rendered = true;
            console.log('this.controls', this.controls);
            console.log('this.scrubber', this.scrubber);

            this.title = '' + this.model.get('title').slice(0, 16).concat(' ...');

            this.scrubber = new Scrubber({model: this.model});
            this.controls = new Controls({model: this.model});
            this.meta = new TrackMeta({model: this.model});
            
            this.scrubber.render();
            this.controls.render();
            this.meta.render();
            
            $(this.scrubber.el).appendTo(this.el);
            $(this.controls.el).appendTo(this.el);
            $(this.meta.el).appendTo(this.el);

            // other view stuff here

            // decide if autoplay or not
            if(app.settings.autoplay) this.model.play();
            return this;
        },
        model: Track
    });

    TrackMeta = Backbone.View.extend({
        id: 'trackMeta',
        tagName: 'div',
        initialize: function(){
            this.rendered = false;
        },
        render: function(){
            this.rendered = true;
            $(this.el).append(this.template(this.model.toJSON()));
            return this;   
        },
        template: Templates.TrackMeta,
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

