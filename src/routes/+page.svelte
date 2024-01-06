<script>

    import { browser } from '$app/environment';

    const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

    const chordTypes = {
        'maj': {symbol: '', dom: true},
        'min': {symbol: '', dom: false},
        'aug': {symbol: '⁺', dom: true},        
        'dim': {symbol: '°', dom: false},
        'sus2': {symbol: 'sus2', dom: true},
        'sus4': {symbol: 'sus4', dom: true},
        'maj7': {symbol: '⁷', dom: true},
        'min7': {symbol: '⁷', dom: false},
        'dom7': {symbol: '⁷', dom: true},
        'dim7': {symbol: '°⁷', dom: false},        
        'min7♭5': {symbol: 'ø⁷', dom: false},
        'maj7♯5': {symbol: '⁺⁷', dom: true},
        'minMaj7': {symbol: '⁷', dom: false},
        '7sus2': {symbol: '⁷sus2', dom: true},
        '7sus4': {symbol: '⁷sus4', dom: true},
    };

    class Note {
        constructor(number, name, index, octave) {
            this.number = number;
            this.name = name;
            this.index = index;
            this.octave = octave;
        }
        get noteWithOctave() {
            return this.name + this.octave;
        }
        get isSharp() {
            return this.name.includes('♯');
        }
    }

    class Chord {
        constructor(name, notes, rootIndex, chordType) {
            this.name = name;
            this.notes = notes;
            this.rootIndex = rootIndex;
            this.chordType = chordType;
        }
        get isInverted() {
            return this.rootIndex > 0;
        }
        get inversionNumber() {
            return this.rootIndex === 0 ? 0 : this.notes.length - this.rootIndex;
        }
        get noteCount() {
            return this.notes.length;
        }
        getParentNotes() {
            if (!this.isInverted)
                return [...this.notes];
            let nonInvertedNotes = [];
            for (let i=0; i<this.notes.length; i++) {
                const offset = this.notes.length - i <= this.inversionNumber ? 12 : 0;
                nonInvertedNotes.push(this.notes[i] - offset);
            }
            return nonInvertedNotes.toSorted((a,b) => a-b);
        }
    }

    class Scale {
        constructor(name, keyIndex) {
            this.name = name;
            this.keyIndex = keyIndex;
        }
        get key() {
            return noteNames[this.keyIndex];
        }

        get nameWithKey() {
            return `${this.key} ${this.name}`;
        }
    }

    class ScaleDegree {
        constructor(scale, degree, chordType) {
            this.scale = scale;
            this.degree = degree;
            this.chordType = chordType;
        }
        degreeSymbols = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];        
        get name() {
            return `${this.scale.nameWithKey} [${this.degree}]`;
        }
        get symbol() {
            let numeral =  this.degreeSymbols[this.degree];
            if (!this.chordType.dom)
                numeral = numeral.toLowerCase();
            return numeral + this.chordType.symbol;
        }
    }

    let midi = null;
    let midiInputs = [];
    let notesMap = new Map();
    let currentNotes = [];
    let currentChord = null;
    let currentScales = [];
    let allNotes = [];
    let allChords = [];
    let octave = 4; // current octave, for non-midi notes only
    let errorMessage = null;
    let insertMode = false;
    let infoTextVisible = true;

    function onMIDISuccess(midiAccess) {
        midiAccess.onstatechange = onMIDIStateChange;
        midi = midiAccess;
        midiInputs = [...midi.inputs.values()];
        if (midiAccess.inputs.size > 0) {
            setDevice(midiAccess.inputs.keys().next().value, true);
        }
    }

    function onMIDIFailure(msg) {
        errorMessage = msg;
    }

    function onMIDIStateChange(event) {
        midiInputs = [...midi.inputs.values()];
        if (event.port.type === 'input' && event.port.state === 'connected')
            setDevice(event.port.id, true);
    }

    function onMIDIMessage(event) {
        if (event.data.length < 3)
            return;
            
        // 0 - function, 1 - note number, 2 - velocity
        const func = event.data[0];
        const note = event.data[1];
        
        const midiNoteNumber = parseInt(note);
        
        if (func === 0x80) { // channel 1 note off
            handleNoteOff(midiNoteNumber);
        }
    
        else if (func === 0x90) {// channel 1 note on
            handleNoteOn(midiNoteNumber);
        }
    }

    function setDevice(deviceId, enable) {
        const input = midi.inputs.get(deviceId);
        if (enable) {
            input.onmidimessage = onMIDIMessage;
        }
        else {
            input.onmidimessage = null;
        }
    }

    function onKeyDown(event) {
        if (!event.repeat) {
            if (event.keyCode === 45) { // insert
                event.preventDefault();
                insertMode = !insertMode;
            }
            else if (event.keyCode === 46) { // delete
                event.preventDefault();
                notesMap.clear();
                currentChord = null;
                currentScales = [];
                currentNotes = [];
                if (event.ctrlKey) {
                    allNotes = [];
                    allChords = [];
                }
            }
            else if (event.keyCode === 8) { // backspace
                event.preventDefault();
                if (notesMap.size > 0) {
                    const lastEntryKey = [...notesMap.keys()].pop();
                    notesMap.delete(lastEntryKey);
                    currentNotes = getCurrentNotes();
                    identifyChord();
                }
            }            
            else { // handle notes and octave changes
                const midiNoteNumber = keyCodeToMIDINote(event.keyCode);
                if (midiNoteNumber) {
                    event.preventDefault();
                    handleNoteOn(midiNoteNumber);
                }
                else {
                    const octaveNumber = keyCodeToOctave(event.keyCode);
                    if (octaveNumber) {
                        event.preventDefault();
                        octave = octaveNumber;
                    }
                }
            }
        }
    }

    function onKeyUp(event) {
        if (!event.repeat) {
            const midiNoteNumber = keyCodeToMIDINote(event.keyCode);
            if (midiNoteNumber) {
                event.preventDefault();
               handleNoteOff(midiNoteNumber);
            }
        }
    }

    function handleNoteOn(midiNoteNumber)
    {
        const note = getNote(midiNoteNumber);
        notesMap.set(midiNoteNumber, note);
        currentNotes = getCurrentNotes();
        allNotes = [...allNotes, note.noteWithOctave];
        identifyChord();
        infoTextVisible = false;
    }

    function handleNoteOff(midiNoteNumber)
    {
        if (!insertMode) {
            notesMap.delete(midiNoteNumber);
            currentNotes = getCurrentNotes();
            identifyChord();
        }
    }

    function identifyChord()
    {        
        currentChord = null;
        currentScales = [];
        let chord = null;
        const noteNumbers = [...notesMap].map(([k,v]) => v.number);
        if (noteNumbers.length === 4) {
            chord = getTetradChord(noteNumbers);
        }
        else if (noteNumbers.length === 3) {
            chord = getTriadChord(noteNumbers);
        }
        if (chord) {
            currentChord = chord;
            allChords = [...allChords, chord.name];
            currentScales = getChordScales(chord);
        }
    }

    function getNote(midiNoteNumber) {
        const octave = Math.floor(midiNoteNumber / 12) - 1;
        const noteIndex = midiNoteNumber % 12;
        return new Note(midiNoteNumber, noteNames[noteIndex], noteIndex, octave);
    }
    
    function getCurrentNotes()
    {
        return [...notesMap].map(([k,v]) => v).toSorted((a,b) => a.number-b.number);
    }    

    function getTriadChord(midiNotes) {

        if (midiNotes.length !== 3)
            return null;

        const triads = [
            { intervals: [3, 4], rootIndex: 0, format: 'min' },    // Minor chord (root position)
            { intervals: [4, 3], rootIndex: 0, format: 'maj' },    // Major chord (root position)
            { intervals: [3, 3], rootIndex: 0, format: 'dim' },    // Diminished chord (root position)
            { intervals: [4, 4], rootIndex: 0, format: 'aug' },    // Augmented chord (root position)
            { intervals: [2, 5], rootIndex: 0, format: 'sus2' },   // Suspended Second chord (root position)
            { intervals: [5, 2], rootIndex: 0, format: 'sus4' },   // Suspended Fourth chord (root position)

            // First Inversions (duplicates omitted)
            { intervals: [4, 5], rootIndex: 2, format: 'min' },  // Minor chord (first inversion)
            { intervals: [3, 5], rootIndex: 2, format: 'maj' },  // Major chord (first inversion)
            { intervals: [3, 6], rootIndex: 2, format: 'dim' },  // Diminished chord (first inversion)

            // Second Inversions (duplicates omitted)
            { intervals: [5, 3], rootIndex: 1, format: 'min' },  // Minor chord (second inversion)
            { intervals: [5, 4], rootIndex: 1, format: 'maj' },  // Major chord (second inversion)
            { intervals: [6, 3], rootIndex: 1, format: 'dim' },  // Diminished chord (second inversion)
        ];

        return getChord(midiNotes, triads);        
    }

    function getTetradChord(midiNotes) {

        if (midiNotes.length !== 4)
            return null;

        const tetrads = [
            { intervals: [4, 3, 4], rootIndex: 0, format: 'maj7' },      // Major seventh chord (root position)
            { intervals: [3, 4, 3], rootIndex: 0, format: 'min7' },      // Minor seventh chord (root position)
            { intervals: [4, 3, 3], rootIndex: 0, format: 'dom7' },      // Dominant seventh chord (root position)
            { intervals: [3, 3, 4], rootIndex: 0, format: 'min7♭5' },    // Half-Diminished seventh chord (root position)
            { intervals: [3, 3, 3], rootIndex: 0, format: 'dim7' },      // Diminished seventh chord (root position)
            { intervals: [3, 4, 4], rootIndex: 0, format: 'minMaj7' },   // Minor-Major seventh chord (root position)
            { intervals: [4, 4, 3], rootIndex: 0, format: 'maj7♯5' },    // Augmented seventh chord (root position)
            { intervals: [2, 5, 3], rootIndex: 0, format: '7sus2' },     // Seventh suspended second chord (root position)
            { intervals: [5, 2, 3], rootIndex: 0, format: '7sus4' },     // Seventh suspended fourth chord (root position)

            // First Inversions
            { intervals: [3, 4, 1], rootIndex: 3, format: 'maj7' },      // Major seventh chord (first inversion)
            { intervals: [4, 3, 2], rootIndex: 3, format: 'min7' },      // Minor seventh chord (first inversion)
            { intervals: [3, 3, 2], rootIndex: 3, format: 'dom7' },      // Dominant seventh chord (first inversion)
            { intervals: [3, 4, 2], rootIndex: 3, format: 'min7♭5' },    // Half-Diminished seventh chord (first inversion)
            { intervals: [3, 3, 3], rootIndex: 3, format: 'dim7' },      // Diminished seventh chord (first inversion)
            { intervals: [4, 4, 1], rootIndex: 3, format: 'minMaj7' },   // Minor-Major seventh chord (first inversion)
            { intervals: [4, 3, 1], rootIndex: 3, format: 'maj7♯5' },    // Augmented seventh chord (first inversion)
            { intervals: [5, 3, 2], rootIndex: 3, format: '7sus2' },     // Seventh suspended second chord (first inversion)
            { intervals: [2, 3, 2], rootIndex: 3, format: '7sus4' },     // Seventh suspended fourth chord (first inversion)

            // Second Inversions
            { intervals: [4, 1, 4], rootIndex: 2, format: 'maj7' },      // Major seventh chord (second inversion)
            { intervals: [3, 2, 3], rootIndex: 2, format: 'min7' },      // Minor seventh chord (second inversion)
            { intervals: [3, 2, 4], rootIndex: 2, format: 'dom7' },      // Dominant seventh chord (second inversion)
            { intervals: [4, 2, 3], rootIndex: 2, format: 'min7♭5' },    // Half-Diminished seventh chord (second inversion)
            { intervals: [3, 3, 3], rootIndex: 2, format: 'dim7' },      // Diminished seventh chord (second inversion)
            { intervals: [4, 1, 3], rootIndex: 2, format: 'minMaj7' },   // Minor-Major seventh chord (second inversion)
            { intervals: [3, 1, 4], rootIndex: 2, format: 'maj7♯5' },    // Augmented seventh chord (second inversion)
            { intervals: [3, 2, 2], rootIndex: 2, format: '7sus2' },     // Seventh suspended second chord (second inversion)
            { intervals: [3, 2, 5], rootIndex: 2, format: '7sus4' },     // Seventh suspended fourth chord (second inversion)

            // Third Inversions
            { intervals: [1, 4, 3], rootIndex: 1, format: 'maj7' },      // Major seventh chord (third inversion)
            { intervals: [2, 3, 4], rootIndex: 1, format: 'min7' },      // Minor seventh chord (third inversion)
            { intervals: [2, 4, 3], rootIndex: 1, format: 'dom7' },      // Dominant seventh chord (third inversion)
            { intervals: [2, 3, 3], rootIndex: 1, format: 'min7♭5' },    // Half-Diminished seventh chord (third inversion)
            { intervals: [3, 3, 3], rootIndex: 1, format: 'dim7' },      // Diminished seventh chord (third inversion)
            { intervals: [1, 3, 4], rootIndex: 1, format: 'minMaj7' },   // Minor-Major seventh chord (third inversion)
            { intervals: [1, 4, 4], rootIndex: 1, format: 'maj7♯5' },    // Augmented seventh chord (third inversion)
            { intervals: [2, 2, 5], rootIndex: 1, format: '7sus2' },     // Seventh suspended second chord (third inversion)
            { intervals: [2, 5, 2], rootIndex: 1, format: '7sus4' },     // Seventh suspended fourth chord (third inversion)
        ];

        return getChord(midiNotes, tetrads);
    }


    function getChord(midiNotes, chords) {

        const sortedNotes = midiNotes.toSorted((a, b) => a - b);
        const intervals = getIntervals(sortedNotes);
        let chord = null;
        
        for (let c of chords) {
            if (c.intervals.every((value, index) => value === intervals[index])) {
                const rootNoteName = getNote(sortedNotes[c.rootIndex]).name;
                const bassNoteName = c.rootIndex === 0 ? rootNoteName : getNote(sortedNotes[0]).name;
                let chordName = rootNoteName + c.format;
                if (bassNoteName !== rootNoteName)
                    chordName += '/' + bassNoteName;
                chord = new Chord(chordName, sortedNotes, c.rootIndex, chordTypes[c.format]);
                break;
            }
        };
        
        return chord;
    }

    function getIntervals(sortedMidiNotes) {
        const intervals = [];        
        for (var i=0; i<sortedMidiNotes.length-1; i++) {
            intervals.push(sortedMidiNotes[i+1] - sortedMidiNotes[i]);
        }        
        return intervals;
    }

    function keyCodeToMIDINote(keyCode) {
        const keyMap = {
            65: 12, // A -> C
            87: 13, // W -> C#
            83: 14, // S -> D
            69: 15, // E -> D#
            68: 16, // D -> E
            70: 17, // F -> F
            84: 18, // T -> F#
            71: 19, // G -> G
            89: 20, // Y -> G#
            72: 21, // H -> A
            85: 22, // U -> A#
            74: 23, // J -> B
            75: 24, // K -> C
            79: 25, // O -> C#
            76: 26, // L -> D
            80: 27, // P -> D#
        };
        const midiNote = keyMap[keyCode] + (octave * 12) || null;
        return midiNote;
    }

    function keyCodeToOctave(keyCode) {
        // allow only digits 1-9 (both normal and numpad)
        if (keyCode >= 49 && keyCode <= 57) {
            return keyCode - 48;
        }
        if (keyCode >= 97 && keyCode <= 105) {
            return keyCode - 96;
        }
        return null;
    }

    function getChordScales(chord) {
        const scales = {
            "Major": [2, 2, 1, 2, 2, 2, 1],           // natural major scale
            "Minor": [2, 1, 2, 2, 1, 2, 2],           // matural minor scale
            "Harmonic Major": [2, 2, 1, 2, 1, 3, 1],  // harmonic major scale
            "Harmonic Minor": [2, 1, 2, 2, 1, 3, 1],  // harmonic minro scale
            "Melodic Major": [2, 2, 1, 2, 1, 2, 2],   // melodic major scale
            "Melodic Minor": [2, 1, 2, 2, 2, 2, 1],   // melodic minor scale
        };
        const chordNotes = chord.getParentNotes();
        const chordIntervals = getIntervals(chordNotes);
        const chordNoteIndexes = chordNotes.map(s => getNote(s).index);
        const startIndex = 1 + (chordNotes.length - 2) * 2;
        const matched = [];
        
        for (let scale in scales) {
            const matchedScales = [];
            const scaleIntervals = [...scales[scale], ...scales[scale].slice(0, startIndex)];
            for (let i=startIndex; i<scaleIntervals.length; i++) {
                let intervals = [];
                for (let j=i-startIndex; j<i; j+=2) {
                    intervals.push(scaleIntervals[j] + scaleIntervals[j+1]);
                }
                if (intervals.every((value, index) => value === chordIntervals[index])) {
                     // scale matched, now find in which key (or keys) the chord belongs
                    for (let k=0; k<noteNames.length; k++) {
                        let scaleNoteIndexes = [k];
                        for (let x of scales[scale].slice(0, -1)) {
                            scaleNoteIndexes.push((scaleNoteIndexes[scaleNoteIndexes.length - 1] + x) % 12);
                        }
                        if (chordNoteIndexes.every(val => scaleNoteIndexes.includes(val))) {
                            matchedScales.push(new ScaleDegree(new Scale(scale, k), scaleNoteIndexes.indexOf(chordNoteIndexes[0]) + 1, chord.chordType));
                        }
                    }
                    matched.push(matchedScales);
                    break;
                }
            }
        }

        return matched;
    }

    if (browser)
        navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure );

    

