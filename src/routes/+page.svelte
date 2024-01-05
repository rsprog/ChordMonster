<script>

    import { browser } from '$app/environment';

    const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

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
        constructor(name, notes, rootIndex) {
            this.name = name;
            this.notes = notes;
            this.rootIndex = rootIndex;
        }
        get isInverted() {
            return this.rootIndex > 0;
        }
        get inversionNumber() {
            return this.rootIndex === 0 ? 0 : this.notes.length - this.rootIndex;
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
        constructor(scale, degree) {
            this.scale = scale;
            this.degree = degree;
        }
        degreeSymbols = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        get name() {
            return `${this.scale.nameWithKey} [${this.degree}]`;
        }
        get symbol() {
            return this.degreeSymbols[this.degree];
        }
    }

    let midi = null;
    let midiInputs = [];
    let notesMap = new Map();
    let currentNotes = [];
    let currentChord = null;
    let currentScaleDegrees = [];
    let allNotes = [];
    let allChords = [];
    let errorMessage = null;

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
            const midiNoteNumber = keyCodeToMIDINote(event.keyCode);
            if (midiNoteNumber) {
                event.preventDefault();
                handleNoteOn(midiNoteNumber);
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
        currentNotes = [...notesMap].sort().map(([k,v]) => v);
        allNotes = [...allNotes, note.noteWithOctave];
        identifyChord();
    }

    function handleNoteOff(midiNoteNumber)
    {
        notesMap.delete(midiNoteNumber);
        currentNotes = [...notesMap].sort().map(([k,v]) => v);
        identifyChord();
    }

    function identifyChord()
    {        
        currentChord = null;
        currentScaleDegrees = [];
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
            currentScaleDegrees = getChordScales(chord);
        }
    }

    function getNote(midiNoteNumber) {
        const octave = Math.floor(midiNoteNumber / 12) - 1;
        const noteIndex = midiNoteNumber % 12;
        return new Note(midiNoteNumber, noteNames[noteIndex], noteIndex, octave);
    }

    function getTriadChord(midiNotes) {

        if (midiNotes.length !== 3)
            return null;

        const triads = [
            { intervals: [3, 4], rootIndex: 0, format: 'Rmin' },    // Minor chord (root position)
            { intervals: [4, 5], rootIndex: 2, format: 'R/Bmin' },  // Minor chord (first inversion)
            { intervals: [5, 3], rootIndex: 1, format: 'R/Bmin' },  // Minor chord (second inversion)

            { intervals: [4, 3], rootIndex: 0, format: 'Rmaj' },    // Major chord (root position)
            { intervals: [3, 5], rootIndex: 2, format: 'R/Bmaj' },  // Major chord (first inversion)
            { intervals: [5, 4], rootIndex: 1, format: 'R/Bmaj' },  // Major chord (second inversion)

            { intervals: [3, 3], rootIndex: 0, format: 'Rdim' },    // Diminished chord (root position)
            { intervals: [3, 6], rootIndex: 2, format: 'R/Bdim' },  // Diminished chord (first inversion)
            { intervals: [6, 3], rootIndex: 1, format: 'R/Bdim' },  // Diminished chord (second inversion)

            { intervals: [4, 4], rootIndex: 0, format: 'Raug' },    // Augmented chord (root position)
            { intervals: [2, 5], rootIndex: 0, format: 'Rsus2' },   // Suspended Second chord (root position)
            { intervals: [5, 2], rootIndex: 0, format: 'Rsus4' },   // Suspended Fourth chord (root position)
        ];

        return getChord(midiNotes, triads);        
    }

    function getTetradChord(midiNotes) {

        if (midiNotes.length !== 4)
            return null;

        const tetrads = [
            { intervals: [4, 3, 4], rootIndex: 0, format: 'Rmaj7' },      // Major seventh chord (root position)
            { intervals: [3, 4, 3], rootIndex: 0, format: 'Rmin7' },      // Minor seventh chord (root position)
            { intervals: [4, 3, 3], rootIndex: 0, format: 'R7' },         // Dominant seventh chord (root position)
            { intervals: [3, 3, 4], rootIndex: 0, format: 'Rø7' },        // Half-Diminished seventh chord (root position)
            { intervals: [3, 3, 3], rootIndex: 0, format: 'Rdim7' },      // Diminished seventh chord (root position)
            { intervals: [3, 4, 4], rootIndex: 0, format: 'RminMaj7' },   // Minor-Major seventh chord (root position)

            // First Inversions
            { intervals: [3, 4, 1], rootIndex: 3, format: 'R/Bmaj7' },    // Major seventh chord (first inversion)
            { intervals: [4, 3, 2], rootIndex: 3, format: 'R/Bmin7' },    // Minor seventh chord (first inversion)
            { intervals: [3, 3, 2], rootIndex: 3, format: 'R/B7' },       // Dominant seventh chord (first inversion)
            { intervals: [3, 4, 2], rootIndex: 3, format: 'R/Bø7' },      // Half-Diminished seventh chord (first inversion)
            { intervals: [3, 3, 3], rootIndex: 3, format: 'R/Bdim7' },    // Diminished seventh chord (first inversion)
            { intervals: [4, 4, 1], rootIndex: 3, format: 'R/BminMaj7' }, // Minor-Major seventh chord (first inversion)

            // Second Inversions
            { intervals: [4, 1, 4], rootIndex: 2, format: 'R/Bmaj7' },    // Major seventh chord (second inversion)
            { intervals: [3, 2, 3], rootIndex: 2, format: 'R/Bmin7' },    // Minor seventh chord (second inversion)
            { intervals: [3, 2, 4], rootIndex: 2, format: 'R/B7' },       // Dominant seventh chord (second inversion)
            { intervals: [4, 2, 3], rootIndex: 2, format: 'R/Bø7' },      // Half-Diminished seventh chord (second inversion)
            { intervals: [3, 3, 3], rootIndex: 2, format: 'R/Bdim7' },    // Diminished seventh chord (second inversion)
            { intervals: [4, 1, 3], rootIndex: 2, format: 'R/BminMaj7' }, // Minor-Major seventh chord (second inversion)

            // Third Inversions
            { intervals: [1, 4, 3], rootIndex: 1, format: 'R/Bmaj7' },    // Major seventh chord (third inversion)
            { intervals: [2, 3, 4], rootIndex: 1, format: 'R/Bmin7' },    // Minor seventh chord (third inversion)
            { intervals: [2, 4, 3], rootIndex: 1, format: 'R/B7' },       // Dominant seventh chord (third inversion)
            { intervals: [2, 3, 3], rootIndex: 1, format: 'R/Bø7' },      // Half-Diminished seventh chord (third inversion)
            { intervals: [3, 3, 3], rootIndex: 1, format: 'R/Bdim7' },    // Diminished seventh chord (third inversion)
            { intervals: [1, 3, 4], rootIndex: 1, format: 'R/BminMaj7' }, // Minor-Major seventh chord (third inversion)
        ];

        return getChord(midiNotes, tetrads);
    }


    function getChord(midiNotes, chords) {

        const sortedNotes = midiNotes.sort((a, b) => a - b);
        const intervals = getIntervals(sortedNotes);
        let chord = null;
        
        chords.forEach((c) => {
            if (c.intervals.every((value, index) => value === intervals[index])) {
                const rootNote = getNote(sortedNotes[c.rootIndex]).name;
                const bassNote = c.rootIndex === 0 ? rootNote : getNote(sortedNotes[0]).name;
                chord = new Chord(c.format.replace('R', rootNote).replace('B', bassNote), sortedNotes, c.rootIndex);
            }
        });
        
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
            65: 60, // A -> C4
            87: 61, // W -> C#4
            83: 62, // S -> D4
            69: 63, // E -> D#4
            68: 64, // D -> E4
            70: 65, // F -> F4
            84: 66, // T -> F#4
            71: 67, // G -> G4
            89: 68, // Y -> G#4
            72: 69, // H -> A4
            85: 70, // U -> A#4
            74: 71, // J -> B4
            75: 72, // K -> C5
            79: 73, // O -> C#5
            76: 74, // L -> D5
            80: 75, // P -> D#5
        };
        const midiNote = keyMap[keyCode] || null;
        return midiNote;
    }

    function getChordScales(chord) {
        const scales = {
            "Major": [2, 2, 1, 2, 2, 2, 1],          // natural major scale
            "Minor": [2, 1, 2, 2, 1, 2, 2],          // matural minor scale
            "Harmonic Major": [2, 2, 1, 2, 1, 3, 1],  // harmonic major scale
            "Harmonic Minor": [2, 1, 2, 2, 1, 3, 1],  // harmonic minro scale
            "Melodic Major": [2, 2, 1, 2, 1, 2, 2],   // melodic major scale
            "Melodic Minor": [2, 1, 2, 2, 2, 2, 1],   // melodic minor scale
        };        
        const chordIntervals = getIntervals(chord.notes);
        const chordNoteIndexes = chord.notes.map(s => getNote(s).index);
        const matchedScales = [];
        const startIndex = 1 + (chord.notes.length - 2) * 2;
        
        for (let scale in scales) {
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
                            matchedScales.push(new ScaleDegree(new Scale(scale, k), scaleNoteIndexes.indexOf(chordNoteIndexes[0]) + 1));
                        }
                    }
                    break;
                }
            }
        }

        return matchedScales;
    }

    if (browser)
        navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure );

    

