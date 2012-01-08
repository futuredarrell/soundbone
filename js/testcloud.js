// TestCloud
// When ready...
(function () {

    var TestCloud, Tracks, Track, Controls, TrackView, Scrubber, App, app, Router, Screen,
        Home, TrackDetail, Header, Comments,
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
            //self.stream = [5968824, 4456728, 291];
            self.stream = [5968824, 4456728, 291, 31359980, 28377811, 25715240, 28925819, 28768833];
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
        transitionTo: function(view, direction){
            console.log('transition to', view);
            var width = $(window).width();
            var self = this;
            var header = self.header;
            var trans = '';
            direction = direction || 1;
            trans = (direction === 1) ? '-100%' : '100%';
            
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
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    overflow: 'hidden'
                });
                var nextScreen = $(self.createScreen()).css({
                    width: width,
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    left: width * direction,
                    overflow: 'hidden' 
                });
                if(!view.rendered) view.render();
                header = new Header();
                header.update(view);
                $(header.el).appendTo(nextScreen); 
                $(nextScreen).append(view.el); 
                $('#container').css({
                    width: width,
                    '-webkit-transform' : 'translate3d(' + trans + ',0,0)',
                    '-webkit-transition' : '-webkit-transform .5s ease-out'
                });
                window.scrollTo(0, 1);
                $('#container').bind('webkitTransitionEnd', function(e){
                    if(e.srcElement === $('#container')[0]){
                        var container = $('#container')[0];
                        container.removeChild(container.childNodes[0]);
                        $('#container').attr('style', '');
                        $('.screen').attr('style', '');
                        $('#container').unbind('webkitTransitionEnd');
                        self.screens = self.screens.slice(0,1);
                        view.trigger('transitionEnd');
                        delete self.currentView;
                        self.currentView = view;
                    }
                });   
            }
        },
        createScreen: function(direction){
            var screen;
            screen = $('<div class="screen">').appendTo('#container')[0];
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
            var trackIndex = app.tracks.models.indexOf(track);
            var oldIndex;
            var direction = 1;
            if(app.trackDetail) {
                oldIndex = app.tracks.models.indexOf(app.trackDetail.model);
                if(oldIndex > trackIndex) {
                    direction = -1;
                }
                delete app.trackDetail;
            }
            app.trackDetail = new TrackDetail({model:track});
            app.transitionTo(app.trackDetail, direction);
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
            console.log('controls rendered!');
            return this;
        },
        events: {
            'click .previous': 'previous',
            'click .play': 'play',
            'click .next': 'next',
            'touchstart .previous': 'previous',
            'touchstart .play': 'play',
            'touchstart .next': 'next'
        },
        updateControl: function(){
            console.log('update control ', this.status, this.model.stream.position);
            if(this.status === 'paused'){
                this.$('.play').removeClass('pause');
            } else {
                this.$('.play').addClass('pause');
            }
        },
        updateTime: function(){
            var stream = this.model.stream;
            var self = this;

            if(stream.playState === 1 && !stream.paused){
                this.$('.track-current').html(self.formatTime(stream.position));
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
        className: 'controls',
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
                self.$('.track-duration').html(self.formatTime(self.model.get('duration')));
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
                this.$('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)',
                '-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);
        },
        pauseScrubber: function(){
            //console.log('pause scrubber!');
            var stream = this.model.stream;
            var position = stream.position;
            var duration = this.model.attributes.duration;
            this.$('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(' + (position/duration) * 100 + '%,0,0)',
                '-webkit-transition-duration': '0s'});
        },
        render: function(){
            var self = this;
            var track = this.model;
            //console.log('scrubber render: ', track, this);
            $(this.el).html(self.template(track.toJSON()));
            this.$('.scrubber-control').bind('touchstart', function(e){
               e.preventDefault();
               self.pauseScrubber();
            });
            this.$('.scrubber-control').bind('touchmove', function(e){
               e.preventDefault();
               $(this).css({
                   '-webkit-transform': 'translate3d(' + e.touches[0].screenX + 'px,0,0)'
               });
            });
            this.$('.scrubber-control').bind('touchend', function(e){
                // touchend has changedtouches on iphone
                // on android it may be different
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
            console.log('scrubber rendered!');
            return this;
        },
        template: Templates.Scrubber
    });

    Header = Backbone.View.extend({
        className: 'app-header',
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
            this.$('.header-title').html(title);
            this.$('.header-right').html(headerRight);
        },
        template: _.template('<div class="header-left"></div><h1 class="header-title"></h1><div class="header-right"></div>')
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
        className: 'track-detail',
        tagName: 'div',
        headerRight: function(){
            var el = $('<a class="icon" href="#">♫</a>').bind('click', function(){
                app.router.navigate('', true);
            });
            return el;
        },
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

            if(this.model.get('comment_count') > 0) {
              console.log('comment count', this.model.get('comment_count'));
              this.comments = new Comments({model: this.model});
              this.comments.render();
              $(this.comments.el).appendTo(this.el);
            };

            // other view stuff here

            // decide if autoplay or not
            if(app.settings.autoplay) this.model.play();
            return this;
        },
        model: Track
    });

    TrackMeta = Backbone.View.extend({
        className: 'track-meta',
        tagName: 'div',
        initialize: function(){
            this.rendered = false;
        },
        render: function(){
            this.rendered = true;
            var self = this;
            $(this.el).append(this.template(this.model.toJSON()));
            $(this.el).swipeLeft(function(){
                self.model.collection.select('next');
            });
            $(this.el).swipeRight(function(){
                self.model.collection.select('previous');
            });
            console.log('track meta rendered!');
            return this;   
        },
        template: Templates.TrackMeta,
        model: Track 
    });

    Comments = Backbone.View.extend({
        className: 'track-comments',
        tagName: 'div',
        model: Track,
        initialize: function(){
            this.offset = 0;
            this.limit = 20;
        },
        render: function(){
            var self = this;
            $(self.el).append(self.template());
            return this;
        },
        events: {
            'click .load-comments' : 'load',
        },
        load: function(e){
            var self = this;
            e.preventDefault();
            console.log('LOAD COMMENTS');
            $(self.el).append('<div id="track-' + self.model.id + '-comments" class="loading">Loading ... </div>');
            var self = this;
            SC.get('/tracks/' + self.model.id + '/comments', {limit: 20, offset: self.offset}, function(data, error){
                var el = $('#track-' + self.model.id + '-comments')[0];
                $('#track-' + self.model.id + '-comments')[0].parentNode.removeChild(el);
                if(error) console.log('ERROR: ', error);
                console.log('COMMENTS DATA: ', data);
                // set all the attributes locally
                //self.set(data);
                //self.save();
                self.update(data);
                self.offset += self.limit;
            });
        },
        update: function(data){
            //update ui, save comments to storage
            var self = this;
            //var el = $('#track-' + self.model.id + '-comments');
            $('.load-comments').html('Load 20 More Comments');
            var template = _.template('<div id="comment-<%= id %>" class="comment"><p><%= body %></p><div class="comment-meta"><%= user.username %><img src="<%= user.avatar_url %>" width="20" height="20" /></div></div>');
            _.each(data, function(obj){
                $('.load-comments').before(template(obj));
                //$('#track-' + self.model.id + '-comments').append(template(obj));
            });
        },
        template: _.template('<a href="javascript: void(0)" class="load-comments">Load Comments</a>')
    });

    TestCloud.init = function(){
        console.log('init');
        app = new App();
        app.router = new Router();
        Backbone.history.start({root: '/TestCloud/'});
        console.log(app);
    };
})();

