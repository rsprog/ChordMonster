export const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// known chords
// below symbols are appended to roman numerals shown in scales, while notation is shown in the chord tiles
export const chordTypes = {
    'maj': {intervals: [4, 3], symbol: '', notation:'', dom: true},                   // major triad
    'min': {intervals: [3, 4], symbol: '', notation:'m', dom: false},                 // minor triad
    'dim': {intervals: [3, 3], symbol: '°', notation:'dim', dom: false},              // diminished triad    
    'aug': {intervals: [4, 4], symbol: '⁺', notation:'aug', dom: true},               // augmented triad
    'sus2': {intervals: [2, 5], symbol: 'sus2', notation:'sus2', dom: true},          // second suspended triad
    'sus4': {intervals: [5, 2], symbol: 'sus4', notation:'sus4', dom: true},          // fourth suspended triad
    'maj7': {intervals: [4, 3, 4], symbol: '⁷', notation:'7', dom: true},             // major seventh
    'min7': {intervals: [3, 4, 3], symbol: '⁷', notation:'m7', dom: false},           // minor seventh
    'dom7': {intervals: [4, 3, 3], symbol: '⁷', notation:'dom7', dom: true},          // dominant seventh
    'dim7': {intervals: [3, 3, 3], symbol: '°⁷', notation:'dim7', dom: false},        // diminished seventh
    'min7b5': {intervals: [3, 3, 4], symbol: 'ø⁷', notation:'m7♭5', dom: false},      // half-diminished seventh
    'maj7#5': {intervals: [4, 4, 3], symbol: '⁺⁷', notation:'7♯5', dom: true},        // augmented seventh
    'minMaj7': {intervals: [3, 4, 4], symbol: 'ᴹ⁷', notation:'mM7', dom: false},      // minor major seventh
    '7sus2': {intervals: [2, 5, 3], symbol: '⁷sus2', notation:'7sus2', dom: true},    // second suspended seventh
    '7sus4': {intervals: [5, 2, 3], symbol: '⁷sus4', notation:'7sus4', dom: true},    // fourth suspended seventh
};

// known scales
export const scaleTypes = {
    "Major": [2, 2, 1, 2, 2, 2, 1],           // natural major scale
    "Minor": [2, 1, 2, 2, 1, 2, 2],           // natural minor scale
    "Harmonic Major": [2, 2, 1, 2, 1, 3, 1],  // harmonic major scale
    "Harmonic Minor": [2, 1, 2, 2, 1, 3, 1],  // harmonic minor scale
    "Melodic Major": [2, 2, 1, 2, 1, 2, 2],   // melodic major scale
    "Melodic Minor": [2, 1, 2, 2, 2, 2, 1],   // melodic minor scale
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
    const chordNotes = chord.getParentNotes();
    const chordIntervals = getIntervals(chordNotes);
    const chordNoteIndexes = chordNotes.map(s => getNote(s).index);
    const startIndex = 1 + (chordNotes.length - 2) * 2;
    const matched = [];
    
    for (let scale in scaleTypes) {
        const matchedScales = [];
        const scaleIntervals = [...scaleTypes[scale], ...scaleTypes[scale].slice(0, startIndex)];
        for (let i=startIndex; i<scaleIntervals.length; i++) {
            let intervals = [];
            for (let j=i-startIndex; j<i; j+=2) {
                intervals.push(scaleIntervals[j] + scaleIntervals[j+1]);
            }
            if (intervals.every((value, index) => value === chordIntervals[index])) {
                // scale matched, now find in which key (or keys) the chord belongs
                for (let k=0; k<noteNames.length; k++) {
                    let scaleNoteIndexes = [k];
                    for (let x of scaleTypes[scale].slice(0, -1)) {
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

export function invertInterval(interval) {
    return [...interval.slice(-(interval.length - 1)), 12 - interval.reduce((a, c) => a + c)];
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

function getKnownChord(midiNotes) {

    const sortedNotes = midiNotes.toSorted((a, b) => a - b);
    const intervals = getIntervals(sortedNotes);

    const chordIntervals = Object.entries(chordTypes).map(([key, val], index) => ({
        id: key,
        intervals: val.intervals,
        chordIndex: index,
        rootIndex: 0,
        inversion: 0,
    }));

    if (!chordIntervals.some((value) => value.intervals.length === intervals.length))
        return null;

    let chord = null;
    
    const allChordIntervals = appendInvertedChordIntervals(chordIntervals);

    for (let c of allChordIntervals) {
        if (c.intervals.length === intervals.length && c.intervals.every((value, index) => value === intervals[index])) {
            const rootNoteName = getNote(sortedNotes[c.rootIndex]).name;
            const bassNoteName = c.rootIndex === 0 ? rootNoteName : getNote(sortedNotes[0]).name;
            let chordName = rootNoteName + chordTypes[c.id].notation;
            if (bassNoteName !== rootNoteName)
                chordName += '/' + bassNoteName;
            chord = new Chord(chordName, sortedNotes, c.rootIndex, chordTypes[c.id]);
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
        let currentInterval = c.intervals;
        for (let i=0; i<c.intervals.length; i++) {
            const inverted = invertInterval(currentInterval);
            invertedIntervals.push({
                intervals: inverted,
                id: c.id,
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
