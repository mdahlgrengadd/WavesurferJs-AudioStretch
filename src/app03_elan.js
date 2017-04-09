import wavesurfer from './init.js';
import {
    EQ_CELLO,
    EQ_PERCUSSION,
    GrainDefs_Perc,
    GrainDefs_Cello,
    GrainDefs_Mix_Default,
    RangeValues
} from './defs.js'

import wavesBasicControllers from 'waves-basic-controllers'; //wavesBasicControllers is an alias in webpack.config.json
import X2JS from './lib/xml2js.min.js';

const GRAIN_DEFAULT = GrainDefs_Mix_Default;
const EQ_DEFAULT = EQ_CELLO;


var x2js = new X2JS();

// Create elan instance
var elan = Object.create(wavesurfer.ELAN);

// Create Elan Wave Segment instance
var elanWaveSegment = Object.create(wavesurfer.ELANWaveSegment);


var setupGrain = function(GrainDefs) {
    var container = document.querySelector('#granular-engine-container');
    container.innerHTML = "";

    var self = wavesurfer.backend;

    /* Initialize granular engine and draw slider */
    for (var k in GrainDefs){
        //console.log(RangeValues[k]);
        if (typeof RangeValues[k] !== 'undefined') {
            //console.log("Key: " + k);
            var value = GrainDefs[k];
            self.transportedGranularEngine[k] = value;

            // Curry function. Probably better ways to
            // setup up the granular sliders, but can't 
            // figure it out at the moment.
            var sliderFactory = function(k) {
              return function(val) {
                new wavesBasicControllers.Slider(k, RangeValues[k].min, RangeValues[k].max, 0.01, value, "", '', container, function(val) {
                    if(k==='speed') {
                    self.playControl.speed = val;
                    } else {
                    self.transportedGranularEngine[k] = val;
                    }
                });
                
              };
            };

            var makeSlider = sliderFactory(k);
            makeSlider(value);    


            //console.log("Key is " + k + ", value is" + self.transportedGranularEngine[k]);
        }
    }


}
var setupEQ = function(EQ) {
    // Create filters
    var filters = EQ.map(function(band) {
        var filter = wavesurfer.backend.ac.createBiquadFilter();
        filter.type = band.type;
        filter.gain.value = band.value;
        filter.Q.value = 1;
        filter.frequency.value = band.f;
        return filter;
    });

    // Bind filters to vertical range sliders
    var container = document.querySelector('#granular-engine-pitch-container');
    container.innerHTML = "";
    filters.forEach(function(filter, index) {
        var input = document.createElement('input');
        wavesurfer.util.extend(input, {
            type: 'range',
            min: -40,
            max: 40,
            value: filter.gain.value,
            title: filter.frequency.value
        });
        input.style.display = 'inline-block';
        input.setAttribute('orient', 'vertical');
        wavesurfer.drawer.style(input, {
            'webkitAppearance': 'slider-vertical',
            width: '40px',
            height: '150px'
        });

        var div = document.createElement('div');
        div.style.display = 'inline-block';
        div.innerHTML = '<p style="width:18px;max-width:8px;" id="EQ_' + index + '_title">' + filter.frequency.value + '</p>';
        var div2 = document.createElement('div');
        //div2.style.display = 'inline-block';
        div2.innerHTML = '<p style="width:18px;max-width:8px;" id="EQ_' + index + '">' + filter.gain.value + '</p>';

        div.appendChild(input);
        div.appendChild(div2);
        container.appendChild(div);

        var onChange = function(e) {
            filter.gain.value = ~~e.target.value;
            var el = document.querySelector('#EQ_' + index);
            el.innerHTML = filter.gain.value;

        };

        input.addEventListener('input', onChange);
        input.addEventListener('change', onChange);
    });

    /* LIMITER */
    var hardLimiter = wavesurfer.backend.ac.createDynamicsCompressor();
    hardLimiter.threshold.value = -10.0; // this is the pitfall, leave some headroom
    hardLimiter.knee.value = 0.0; // brute force
    hardLimiter.ratio.value = 20.0; // max compression
    hardLimiter.attack.value = 0.005; // 5ms attack
    hardLimiter.release.value = 0.50; // 50ms release

    filters.push(hardLimiter);
    // Connect filters to wavesurfer
    wavesurfer.backend.setFilters(filters);

    // For debugging
    wavesurfer.filters = filters;

}

