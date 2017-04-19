import wavesurfer from './init.js';
import {
    selectedRegion // Global defining the current selection in the waveform.
} from './init.js';
import { // Settings for granular synthesis and EQ.
    EQ_CELLO,
    EQ_PERCUSSION,
    GrainDefs_Perc,
    GrainDefs_Cello,
    GrainDefs_Mix_Default,
    RangeValues
} from './defs.js'

import wavesBasicControllers from 'waves-basic-controllers'; //wavesBasicControllers is an alias in webpack.config.json

import X2JS from './lib/xml2js.min.js'; // Soon to be used for XML -> JSON conversion (ELAN is XML).

const GRAIN_DEFAULT = GrainDefs_Mix_Default;
const EQ_DEFAULT = EQ_CELLO;

const ANNO_ID = "BAR"; // prefix used for the ELAN annotations. Each measure will be an annotaion, ie BAR1, BAR2 ... BAR32...

const SCORE_WIDTH = 800; // Width of the score sheet. Doesn't work at the moment, so not used. (Should be used by ABC2SVG in dolayout()).
console.log("FIXME: Make it possible to change pagewidth of score.");

var x2js = new X2JS();

// Create elan instance
var elan = Object.create(wavesurfer.ELAN);

// Create Elan Wave Segment instance
var elanWaveSegment = Object.create(wavesurfer.ELANWaveSegment);
var wavesSegmentsArray = [];

var selectedBars = []; // Numerical tuplet (ie [3, 5]) containing the first and last bar/measure when doing a selection in the score.
var selectedDIVs = []; // Array containing all DIV elements in the current score selection (ie [div#3 object, div#4 object, div#5 object] ).
var currentMeasure = undefined; // Used for hovering effect on score.

var ELAN_ACTIONS = {
    'addselection': function() { // This will spread the selected audio from the waveform over the selected bars in the score.
        //if (currentMeasure == undefined) return;

        if (Object.prototype.toString.call(selectedDIVs) === '[object Array]') {
            if (selectedDIVs.length < 1) return;
            var _highest = Math.max(...selectedBars);
            var _lowest = Math.min(...selectedBars);

            deleteOldSelectedDIVs();    
            console.log(selectedRegion);
            Waveform2Score(selectedRegion.start, selectedRegion.end, _lowest, _highest + 1);
            selectedDIVs = getDIVrange(_lowest, _highest);
        }

    }
};




var wz_xs = [],
    wz_ymin = [],
    wz_ymax = [],
    bars = [];
var opt, onYouTubeIframeAPIReady, msc_credits, media_height, times_arr, offset_js, endtime_js, abc_arr, lpRec;
//Vim Vree - ABC Web
var muziek, curmtr, curtmp, msc_svgs, msc_gs, msc_wz, offset, mediaFnm, abcSave, elmed, scoreFnm, timerId = -1;
var ybplayer, yubchk = 0,
    pbrates = [],
    noprogress = 0,
    onYouTubeAPIContinue, opt_url = {},
    sok = null,
    gFac;
var /*dummyPlayer = new DummyPlayer (), */ TOFF = 0.01;
opt = {}; // global options
function initGlobals() {
    abcSave = ''; // abc code:: [string]
    muziek = ''; // svg code generated by abc2svg
    curmtr = [0, 0, 0]; // current metre
    curtmp = [0, 0, 0]; // current tempo
    msc_svgs = [] // svg elements, one per line of music
    msc_gs = [] // top graphics elements <g></g> of all music lines
    msc_wz = null; // gobal cursor object
    offset = 0.0; // offset: time in media file where music starts
    gFac = 0.1; // absolute change for offset or duration
    noprogress = 0; // stop cursor until offset synced
}
var tixlb = [
    [0, 0, 1]
];