</script>

<main>

    <div id="devices">
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

            {#if currentScaleDegrees}
                <div class="flex-container scales">
                    {#each currentScaleDegrees as deg}
                        <span class="scale"><span class="scale-key">{deg.scale.nameWithKey} </span><span class="scale-degree">{deg.symbol}</span></span>
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
    #devices {
        margin-bottom: 10px;
        padding: 4px;
        border-bottom: 2px solid #555;
    }
    .flex-container {
        display: flex;
        flex-direction: row;
        height: 100%;
        justify-content: center;
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
        padding-left: 20px;
        padding-right: 20px;
        flex: 1;
    }
    .inverted {
        color: black;
        background-color: #db7fff;
        position: relative;
    }
    .inversion-number {
        position: absolute;
        border: 1px solid black;
        top: 0px;
        right: 0px;
        font-size: 25px;
        margin: 5px;
        padding: 5px;
        width: 25px;
        height: 25px;
        color: #db7fff;
        background-color: black;
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
    #all-chords {
        flex-direction: column;
        flex-wrap: nowrap;
        align-items: center;
    }
    .small-item {
        margin: 1px;
        padding: 1px;
        text-align: center;
    }
    .small-note {
        color: white;
        width: 50px;
    }
    .small-chord {
        color: white;
    }
    .scales {
        flex-wrap: wrap;
        font-style: italic;
    }
    .scale {
        margin: 8px;
        padding: 4px;
        flex-wrap: wrap;
    }
    .scale-key {
        color: yellow;
        font-size: 25px;
    }
    .scale-degree {
        color: white;
        font-size: 15px;
    }
    .break {
        flex-basis: 100%;
        height: 0;
    }
</style>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />