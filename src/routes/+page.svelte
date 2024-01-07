<script>

    import { browser } from '$app/environment';

    const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

    // below symbols are appended to roman numerals shown in scales, while notation is shown in the chord tile
    const chordTypes = {        
        'maj': {symbol: '', notation:'', dom: true}, // major triad
        'min': {symbol: '', notation:'m', dom: false}, // minor triad
        'aug': {symbol: '⁺', notation:'aug', dom: true}, // augmented triad
        'dim': {symbol: '°', notation:'dim', dom: false}, // diminished triad
        'sus2': {symbol: 'sus2', notation:'sus2', dom: true}, // second suspended triad
        'sus4': {symbol: 'sus4', notation:'sus4', dom: true}, // fourth suspended triad
        'maj7': {symbol: '⁷', notation:'7', dom: true}, // major seventh
        'min7': {symbol: '⁷', notation:'m7', dom: false}, // minor seventh
        'dom7': {symbol: '⁷', notation:'dom7', dom: true}, // dominant seventh
        'dim7': {symbol: '°⁷', notation:'dim7', dom: false}, // diminished seventh
        'min7♭5': {symbol: 'ø⁷', notation:'m7♭5', dom: false}, // half-diminished seventh
        'maj7♯5': {symbol: '⁺⁷', notation:'7♯5', dom: true}, // augmented seventh
        'minMaj7': {symbol: 'ᴹ⁷', notation:'mM7', dom: false}, // minor major seventh
        '7sus2': {symbol: '⁷sus2', notation:'7sus2', dom: true}, // second suspended seventh
        '7sus4': {symbol: '⁷sus4', notation:'7sus4', dom: true}, // fourth suspended seventh
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
        constructor(name, notes, rootIndex, chordType, isVoicing, containsDoubledNotes) {
            this.name = name; // formatted name, including the root note (and bass note for inverted chords)
            this.notes = notes; // array of sorted midi numbers
            this.rootIndex = rootIndex; // index of the root note within the notes array
            this.chordType = chordType; // chord type
            this.isVoicing = isVoicing; // indicates if this chord is open or contains doubled notes
            this.containsDoubledNotes = containsDoubledNotes; // indicates if this chord contains doubled notes
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
    let showHistory = false;

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
            else if (event.keyCode === 32) { // spacebar
                event.preventDefault();
                showHistory = !showHistory;
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
        const noteNumbers = [...notesMap].map(([k,v]) => v.number);
    
        // check for any known chords or their inversions
        let chord = getKnownChord(noteNumbers);

        // check if its a voicing (chord in open position) of any of the known chords or their inversions
        if (!chord && noteNumbers.length > 2) {
            chord = getChordFromVoicing(noteNumbers);
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

    function getKnownChord(noteNumbers) {
        if (noteNumbers.length === 4) {
            // check if its a known seventh chord or its inversion
            return getTetradChord(noteNumbers);
        }
        else if (noteNumbers.length === 3) {
             // check if its a known triad or its inversion
            return getTriadChord(noteNumbers);
        }
    }

    function getChordFromVoicing(midiNotes) {
        const sortedNotes = midiNotes.toSorted((a, b) => a - b);
        // remove duplicates of same notes at different octaves, if any
        const uniqueNotes = [...new Map(sortedNotes.map((x) => [x % 12, x]))].map(([k,v]) => v);
        // we don't know the root note of the chord, so have to assume any note could be root
        for (let i=0; i<uniqueNotes.length; i++) {
            // transpose all notes into the lowest octave
            const transposedNotes = transposeToLowestOctave(uniqueNotes, i);
            let chord = getKnownChord(transposedNotes);
            if (chord) {
                chord.isVoicing = true;
                chord.containsDoubledNotes = uniqueNotes.length < midiNotes.length;
                return chord;
            }
        }
        return null;
    }

    function getNoteInLowestOctave(midiNote) {
        const noteIndex = midiNote % 12;
        const multiplier = noteIndex < 9 ? 2 : 1; // because first 3 notes (A0, A#0, B0) appear before octave 1
        return noteIndex + (12 * multiplier);
    }

    // get shortest ascending interval between two notes
    function getShortestInterval(fromMidiNote, toMidiNote) {
        const fromNoteIndex = fromMidiNote % 12;
        const toNoteIndex = toMidiNote % 12;
        const interval = toNoteIndex - fromNoteIndex;
        return interval < 0 ? interval + 12 : interval;
    }

    // returns the provided notes in the lowest octave, removing any duplicates
    function transposeToLowestOctave(midiNotes, rootIndex) {
        const transposedNotes = [getNoteInLowestOctave(midiNotes[rootIndex])];
        const remainingNotes = midiNotes.toSpliced(rootIndex, 1);
        for (let i=0; i<remainingNotes.length; i++) {
            const shortestInterval = getShortestInterval(transposedNotes[i], remainingNotes[i]);
            transposedNotes.push(transposedNotes[i] + shortestInterval);
        }
        return transposedNotes;
    }

    function getTriadChord(midiNotes) {

        if (midiNotes.length !== 3)
            return null;

        const triads = [
            { intervals: [3, 4], rootIndex: 0, format: 'min' },  // Minor chord (root position)
            { intervals: [4, 3], rootIndex: 0, format: 'maj' },  // Major chord (root position)
            { intervals: [3, 3], rootIndex: 0, format: 'dim' },  // Diminished chord (root position)
            { intervals: [4, 4], rootIndex: 0, format: 'aug' },  // Augmented chord (root position)
            { intervals: [2, 5], rootIndex: 0, format: 'sus2' }, // Suspended Second chord (root position)
            { intervals: [5, 2], rootIndex: 0, format: 'sus4' }, // Suspended Fourth chord (root position)

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
                let chordName = rootNoteName + chordTypes[c.format].notation;
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

        <div id="all-notes" class={showHistory ? 'sidebar' : 'sidebar-disabled'}>
            {#each allNotes as note}
                <div class="small-item small-note">{note}</div>
            {/each}
        </div>

        <div id="current" style="width: {showHistory ? '70%' : '100%'};">
            {#if infoTextVisible}
            <div class="info">

                <div id="logo">
                    [chord.monster]
                </div>            

                <h4>About</h4>
                <p id="about">
                    Start playing notes using your USB-connected MIDI device or computer keyboard. 
                    If you play a triad or a seventh chord, in either root or inverted position, it will be identified and relevant scales shown where applicable. 
                    Chords in open position and/or with doubled notes will also be identified where possible. 
                    Note that not every chord and scale is spported at this time. 
                    Send any feedback to support@chord.monster                    
                </p>
                <h4>Keyboard shortcuts</h4>
                <p id="keymap">
                    Press INSERT to toggle whether or not the notes stay on the screen once the keys are released. 
                    Press DELETE to remove any notes from the screen and CTRL+DELETE to clear notes and history. 
                    Press BACKSPACE to delete last note entered. 
                    Press SPACEBAR to toggle history view of previously played notes and chords.<br /><br />
                    MIDI device support requries Chrome, Edge, Firefox or Opera browser. 
                    If not using a MIDI device, use numeric keys to set octave and use the following letters to enter notes:<br />
                    A = C, W = C#, S = D, E = D#, D = E, F = F, T = F#, G = G, Y = G#, H = A, U = A#, J = B, K = C, O = C#, L = D, P = D#
                </p>
            </div>
            {/if}
            {#each currentNotes as note}
                <div class="item note {note.isSharp ? 'black-key' : 'white-key'}">{note.name}<sub class="octave">{note.octave}</sub></div>
            {/each}

            {#if currentChord}
                <div class="item chord">
                    {#if currentChord.isInverted}
                        <div class="chord-info inverted">inversion {currentChord.inversionNumber}</div>
                    {/if}
                    {currentChord.name}
                    {#if currentChord.isVoicing}
                        <div class="chord-info voicing">{currentChord.containsDoubledNotes ? 'doubled' : 'open' }</div>
                    {/if}
                </div>
            {/if}

            <div class="break"></div>

            {#if currentScales}
                <div class="flex-container scales">
                    {#each currentScales as scales}
                        <div class="flex-container scale-group">
                            {#each scales as deg}
                                <span class="scale">
                                    <span class="scale-key">{deg.scale.nameWithKey} </span>
                                    <span class="scale-degree">{deg.symbol}</span>
                                </span>
                            {/each}
                        </div>
                        <div class="break"></div>
                    {/each}
                </div>
            {/if}
        </div>

        <div id="all-chords" class={showHistory ? 'sidebar' : 'sidebar-disabled'}>
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
        font-size: 14px;
    }
    #logo {
        text-align: center;
        font-size: 22px;
        font-family: monospace;
        margin: 20px 0px 40px 0px;
        padding: 5x;
        color: lawngreen;
        letter-spacing: 4px;
        font-style: normal;        
    }
    .flex-container {
        display: flex;
        flex-direction: row;
        height: 100%;        
    }
    .info {
        flex: 1;
        text-align: left;
        font-size: 16px;
        line-height: 24px;
        margin: 5px;
        padding-left: 20px;
        padding-right: 20px;
        text-align: justify;
        background-color: #111;
        border: 1px solid white;
        box-shadow: 0px 1px 2px 2px black;
        font-style: italic;
        max-width: 600px;
    }
    .info h4 {
        text-align: center;
        text-decoration: underline;
    }
    #current {
        display: flex;
        flex-wrap: wrap;
        width: 70%;
        height: 100%;
        justify-content: center;
    }
    .item {
        font-size: 50px;
        margin: 4px;
        padding: 4px;
        text-align: center;
        height: 70px;
    }
    .note {
        width: 100px;
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
        min-width: 216px;
        position: relative;
    }
    .chord-info {
        color: black;        
        height: 10px;
        font-size: 9px;
        position: absolute;
        left: 0px;
        width: 100%;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 4px;
    }
    .inverted {
        background-color: orange;
        top: 0px;
        border-bottom: 1px solid #333;
    }
    .voicing {
        background-color: dodgerblue;
        bottom: 0px;
        border-top: 1px solid #333;
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
    .sidebar-disabled {
        display: none;
    }
    .small-item {
        color: white;
        margin: 1px;
        padding: 1px;
        font-size: 12px;
        font-family: monospace;
    }
    .small-note {
        width: 40px;
        text-align: left;        
    }
    .small-chord {
        width: 80px;
        text-align: right;
    }
    .scales {
        flex-direction: column;
        font-style: italic;
        font-size: 14px;
        justify-content: center;
    }
    .scale-group {
        margin: 4px;
        flex-wrap: wrap;
        justify-content: center;
    }
    .scale {
        margin: 2px;
        padding: 2px;
        flex-wrap: wrap;
        white-space: nowrap;
    }    
    .scale-key {
        color: lawngreen;
    }
    .scale-degree {
        color: white;
        font-size: 12px;
    }
    .break {
        flex-basis: 100%;
        height: 0;
    }
</style>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />