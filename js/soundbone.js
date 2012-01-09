(function () {

    var soundbone
      // a larger view class that manages transitions
      // and all the other subvies
      , App
      // this is an exposed instance of our app
      , app
      , Router
      // our collection of tracks
      , Tracks
      // a single track model
      , Track
      // the only view with View until I can think of better
      , TrackView
      // view modules
      , Home
      , Controls
      , Scrubber
      , Screen
      , TrackDetail
      , Header
      , Comments
      , hasTouch = ('createTouch' in document) ? true : false;

    window.soundbone = soundbone = {};

    App = Backbone.View.extend({
        initialize: function(){

            var self = this;

            // prepare screens that can be transitioned between
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
            // in a non-prototype this could happen in
            // many different ways
            _.each(self.stream, function(value, index){
                self.tracks.add(new Track({'id': value}));
            });
        },
        transitionTo: function(view, direction){
           // console.log('transition to', view);
            var width = $(window).width();
            var self = this;
            var header = self.header;
            var trans = '';
            direction = direction || 1;
            trans = (direction === 1) ? '-100%' : '100%';

            if(!self.currentView){
                // no current view has been set
                // most likely first load so no transition 
                // console.log('no current view');
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
                $('#container').bind('webkitTransitionEnd', function(e){
                    //its possible there could be other webkit transitions
                    //so lets make sure this is from the container
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
            app.home = app.home || new Home({collection: app.tracks});
            app.transitionTo(app.home);
       },
       track: function(id){
            // in a larger app we would throw up a throbber here
            // and check for a cached model
            //console.log('track!!!');
            var track = app.tracks.get({'id':id});
            var trackIndex = app.tracks.models.indexOf(track);
            var oldIndex;
            var direction = 1;
            if(app.trackDetail) {
                //already a trackDetail view so choose an
                //appropriate transition direction
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
            var self = this;
            if(this.localStorage.find(this)){
                //console.log('FOUND IN LOCAL STORAGE');
                this.set(this.localStorage.find(this));
                this.set({loaded: true});
            } else {
                //console.log('TRACK INIT NOT FROM STORAGE');
                SC.get('/tracks/' + self.id, function(data, error){
                    if(error) console.log('ERROR: ', error);
                    // set all the attributes locally
                    self.set(data);
                    self.save();
                    self.trigger('loaded');
                    self.set({loaded: true});
                });
            }
        },
        play: function(){
            console.log('track play:', this, this.collection.currentTrack);
            var col = this.collection;
            if(col.currentTrack) col.currentTrack.destruct();
            col.currentTrack = this;
            var stream = this.load();
            stream.play();
            this.set({'selected' : true});
        },
        pause: function(){
            console.log('track pause:', this);
            this.stream.togglePause();
        },
        load: function(){
            var self = this;
            if(this.stream && this.stream.playState === 1){
                return this.stream;
            } else {
                return this.stream = SC.stream(this.id, {
                    onplay: function(){
                        // we want to fire onplay when the track is
                        // actually playing and sound is going
                        // so we wait a small amount of time
                        // and then trigger our own event
                        this.onposition(100, function(){
                            //console.log('stream reached 100');
                            self.trigger('play');
                        }); 
                    },
                    onfinish: function(){
                        self.collection.select('next');
                        self.trigger('finish');
                        self.destruct();
                        //console.log('destroying track');
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
            if(this.stream) {
                this.stream.destruct();
            } else {
                //console.log('no stream to destruct!');
            }
            this.trigger('destruct');
            this.set({'selected': false});
        }
    });

    Tracks = Backbone.Collection.extend({
        model: Track,
        select: function(obj){
            var index;
            if(typeof obj === 'number'){
                _.each(this.models, function(item, index, array){
                    //quick turn into a number
                    if(+item.id == obj){
                        app.router.navigate('tracks/' + this.models[index].id, true);
                    }
                });
            };
            if(obj === 'next'){
                //console.log('next')
                index = this.models.indexOf(this.currentTrack);
                if(index > -1 && index <= this.models.length - 2){
                    index += 1;
                    app.router.navigate('tracks/' + this.models[index].id, true);
                }
            }; 
            if(obj === 'previous'){
                //console.log('previous')
                index = this.models.indexOf(this.currentTrack);
                if(index > 0){
                    index -= 1;
                    app.router.navigate('tracks/' + this.models[index].id, true);
                }
            };
        }
    });

    Controls = Backbone.View.extend({
        render: function(){
            this.rendered = true;
            var self = this;
            $(this.el).append(self.template(self.model.toJSON()));
            return this;
        },
        events: {
            // not all of these are necessary
            // the clicks help testing
            // and can be removed easily
            'click .previous': 'previous',
            'click .play': 'play',
            'click .next': 'next',
            'touchstart .previous': 'previous',
            'touchstart .play': 'play',
            'touchstart .next': 'next'
        },
        updateControl: function(){
            if(this.status === 'paused'){
                this.$('.play').removeClass('pause');
            } else {
                this.$('.play').addClass('pause');
            }
        },
        updateTime: function(){
            var stream = this.model.stream;
            var self = this;
            /*
            it turns out bytesLoaded and bytesTotal aren't reliable properties
            with soundmanager on ios - they dont update to a full 100%
            unfortunate as i would like to have a visual marker of how much of the
            track is loaded

            if(stream){
                console.log(stream.bytesLoaded / stream.bytesTotal * 100);
                $('.scrubber-duration').css({
                '-webkit-transform': 'translate3d(' +  stream.bytesLoaded / stream.bytesTotal * 100 + '%,0,0)',
                '-webkit-transition-duration': '.9s'});
            }*/
            if(stream.playState === 1 && !stream.paused){
                //console.log(self.formatTime(stream.position));
                this.$('.track-current').html(self.formatTime(self.model.stream.position));
                setTimeout(_.bind(self.updateTime, self), 900);
            }
        },
        play: function(e){
            e.preventDefault();
            var track = this.model;
            switch(this.status){
                case 'playing':
                    this.status = 'paused';
                    track.pause();
                    this.updateControl();
                break;
                case 'paused':
                    this.status = 'resumed';
                    track.pause();
                    this.updateControl();
                break;
                case 'resumed':
                    this.status = 'playing';
                    track.pause();
                    this.updateControl();
                break;
                default:
                    this.status = 'playing';
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
                self.position(); 
            });
            this.model.bind('pause', function(){
                self.pause();
            });
            this.model.bind('resume', function(){
                self.position();
            });
        },
        position: function(){
            //console.log('set scrubber!');
            var self = this;
            var stream = self.model.stream;
            var duration = self.model.attributes.duration;
            var position = stream.position || 0;

            this.$('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(' + (position/duration) * 100 + '%,0,0)',
                '-webkit-transition-duration': '0s'});
            
            setTimeout(function(){
                //console.log($(self.el).find('.scrubber-knob'));
                self.$('.scrubber-knob').css({
                '-webkit-transform': 'translate3d(100%, 0px, 0)',
                '-webkit-transition-duration': (duration - position) / 1000 + 's'});
           }, 1);
        },
        pause: function(){
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
            $(this.el).html(self.template(track.toJSON()));
            
            self.el.addEventListener('touchstart', function(e){
               e.preventDefault();
               self.pause();
            });
            self.el.addEventListener('touchmove', function(e){
               e.preventDefault();
               self.$('.scrubber-knob').css({
                   '-webkit-transform': 'translate3d(' + e.touches[0].clientX + 'px,0,0)'
               });
            });
            self.el.addEventListener('touchend', function(e){
                // touchend has changedtouches on iphone
                // on android it may be different
                var pos = e.changedTouches[0].clientX;
                var width = window.innerWidth;
                var duration = self.model.attributes.duration;
                var newPos = Math.round((pos * duration) / width);

                e.preventDefault();
                var stream = app.tracks.currentTrack.stream;
                
                // not sure why but there are times when stream.duration
                // is null. maybe a bug in soundmanager2 or some way 
                // im handling the stream?
                if(stream.duration && newPos < stream.duration) {
                    stream.setPosition(newPos);
                }
                self.position();
            });

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
            if(this.model.get('loaded')){
                this.render();
            } else {
                this.throbber();
                this.model.bind('loaded', function(){
                    self.render(); 
                });
            }
        },
        throbber: function(){
            $(this.el).append('<div>LOADING ...</div>');
            return this;  
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
        // cloud unicode
        title: '&#9729;',
        id: 'home',
        tagName: 'div',
        collection: Tracks,
        initialize: function(){
            this.rendered = false;
        },
        render: function(){
            this.rendered = true;
            var screen = app.currentScreen();
            screen.id = 'tracks';
            var trackView;
            var self = this;
            _.each(self.collection.models, function(model){
                trackView = new TrackView({model: new Track(model)});
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
            // music notes unicode
            var el = $('<a class="icon" href="#">&#9835;</a>').bind('click', function(){
                app.router.navigate('', true);
            });
            return el;
        },
        initialize: function(){
            var self = this;
            this.rendered = false;

            this.scrubber = new Scrubber({model: this.model});
            this.controls = new Controls({model: this.model});
            this.meta = new TrackMeta({model: this.model});
            
            if(this.model.get('loaded')){
                this.renderSubViews();
            } else {
                this.model.bind('loaded', function(){
                    self.renderSubViews();
                    app.header.update(self);
                });
            }
        },
        renderSubViews: function(){
            this.scrubber.render();
            this.controls.render();
            this.meta.render();
            this.title = '' + this.model.get('title').slice(0, 16).concat(' ...');
        },
        throbber: function(){
            // seen rarely
            $(this.el).html('<div>Loading ...</div>'); 
        },
        render: function(){
            this.rendered = true;

            $(this.scrubber.el).appendTo(this.el);
            $(this.controls.el).appendTo(this.el);
            $(this.meta.el).appendTo(this.el);

            if(this.model.get('comment_count') > 0) {
                this.comments = new Comments({model: this.model});
                this.comments.render();
                $(this.comments.el).appendTo(this.el);
            };

            // decide if autoplay or not
            console.log(app.settings.autoplay, this.model);
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

            // for lazy soundclouders who dont add artwork
            if(!this.model.get('artwork_url')){
                this.$('.meta-image').html('<div class="meta-placeholder"></div>');
            }
            $(this.el).swipeLeft(function(){
                self.model.collection.select('next');
            });
            $(this.el).swipeRight(function(){
                self.model.collection.select('previous');
            });
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
            // arbitary and maybe better
            // placed in app settings
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
            e.preventDefault();;
            $(self.el).append('<div id="track-' + self.model.id + '-comments" class="loading">Loading ... </div>');
            var self = this;
            SC.get('/tracks/' + self.model.id + '/comments', {limit: 20, offset: self.offset}, function(data, error){
                var el = $('#track-' + self.model.id + '-comments')[0];
                $('#track-' + self.model.id + '-comments')[0].parentNode.removeChild(el);
                if(error) alert('ERROR: ', error);
                self.offset += self.limit;
                self.update(data);
            });
        },
        update: function(data){
            //update ui
            var self = this;
            if(this.offset >= self.model.get('comment_count')){
               $('.load-comments').hide();
            } else {
                $('.load-comments').html('Load More Comments');
            }
            // could move this template as a jst
            // TODO when a better build script is done
            var template = _.template('<div id="comment-<%= id %>" class="comment"><p><%= body %></p><div class="comment-meta"><%= user.username %><img src="<%= user.avatar_url %>" width="20" height="20" /></div></div>');
            _.each(data, function(obj){
                $('.load-comments').before(template(obj));
            });
        },
        // this template is whacky and needs to be built better when there is more time
        template: _.template('<a href="javascript:void(0)" class="load-comments">Load Comments</a>')
    });

    soundbone.init = function(){
        soundbone.app = app = new App();
        app.router = new Router();
        Backbone.history.start({root: '/soundbone/'});
    };
})();