</script>

<main>

    <div id="logo">
        [achord.top]
    </div>

    <div id="top-bar">
        {#if midi}
            {#if midiInputs.length === 0}
                Plug in your MIDI device or use keyboard to play notes
            {/if}
            {#each midiInputs as device, index}
                <input type="checkbox" value="{device.id}" checked={index === 0} on:change={e => setDevice(e.currentTarget.value, e.currentTarget.checked)} />
                <label for="{device.id}">{device.name}</label>
            {/each}
        {/if}
        {#if errorMessage}
            errorMessage
        {/if}
    </div>

    <div class="flex-container">        

        <div id="all-notes" class="sidebar">
            {#each allNotes as note}
                <div class="small-item small-note">{note}</div>
            {/each}
        </div>

        <div id="current">
            {#if infoTextVisible}
            <div class="info">
                <p id="about">
                    Use your MIDI device or computer keyboard to enter notes. If you play a triad or a seventh chord, it will be identified and relevant scales shown. 
                    Press INSERT to toggle whether or not the notes stay on the screen once the keys are released. 
                    Press DELETE to remove any notes from the screen and CTRL+DELETE to clear everything. Press BACKSPACE to delete last note entered.
                </p>
                {#if midiInputs.length === 0}
                    <p id="keymap">
                        MIDI device support requries Chrome, Edge, Firefox or Opera browser.<br />
                        If not using a MIDI device, use numeric keys to set octave and use the following letters to enter notes:<br />
                        A = C, W = C#, S = D, E = D#, D = E, F = F, T = F#, G = G, Y = G#, H = A, U = A#, J = B, K = C, O = C#, L = D, P = D#
                    </p>
                {/if}
            </div>
            {/if}
            {#each currentNotes as note}
                <div class="item note {note.isSharp ? 'black-key' : 'white-key'}">{note.name}<sub class="octave">{note.octave}</sub></div>
            {/each}

            {#if currentChord}
                <div class="item chord {currentChord.isInverted ? 'inverted' : ''}">{currentChord.name}
                    {#if currentChord.inversionNumber > 0}
                        <div class="inversion-number">{currentChord.inversionNumber}</div>
                    {/if}
                </div>
            {/if}

            <div class="break"></div>

            {#if currentScales}
                <div class="flex-container scales">
                    {#each currentScales as scales, index}
                        <div class="flex-container scale-group">
                            {#each scales as deg}
                                <span class="scale"><span class="scale-key">{deg.scale.nameWithKey} </span><span class="scale-degree">{deg.symbol}</span></span>
                            {/each}
                        </div>
                        <div class="break"></div>
                    {/each}
                </div>
            {/if}
        </div>

        <div id="all-chords" class="sidebar">
            {#each allChords as chord}
                <div class="small-item small-chord">{chord}</div>
            {/each}
        </div>

    </div>

</main>

<style>
    :global(body) {
        background-color: #333;
        color: white;
    }
    #top-bar {
        margin-bottom: 10px;
        padding: 4px;
        border-bottom: 2px solid #555;
        text-align: center;
        color: #CCC;
    }
    #logo {
        top: 0px;
        right: 0px;
        text-align: center;
        font-size: 25px;
        font-family: sans-serif;
        margin-top: 10px;
        margin-bottom: 20px;
        padding: 5x;
        color: white;        
        letter-spacing: 10px;
    }
    .flex-container {
        display: flex;
        flex-direction: row;
        height: 100%;
    }
    .info {
        flex: 1;
        text-align: left;
        font-size: 18px;
        line-height: 28px;
        margin: 10px;
        padding-left: 20px;
        padding-right: 20px;
        text-align: justify;
        background-color: #111;
        border: 1px solid white;
        box-shadow: 0px 1px 2px 2px black;
        font-style: italic;
    }
    #current {
        display: flex;
        flex-wrap: wrap;
        width: 70%;
        height: 100%;
    }
    .item {
        font-size: 100px;
        margin: 4px;
        padding: 4px;
        text-align: center;
        height: 120px;
    }
    .note {
        width: 180px;
    }    
    .white-key {
        color: black;
        background-color: white;
    }
    .black-key {
        color: white;
        background-color: black;
    }
    .octave {
        font-size: 50px;
        opacity: 70%;
    }
    .chord {
        color: white;
        background-color: green;
        min-width: 376px;
    }
    .inverted {
        color: black;
        background-color: #db7fff;
        position: relative;
    }
    .inversion-number {
        position: absolute;
        top: 0px;
        left: 0px;
        font-size: 20px;
        margin: 5px;
        padding: 5px;
        width: 15px;
        height: 15px;
    }
    .sidebar {
        display: flex;
        flex-wrap: wrap;        
        width: 10%;
        height: 100%;
        font-size: 20px;
        text-align: center;
        overflow-y: auto;
        flex: 1;
    }
    .small-item {
        color: white;
        margin: 1px;
        padding: 1px;
        text-align: left;
        font-size: 14px;
    }
    .small-note {
        width: 50px;
    }
    .small-chord {
        width: 120px;
    }
    .scales {
        flex-wrap: wrap;
        font-style: italic;
        font-size: 20px;
    }
    .scale-group {
        margin: 2px;
    }
    .scale {
        margin: 4px;
        padding: 4px;
        flex-wrap: wrap;
    }    
    .scale-key {
        color: yellow;
    }
    .scale-degree {
        color: white;
        font-size: 18px;
    }
    .break {
        flex-basis: 100%;
        height: 0;
    }
</style>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />