<script>

    import { browser } from '$app/environment';
    import { getNote, getChord, getScales } from '$lib/chordlib.js';

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
    let notesToKeep = 500; // how many entered notes to keep in history
    let chordsToKeep = 250; // how many entered chords to keep in history

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
            if (event.code === 'Insert') {
                event.preventDefault();
                insertMode = !insertMode;
            }
            else if (event.code === 'Delete') {
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
            else if (event.code === 'Backspace') {
                event.preventDefault();
                if (notesMap.size > 0) {
                    const lastEntryKey = [...notesMap.keys()].pop();
                    notesMap.delete(lastEntryKey);
                    currentNotes = getCurrentNotes();
                    identifyChord();
                }
            }
            else if (event.code === 'Space') {
                event.preventDefault();
                showHistory = !showHistory;
            }
            else { // handle notes and octave changes
                const midiNoteNumber = keyCodeToMIDINote(event.code);
                if (midiNoteNumber) {
                    event.preventDefault();
                    handleNoteOn(midiNoteNumber);
                }
                else {
                    const octaveNumber = keyCodeToOctave(event.key);
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
            const midiNoteNumber = keyCodeToMIDINote(event.code);
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
        allNotes = [...allNotes, note.noteWithOctave].slice(-notesToKeep);
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
        const chord = getChord(noteNumbers);
        if (chord) {            
            currentChord = chord;
            allChords = [...allChords, chord.name].slice(-chordsToKeep);
            currentScales = getScales(chord);
        }
    }
    
    function getCurrentNotes()
    {
        const notes = [...notesMap].map(([k,v]) => v).toSorted((a,b) => a.number-b.number);
        for (let i=0; i<notes.length; i++) {
            notes[i].isDuplicated = notes.slice(0, i).map(v => v.index).includes(notes[i].index);
        }
        return notes;
    }

    function keyCodeToMIDINote(keyCode) {
        const keyMap = {
            'KeyA': 12, // A -> C
            'KeyW': 13, // W -> C#
            'KeyS': 14, // S -> D
            'KeyE': 15, // E -> D#
            'KeyD': 16, // D -> E
            'KeyF': 17, // F -> F
            'KeyT': 18, // T -> F#
            'KeyG': 19, // G -> G
            'KeyY': 20, // Y -> G#
            'KeyH': 21, // H -> A
            'KeyU': 22, // U -> A#
            'KeyJ': 23, // J -> B
            'KeyK': 24, // K -> C
            'KeyO': 25, // O -> C#
            'KeyL': 26, // L -> D
            'KeyP': 27, // P -> D#
        };
        const midiNote = keyMap[keyCode] + (octave * 12) || null;
        return midiNote;
    }

    function keyCodeToOctave(key) {
        const val = parseInt(key);
        return val > 0 && val < 10 ? val : null;
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
                <p>
                    Start playing notes using your connected MIDI device or computer keyboard. 
                    If you play a triad or a seventh chord, in either root or inverted position, it will be identified and relevant scales shown. 
                    Chords in open position and/or with doubled notes will also be identified where possible. 
                    Note that not every chord and scale is supported at this time. 
                    Send any feedback to 
                    <span>support@</span><span style="display:none">foobar.com</span><span>chord.monster</span>
                </p>
                <h4>Keyboard shortcuts</h4>
                <p>
                    Press <strong>INSERT</strong> to toggle whether or not the notes stay on the screen once the keys are released. 
                    Press <strong>DELETE</strong> to remove any notes from the screen and <strong>CTRL+DELETE</strong> to clear notes and history. 
                    Press <strong>BACKSPACE</strong> to delete last note entered. 
                    Press <strong>SPACE</strong> to toggle history view of previously played notes and chords.<br /><br />
                    If not using a MIDI device, use numeric keys to set the octave and use the following letter keys to enter notes:
                </p>
                <div id="keymap">
                    <div>A &gt; C</div><div>W &gt; C♯</div><div>S &gt; D</div><div>E &gt; D♯</div><div>D &gt; E</div><div>F &gt; F</div><div>T &gt; F♯</div><div>G &gt; G</div>
                    <div>Y &gt; G♯</div><div>H &gt; A</div><div>U &gt; A♯</div><div>J &gt; B</div><div>K &gt; C</div><div>O &gt; C♯</div><div>L &gt; D</div><div>P &gt; D♯</div>
                </div>
            </div>
            {/if}
            {#each currentNotes as note}
                <div class="item note {note.isSharp ? 'black-key' : 'white-key'} {note.isDuplicated ? 'dup-note' : ''}">
                    {note.name}<sub class="octave">{note.octave}</sub>
                </div>
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
        font-family: 'Source Code Pro', monospace;
        margin: 20px 0px 40px 0px;
        padding: 5x;
        color: orange;
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
    #keymap {
        display: flex;
        flex-wrap: wrap;
        flex-direction: row;
        justify-content: center;
        margin-bottom: 20px;
        font-weight: 800;
        font-style: normal;
    }
    #keymap div {
        color: black;
        background-color: #CCC;
        margin: 2px;
        width: 70px;
        text-align: center;
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
        line-height: 70px;
    }
    .note {
        width: 100px;
    }
    .dup-note {
        opacity: 40%;
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
        font-size: 25px;
        opacity: 70%;
    }
    .chord {
        color: white;
        background-color: green;
        min-width: 216px;
        position: relative;
    }
    .chord-info {
        color: #333;
        height: 10px;
        line-height: 10px;
        font-size: 10px;
        font-family: sans-serif;
        position: absolute;
        left: 0px;
        width: 100%;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 4px;
    }
    .inverted {
        background-color: burlywood;
        top: 0px;
        border-bottom: 1px solid #333;
    }
    .voicing {
        background-color: palegreen;
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
        margin-top: 20px;
    }
    .scale-group {
        margin: 10px;
        flex-wrap: wrap;
        justify-content: center;
    }
    .scale {
        margin: 1px;
        padding-left: 5px;
        padding-right: 5px;
        flex-wrap: wrap;
        white-space: nowrap;
    }    
    .scale-key {
        color: orange;
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