function dolayout(abctxt) {
    var muziek = '',
        errtxt = '',
        abc2svg, bxs = {},
        bys = {},
        xleft, times = [],
        nxs = [],
        mtxts = [];
    var BAR = 0,
        METER = 6,
        NOTE = 8,
        REST = 10,
        TEMPO = 14,
        BASE_LEN = 1536,
        tixbts = [],
        mbeats = [],
        mreps = [],
        mdurs = [];
    // time index -> [line_num, bar_num, repcnt], line_num == 0.., bar_num == 1.., repcnt = 1..
    var lbtix = []; // line_num, bar_num, repcnt -> time index
    function errmsg(txt, line, col) {
        errtxt += txt + '\n';
    }

    function keySort(d) {
        var keys = Object.keys(d).map(function f(x) {
            return parseFloat(x);
        });
        keys.sort(function f(a, b) {
            return a - b;
        }); // numerical sort
        return keys;
    }

    function img_out(str) {
        if (str.indexOf('<svg') != -1) {
            str = str.replace(/width="(\d*)px"\s*height="(\d*)px"/, 'width="$1px" height="$2px" viewbox="0 0 $1 $2"');
            bxs = keySort(bxs), bys = keySort(bys);
            if (bxs.length > 1 && // the first barline is at bxs[1] because bxs[0] == left side staff
                bxs[1] < Math.min.apply(null, nxs)) { // first barline < min x-coor of all notes in this line
                bxs.splice(0, 1); // remove left side staff because there already is a left barline
            }
            bars.push({
                'xs': bxs,
                'ys': bys
            });
            bxs = {}, bys = {}, nxs = [];
        }
        muziek += str;
    }

    function svgInfo(type, s1, s2, x, y, w, h) {
        if (type == 'note' || type == 'rest') nxs.push(abc2svg.sx(x)); // x-coor of notes/rests for left barline check
        if (type == 'bar') {
            x = abc2svg.sx(x).toFixed(2);
            y = abc2svg.sy(y).toFixed(2);
            bxs[x] = 1, bys[y] = 1;
            xleft = abc2svg.sx(0).toFixed(2);
            bxs[xleft] = 1;
        }
    }

    function getTune(abctxt) {
        var ts, t, abc_lines, i, ro;
        abctxt = abctxt.replace(/\r\n/g, '\n'); // \r\n matches /^$/ ==> each line would get an extra empty line!!!
        ts = abctxt.split(/^\s*X:/m); // split on X:, multi line search
        if (ts.length == 1) return []; // no X:
        t = ts[1].split(/^\s*$/m); // split on empty lines
        t = ts[0] + 'X:' + t[0]; // header + first tune
        abc_lines = t.split(/\r\n|[\n\r\u0085\u2028\u2029]/); // whoppa
        for (i = 0; i < Math.min(100, abc_lines.length); ++i) {
            ro = abc_lines[i].match(/%%scale\s*([\d.]+)/); // avoid %%scale 1.0, because different svg hierarchy
            if (ro && ro[1] == 1.0) abc_lines[i] = '%%scale 0.99';
        }
        return abc_lines;
    }

    function timeLine(ts_p, voice_tb, music_types) {
        console.log("TIMELINE!");
        var ts, g, ftempo = 384 * 120 / 60,
            dtmp, mdur = 0,
            mt = 0,
            nbeat, lbtm = 0; // quarter duration 384, tempo 120
        try {
            nbeat = voice_tb[0].meter.a_meter[0].top;
        } // first voice, first meter: {top: x, bot: y}
        catch (e) {
            nbeat = '4';
        } // no meter defined in abc
        for (ts = ts_p; ts; ts = ts.ts_next) {
            if (ts.v != 0) continue; // skip voices > 0
            for (g = ts.extra; g; g = g.next) {
                if (g.type == TEMPO && g.tempo_notes) {
                    dtmp = g.tempo_notes.reduce(function(sum, x) {
                        return sum + x;
                    });
                    ftempo = dtmp * g.tempo / 60;
                }
            }
            switch (ts.type) {
                case NOTE:
                case REST:
                    mdur += ts.dur / ftempo;
                    break;
                case BAR:
                    ~console.log('bar_type: ' + ts.bar_type + ' text: ' + ts.text);
                    if (ts.time == lbtm) {
                        mreps[mreps.length - 1] += ts.bar_type;
                        break;
                    } // concatenate left bar with previous
                    if ('eoln' in ts) lbtm = ts.time; // to detect left bar at start of line
                    mdurs.push(mdur);
                    mdur = 0;
                    nbeat = nbeat.replace('C|', '2').replace('C', '4');
                    mbeats.push(parseInt(nbeat)); // array of beats per measure
                    mreps.push(ts.bar_type);
                    mtxts.push(ts.text);
                    break;
                case METER:
                    nbeat = ts.a_meter[0].top;
                    break;
            }
        }
    }

    function compPlayMap() {
        var line = 0, // (system) line index: 0..,
            ibar = 1, // measure index on line: 1..
            nbars = bars[line].xs.length, // number of measures on this line
            mix = 0, // total measure index: mix = 0.., total time index: tix = 1..
            pbtime = 0, // play back time
            reptix = 1, // total time index of start of repeat    (count includes repeats)
            repmix = 0, // total measure index of start of repeat (count excludes repeats)
            repcnt = 1, // 2 in second traversal
            volta = 0; // 1..
        // console.log(mtxts);
        console.log("FIXME: Handle situaion when repeat bar is like this | : ... :| .... :|, instead of  | : ... :|: .... :|");
        //While go into infinite loop in the case above!
        while (1) {
            console.log("Bars: " + bars.length + " line " + line);
            var v = mtxts[mix - 1]; // volta is on the previous measure
            var r = v ? v.match(/[,\d]*(\d)/) : null; // last int is highest volta num
            if (r) {
                v = parseInt(r[1]);
                if (v != volta) volta = v; // volta lasts until next volta
            }
            if (!volta || volta >= repcnt) // skip when repcnt > volta num
            {
                pbtime += mdurs[mix];
                times.push(pbtime);
                tixbts.push(mbeats[mix]); // also unfold beats for metronome and count-in
                if (!lbtix[line]) lbtix[line] = [];
                if (!lbtix[line][ibar]) lbtix[line][ibar] = [];
                lbtix[line][ibar][repcnt] = tixlb.length;
                tixlb.push([line, ibar, repcnt]);
            }
            if (mreps[mix] != '|') volta = 0; // reset on any special bar line
            var r = /^:/.test(mreps[mix]);
            if (r && repcnt == 1 && !opt.repskip) { // jump to start of repeat
                repcnt = 2; // now second play
                mix = repmix;
                ibar = tixlb[reptix][1]; // bar index on this line
                line = tixlb[reptix][0]; // line index
                nbars = bars[line].xs.length; // number of measures on this line
            } else {
                if (r) repcnt = 1; // reset repcount
                if (/:$/.test(mreps[mix])) { // define start of repeat
                    reptix = tixlb.length;
                    repmix = mix + 1;
                    repcnt = 1; // first play
                }
                mix += 1; // go to next measure
                ibar += 1;
                if (ibar >= nbars) { // measure is on next line
                    ibar = 1; // first bar index on this line
                    line += 1; // next line
                    if (line >= bars.length) break; // end of part
                    nbars = bars[line].xs.length; // number of measures on this line
                }
            }
        }
    }
    initGlobals();
    var score = $('#notation');
    $('body').attr('title', '') // clear drag/drop help message
    score.html(''); // clear notation area
    var abc_lines = getTune(abctxt);
    abctxt = abc_lines.join('\n');

    var user = {
        'img_out': img_out,
        'errmsg': errmsg,
        'read_file': function(x) {
            return '';
        }, // %%abc-include, unused
        'anno_start': svgInfo,
        //'imagesize': 'width="'+SCORE_WIDTH+'" height="110"', 
        'get_abcmodel': timeLine
    }
    abc2svg = new Abc(user);
    abc2svg.tosvg('abc2svg', abctxt);
    if (errtxt != '') $('#err').append(errtxt);
    score.html(muziek);
    msc_svgs = score.find('svg'); // all music lines
    msc_svgs.css('overflow', 'visible');
    msc_svgs.children('title').text(''); // avoid title popup's
    var gs = msc_svgs.children('g'); // only the topmost g per svg
    for (var i = 0; i < gs.length; ++i) {
        msc_gs.push(gs.eq(i));
    }
    /*var wz_xs = [],
        wz_ymin = [],
        wz_ymax = [];*/
    for (var i = 0; i < bars.length; ++i) { // i = line number
        var bs = bars[i]; // bars of line i
        wz_xs[i] = bs.xs; // x coors of bars
        wz_ymin[i] = bs.ys[0]; // min, max y coor of bar
        wz_ymax[i] = bs.ys[bs.ys.length - 1];
    }
    compPlayMap();

    //msc_svgs.each(function() {
    //   $(this).mousedown(klik);
    //}); // each music line gets the click handler

    //setupSheet();
    Waveform2Score(0, wavesurfer.getDuration(), 1, tixlb.length);
}

function klik(evt) { // mousedown on svg
    evt.preventDefault();
    evt.stopPropagation();
    var line = msc_svgs.get().indexOf(this); // index of the clicked svg
    var x = evt.clientX; // position click relative to page
    x -= $(this).position().left; // minus (position left edge if svg relative to page)
    x2time(x, line);
}


function x2time(x, line) {

    function isBigEnough(element) {
        return element >= x;
    }

    // Get the sfaff measure number from an X-value;
    var measure = bars[line].xs.findIndex(isBigEnough) - 1;
    var measure_width = bars[line].xs[measure + 1] - bars[line].xs[measure];

    console.log("X: " + x + " , " + "measure: " + measure + " width: " + measure_width);

}
// Returns the coordinates of a box surrounding the given measure
// FIXME: Find better solution for y-coordinates and height!
function getCoordforMeasure(measure) {
    var coord = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    }

    var positionArray = tixlb[measure];
    var line = positionArray[0];
    var bar = positionArray[1];

    var xscale = 1; //$('svg')[0].getScreenCTM().a; // if svg is scaled, get the scale factor
    coord.x = bars[line].xs[bar - 1] * xscale;
    coord.width = (bars[line].xs[bar] - bars[line].xs[bar - 1]) * xscale;

    // Add up heights from all previous lines above this line to get y value.  
    for (var _l = line - 1; _l >= 0; _l--) {
        //extract height from svg element, chop off "px" at the end.
        coord.y += Number(msc_gs[_l][0].viewportElement.getAttribute('height').match(/\d+/)[0]);
    }


    coord.height = Number(msc_gs[line][0].viewportElement.getAttribute('height').match(/\d+/)[0]);

    return coord;
}

//Draw a DIV box around given measure
function createMeasureDIV(measure) {
    var positionArray = tixlb[measure];
    var line = positionArray[0];
    var bar = positionArray[1];
    //var measure_width = bars[line].xs[bar] - bars[line].xs[bar-1];
    //var measure_height = bars[line].ys[bar] ;

    var coord = getCoordforMeasure(measure);

    var cursor = WijzerDIV(measure, line, coord.x, coord.y, coord.width, coord.height);
    var score = $('#notation');
    $("#" + ANNO_ID + measure).remove(); // remove old
    $(cursor).prependTo(score);
    return cursor;

}

// Remove highlight styling from the DIVs in the global 'selectedDIVs' array.
function clearOldSelectedDIVs() {
    if (Object.prototype.toString.call(selectedDIVs) === '[object Array]') {
        if (selectedDIVs.length < 1) return;
        selectedDIVs.forEach(function(_div) {
            $(_div).css('background-color', 'transparent');
            $(_div).css('opacity', 0.35);
            $(_div).css('border', 'none');
        });
    }


}
// Delete DIVs in the global 'selectedDIVs' array. For instance when 
// the user edits what section of the waveform should corresponds to selected measures in the score sheet.
// Then we delete the old DIVs and create new ones ( in Waveform2Score() ).
function deleteOldSelectedDIVs() {
    if (Object.prototype.toString.call(selectedDIVs) === '[object Array]') {
        if (selectedDIVs.length < 1) return;
        selectedDIVs.forEach(function(_div) {
            $(_div).remove();
        });
    }


}
// Looks in the global 'selectedDIVs' array and applies some styling to add highlight
// FIXME: Use a class instead to pick styling from css file. 
function highlightSelectedDIVs() {
    if (Object.prototype.toString.call(selectedDIVs) === '[object Array]') {
        if (selectedDIVs.length < 1) return;
        selectedDIVs.forEach(function(_div) {
            var el = $(_div);
            el.css('border-top', '1px dashed #000');
            el.css('border-bottom', '1px dashed #000');
            el.css('background-color', 'lightblue');
            el.css('opacity', 0.35);
        });
        // Add left/right border to first and last DIV
        $(selectedDIVs[0]).css('border-left', '1px dashed #000');
        $(selectedDIVs[selectedDIVs.length - 1]).css('border-right', '1px dashed #000');
    }
}
// Create measure overlay DIV's for measures between 'start' and 'end'. Return an array. 
//http://stackoverflow.com/questions/8069315/create-array-of-all-integers-between-two-numbers-inclusive-in-javascript-jquer
function getDIVrange(start, end) { 
    var arr = Array(end - start + 1).fill().map((_, idx) => {
        var el = $("#" + ANNO_ID + (start + idx));
        el.css('border-top', '1px dashed #000');
        el.css('border-bottom', '1px dashed #000');
        el.css('background-color', 'lightblue');
        el.css('opacity', 0.35);
        return el[0];
    });
    // Add left and right border to end elements
    $(arr[0]).css('border-left', '1px dashed #000');
    $(arr[arr.length - 1]).css('border-right', '1px dashed #000');
    return arr;
}


function WijzerDIV(measure, line, x, y, width, height) { // create the music cursor
    var y_offset = -15;

    var wijzer = document.createElement('div');
    $(wijzer).attr('id', ANNO_ID + measure);
    $(wijzer).css('overflow', 'visible');
    $(wijzer).css('position', 'absolute');
    $(wijzer).css('left', (x + 10).toFixed(2) + "px");
    $(wijzer).css('top', (y + y_offset) + "px");
    $(wijzer).css('height', height + "px");
    $(wijzer).css('width', width.toFixed(2) + "px");
    //$(wijzer).css ('background-color', 'lightblue');
    $(wijzer).css('z-index', 1);
    $(wijzer).css('opacity', 0.35);
    $(wijzer).css('margin-bottom', '3px');
    //$(wijzer).css ('padding-top', '22px'); //center waveform on staff

    $(wijzer).mousedown(function(evt) {
        console.log(evt);
        selectedBars = [measure]; //Clear previous selection, and add this bar.
        console.log("Start Measure: " + measure)
    });

    $(wijzer).mouseup(function(evt) {
        if (currentMeasure == this) {
            console.log("End Measure: " + measure);
            selectedBars.push(measure);
            //console.log(selectedBars);
            var _highest = Math.max(...selectedBars);
            var _lowest = Math.min(...selectedBars);
            clearOldSelectedDIVs();
            selectedDIVs = getDIVrange(_lowest, _highest);

            var _start = elan.data.annotations[ANNO_ID + _lowest].start;
            var _end = elan.data.annotations[ANNO_ID + _highest].end;
            //wavesurfer.backend.play(_start, _end);

        }
    });


    $(wijzer).mouseover(function(evt) {

        var annot = elan.data.annotations[ANNO_ID + measure];

        //wavesurfer.backend.play(annot.start, annot.end);
        //console.log(evt);
        //console.log(this);
        if (currentMeasure == this) return;
        //console.log(measure + ":" + selectedBars[0]);

        if (currentMeasure != null) {
            //console.log(currentMeasure);
            //console.log(document.getElementById(ANNO_ID + selectedBars[0]));
            var _sel = document.getElementById(ANNO_ID + selectedBars[0]); // selectedBars[0] = first bar of an ongoing selection
            //console.log("Current mesasure in selectedDIVs: " + selectedDIVs.includes(currentMeasure));
            if (currentMeasure != _sel && !selectedDIVs.includes(currentMeasure)) { //dont deselect first bar of a selection while selecting
                $(currentMeasure).css('background-color', 'transparent');
                $(currentMeasure).css('opacity', 0.35);
                $(currentMeasure).css('border', 'none');
            } else {
                $(currentMeasure).css('background-color', 'lightblue');
            }
        }

        $(this).css('opacity', 0.35);
        $(this).css('background-color', 'lightgreen');
        $(wijzer).css('border', '1px dashed #000');
        currentMeasure = this;
    });
    return wijzer;

}