var setupDropdowns = function(e) {
    $("#EQ_string_preset").click(function(e) {
        //do something
        console.log("Loading string preset...");
        setupEQ(EQ_CELLO);

        e.preventDefault();
    });

    $("#EQ_percussion_preset").click(function(e) {
        //do something
        console.log("Loading percussion preset...");
        setupEQ(EQ_PERCUSSION);
        e.preventDefault();
    });

    $("#Grain_string_preset").click(function(e) {
        //do something
        console.log("Loading string preset...");

        setupGrain(GrainDefs_Cello);
        e.preventDefault();
    });

    $("#Grain_percussion_preset").click(function(e) {
        //do something
        console.log("Loading percussion preset...");
        setupGrain(GrainDefs_Perc);
        e.preventDefault();
    });

}

var setupReverb = function() {
    var reverbGain;
    var audioContext = wavesurfer.backend.getAudioContext();
    reverbjs.extend(audioContext);
    // 2) Load the impulse response; upon load, connect it to the audio output.
    //var reverbUrl = "http://reverbjs.org/Library/KinoullAisle.m4a";
    var reverbUrl = "https://rawgit.com/burnson/Reverb.js/master/Library/TyndallBruceMonument.m4a";
    var reverbNode = audioContext.createReverbFromUrl(reverbUrl, function() {
        reverbGain = wavesurfer.backend.ac.createGain();
        reverbGain.gain.value = 0.15;

        reverbGain.connect(audioContext.destination);
        reverbNode.connect(reverbGain);
        wavesurfer.backend.gainNode.connect(reverbNode);
    });
}

//wavesurfer.on('ready', function() {
document.addEventListener('DOMContentLoaded', function() {

    /* ELAN */
    elan.on('select', function(start, end) {
        wavesurfer.backend.play(start, end);
    });

    //set up listener for when elan is done
    elan.on('ready', function(data) {
        //go load the wave form
        //wavesurfer.load('./transcripts/001z.mp3');

        //add some styling to elan table
        var classList = elan.container.querySelector('table').classList;
        ['table', 'table-striped', 'table-hover'].forEach(function(cl) {
            classList.add(cl);
        });
    });

    function loadXMLDoc(dname) {
        var xhttp;
        if (window.XMLHttpRequest) {
            xhttp=new XMLHttpRequest();
        }
        else {
            xhttp=new ActiveXObject("Microsoft.XMLHTTP");
        }
        xhttp.open("GET",dname,false);
        xhttp.send();
        return xhttp.responseXML;
    }


    //init elan
    elan.init({
        //url: './transcripts/001z.xml',
        container: '#annotations',
        tiers: {
            Text: true,
            Comments: true
        }
    });


    var xmlDoc = loadXMLDoc("./transcripts/elan_template.xml");
    var x2js = new X2JS();
    var jsonObj = x2js.xml2json(xmlDoc);
    var str = JSON.stringify(jsonObj, null, 2); // spacing level = 2
    console.log(str);

    elan.loadJson(jsonObj);

    wavesurfer.on('ready', function() {
        var wavesegment_options = {
            container: '#waveform',
            waveColor: 'navy',
            progressColor: 'blue',
            loaderColor: 'purple',
            cursorColor: 'navy',
            selectionColor: '#d0e9c6',
            backend: 'WebAudio',
            normalize: true,
            loopSelection: false,
            renderer: 'Canvas',
            waveSegmentRenderer: 'Canvas',
            waveSegmentHeight: 50,
            height: 100,
            plotTimeEnd: wavesurfer.backend.getDuration(),
            wavesurfer: wavesurfer,
            ELAN: elan,
            scrollParent: false
        };

        elan.addAnnotation(0,wavesurfer.getDuration(),"Example", "Test");

        elanWaveSegment.init(wavesegment_options);

        // Regions
        if (wavesurfer.enableDragSelection) {
            wavesurfer.enableDragSelection({
                color: 'rgba(0, 255, 0, 0.25)'
            });
        }



        //Setup some basic hooks
        setupDropdowns();
        setupGrain(GRAIN_DEFAULT);
        setupEQ(EQ_DEFAULT);
        setupReverb();

    });



    var prevAnnotation, prevRow, region;
    var onProgress = function(time) {
        elanWaveSegment.onProgress(time);
        var annotation = elan.getRenderedAnnotation(time);

        if (prevAnnotation != annotation) {
            prevAnnotation = annotation;

            region && region.remove();
            region = null;

            if (annotation) {
                // Highlight annotation table row
                var row = elan.getAnnotationNode(annotation);
                prevRow && prevRow.classList.remove('success');
                prevRow = row;
                row.classList.add('success');
                var before = row.previousSibling;
                if (before) {
                    elan.container.scrollTop = before.offsetTop;
                }

                // Region
                region = wavesurfer.addRegion({
                    start: annotation.start,
                    end: annotation.end,
                    resize: false,
                    color: 'rgba(223, 240, 216, 0.7)'
                });
            }
        }
    };

    wavesurfer.on('audioprocess', onProgress);


});
