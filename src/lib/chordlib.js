export const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// below symbols are appended to roman numerals shown in scales, while notation is shown in the chord tile
export const chordTypes = {        
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

export class Note {
    constructor(number, name, index, octave) {
        this.number = number;
        this.name = name;
        this.index = index;
        this.octave = octave;
    }
    isDuplicated = false;
    get noteWithOctave() {
        return this.name + this.octave;
    }
    get isSharp() {
        return this.name.includes('♯');
    }
}

export class Chord {
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

export class Scale {
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

export class ScaleDegree {
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

export function getNote(midiNoteNumber) {
    const octave = Math.floor(midiNoteNumber / 12) - 1;
    if (octave >= 0) {
        const noteIndex = midiNoteNumber % 12;
        return new Note(midiNoteNumber, noteNames[noteIndex], noteIndex, octave);
    }
    return null;
}

export function getChord(noteNumbers) {

    // check for any known chords or their inversions
    let chord = getKnownChord(noteNumbers);

    // check if its a voicing (chord in open position) of any of the known chords or their inversions
    if (!chord && noteNumbers.length > 2) {
        chord = getChordFromVoicing(noteNumbers);
    }
    
    return chord;
}

export function getScales(chord) {
    const scales = {
        "Major": [2, 2, 1, 2, 2, 2, 1],           // natural major scale
        "Minor": [2, 1, 2, 2, 1, 2, 2],           // natural minor scale
        "Harmonic Major": [2, 2, 1, 2, 1, 3, 1],  // harmonic major scale
        "Harmonic Minor": [2, 1, 2, 2, 1, 3, 1],  // harmonic minor scale
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
                        matchedScales.push(new ScaleDegree(
                            new Scale(scale, k),
                            scaleNoteIndexes.indexOf(chordNoteIndexes[0]) + 1,
                            chord.chordType));
                    }
                }
                matched.push(matchedScales);
                break;
            }
        }
    }

    return matched;
}

// inverts the specified interval by one
export function invertInterval(interval) {
    return [...interval.slice(-(interval.length - 1)), 12 - interval.reduce((a, c) => a + c)];
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
        { intervals: [3, 4], format: 'min' },  // Minor chord (root position)
        { intervals: [4, 3], format: 'maj' },  // Major chord (root position)
        { intervals: [3, 3], format: 'dim' },  // Diminished chord (root position)
        { intervals: [4, 4], format: 'aug' },  // Augmented chord (root position)
        { intervals: [2, 5], format: 'sus2' }, // Suspended Second chord (root position)
        { intervals: [5, 2], format: 'sus4' }, // Suspended Fourth chord (root position)
    ];

    return getChordFromIntervals(midiNotes, triads);        
}

function getTetradChord(midiNotes) {

    if (midiNotes.length !== 4)
        return null;

    const tetrads = [
        { intervals: [4, 3, 4], format: 'maj7' },      // Major seventh chord (root position)
        { intervals: [3, 4, 3], format: 'min7' },      // Minor seventh chord (root position)
        { intervals: [4, 3, 3], format: 'dom7' },      // Dominant seventh chord (root position)
        { intervals: [3, 3, 4], format: 'min7♭5' },    // Half-Diminished seventh chord (root position)
        { intervals: [3, 3, 3], format: 'dim7' },      // Diminished seventh chord (root position)
        { intervals: [3, 4, 4], format: 'minMaj7' },   // Minor-Major seventh chord (root position)
        { intervals: [4, 4, 3], format: 'maj7♯5' },    // Augmented seventh chord (root position)
        { intervals: [2, 5, 3], format: '7sus2' },     // Seventh suspended second chord (root position)
        { intervals: [5, 2, 3], format: '7sus4' },     // Seventh suspended fourth chord (root position)
    ];

    return getChordFromIntervals(midiNotes, tetrads);
}

function getChordFromIntervals(midiNotes, chordIntervals) {

    const sortedNotes = midiNotes.toSorted((a, b) => a - b);
    const intervals = getIntervals(sortedNotes);
    let chord = null;
    
    const allChordIntervals = appendInvertedChordIntervals(chordIntervals);

    for (let c of allChordIntervals) {
        if (c.intervals.length === intervals.length && c.intervals.every((value, index) => value === intervals[index])) {
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

function appendInvertedChordIntervals(chordIntervals) {
    const invertedIntervals = [];
    for (const [index, c] of chordIntervals.entries()) {
        c.chordIndex = index;
        c.rootIndex = 0;
        c.inversion = 0;
        let currentInterval = c.intervals;
        for (let i=0; i<c.intervals.length; i++) {
            const inverted = invertInterval(currentInterval);
            invertedIntervals.push({
                intervals: inverted,
                format: c.format,
                chordIndex: index,                
                rootIndex: currentInterval.length-i,
                inversion: i+1,
            });
            currentInterval = inverted;
        }
    }
    return [...chordIntervals, ...invertedIntervals]
        .toSorted((a,b) => a.inversion - b.inversion || a.chordIndex - b.chordIndex);
}