// Link sheet measures with time segments in the waveform.
// This also creates DIV overlays on the score sheet for click interaction and
// acts as placeholders for the smaller wave segments. 
function Waveform2Score(wave_start, wave_end, measure_start, measure_end) {
    //wavesSegmentsArray = []; // clear array

    var wavesegment_options = {
        container: '#waveform',
        waveColor: '#dddddd',
        progressColor: '#3498db',
        loaderColor: 'purple',
        cursorColor: '#e67e22',
        cursorWidth: 1,
        selectionColor: '#d0e9c6',
        backend: 'WebAudio',
        normalize: true,
        loopSelection: false,
        renderer: 'Canvas',
        waveSegmentRenderer: 'Canvas',
        waveSegmentHeight: 50,
        height: 100,
        barWidth: 2,
        plotTimeEnd: wavesurfer.backend.getDuration(),
        wavesurfer: wavesurfer,
        ELAN: elan,
        wavesSegmentsArray,
        scrollParent: false
    };

    var measure_duration = (wave_end - wave_start) / (measure_end - measure_start);

    for (var i = measure_start; i < measure_end; i++) {
        var msr = createMeasureDIV(i);
        var rect = msr.getBoundingClientRect();

        var waveSegmentPos = {
            left: rect.left + "px",
            top: rect.top + "px",
            width: rect.width,
            container: msr.getAttribute('id')
        }


        wavesSegmentsArray.push(waveSegmentPos);

        var repris = tixlb[i][2];
        elan.addAnnotation(ANNO_ID + i, wave_start + (i - measure_start) * measure_duration, wave_start + (i - measure_start + 1) * measure_duration, " Measure nr " + i, " Repetition " + repris);


    }
    elanWaveSegment.init(wavesegment_options);
    highlightSelectedDIVs();

}

var setupGrain = function(GrainDefs) {
    var container = document.querySelector('#granular-engine-container');
    container.innerHTML = "";

    var self = wavesurfer.backend;

    /* Initialize granular engine and draw slider */
    for (var k in GrainDefs) {
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
                    new wavesBasicControllers.Slider(k, RangeValues[k].min, RangeValues[k].max, 0.0001, value, "", '', container, function(val) {
                        if (k === 'speed') {
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


    //Setup Elan actions
    [].forEach.call(document.querySelectorAll('[data-action]'), function(el) {
        el.addEventListener('click', function(e) {
            var action = e.currentTarget.dataset.action;
            if (action in ELAN_ACTIONS) {
                e.preventDefault();
                ELAN_ACTIONS[action](e);
            }
        });
    });


    //LOAD ELAN

    function loadXMLDoc(dname) {
        var xhttp;
        if (window.XMLHttpRequest) {
            xhttp = new XMLHttpRequest();
        } else {
            xhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        xhttp.open("GET", dname, false);
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
    //console.log(str);

    elan.loadJson(jsonObj);

    wavesurfer.on('ready', function() {
        wavesurfer.clearRegions();

        // Regions
        if (wavesurfer.enableDragSelection) {
            wavesurfer.enableDragSelection({
                color: 'rgba(41, 128, 185, 0.25)'
            });
        }

        //Setup some basic hooks
        setupDropdowns();
        setupGrain(GRAIN_DEFAULT);
        setupEQ(EQ_DEFAULT);
        //setupReverb();

        //LOAD ABC TUNE

        endtime_js = wavesurfer.getDuration();
        console.log(endtime_js);
        // read text from URL location
        var request = new XMLHttpRequest();
        request.open('GET', './assets/tune.abc', true);
        request.send(null);
        request.onreadystatechange = function() {

            if (request.readyState === 4 && request.status === 200) {
                var type = request.getResponseHeader('Content-Type');
                if (type.indexOf("text") !== 1) {
                    dolayout(request.responseText);
                    return request.responseText;
                }
            }
        }


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