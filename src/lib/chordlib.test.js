import { expect, test } from 'vitest'
import { getNote, getChord, getScales, invertInterval, chordTypes, Chord } from './chordlib.js'

test ('gets major note', () => {
    const result = getNote(60);
    expect(result.number).toBe(60);
    expect(result.name).toBe('C');
    expect(result.octave).toBe(4);
    expect(result.index).toBe(0);
})

test ('gets minor note', () => {
    const result = getNote(61);
    expect(result.number).toBe(61);
    expect(result.name).toBe('C♯');
    expect(result.octave).toBe(4);
    expect(result.index).toBe(1);
})

test ('returns null if note does not exist', () => {
    const result = getNote(11);
    expect(result).toBeNull();
})

test ('gets lowest playable note', () => {
    const result = getNote(21);
    expect(result.number).toBe(21);
    expect(result.name).toBe('A');
    expect(result.octave).toBe(0);
    expect(result.index).toBe(9);
})

test ('gets highest midi note', () => {
    const result = getNote(127);
    expect(result.number).toBe(127);
    expect(result.name).toBe('G');
    expect(result.octave).toBe(9);
    expect(result.index).toBe(7);
})

test ('gets major chord', () => {
    const result = getChord([64, 60, 67]);
    expect(result.name).toBe('C');
    expect(result.rootIndex).toBe(0);
    expect(result.inversionNumber).toBe(0);
    expect(result.noteCount).toBe(3);
    expect(result.isVoicing).toBeFalsy();
    expect(result.containsDoubledNotes).toBeFalsy();
})

test ('gets minor chord', () => {
    const result = getChord([63, 60, 67]);
    expect(result.name).toBe('Cm');
    expect(result.rootIndex).toBe(0);
    expect(result.inversionNumber).toBe(0);    
    expect(result.noteCount).toBe(3);
    expect(result.isVoicing).toBeFalsy();
    expect(result.containsDoubledNotes).toBeFalsy();
})

test ('gets first inverted chord', () => {
    const result = getChord([72, 64, 67]);
    expect(result.name).toBe('C/E');
    expect(result.rootIndex).toBe(2);
    expect(result.inversionNumber).toBe(1);    
    expect(result.noteCount).toBe(3);
    expect(result.isVoicing).toBeFalsy();
    expect(result.containsDoubledNotes).toBeFalsy();
})

test ('gets second inverted chord', () => {
    const result = getChord([72, 76, 67]);
    expect(result.name).toBe('C/G');
    expect(result.rootIndex).toBe(1);
    expect(result.inversionNumber).toBe(2);    
    expect(result.noteCount).toBe(3);
    expect(result.isVoicing).toBeFalsy();
    expect(result.containsDoubledNotes).toBeFalsy();
})

test ('gets doubled chord', () => {
    const result = getChord([64, 60, 72, 67]);
    expect(result.name).toBe('C');
    expect(result.rootIndex).toBe(0);
    expect(result.inversionNumber).toBe(0);    
    expect(result.noteCount).toBe(3);
    expect(result.isVoicing).toBeTruthy();
    expect(result.containsDoubledNotes).toBeTruthy();
})

test ('gets open chord', () => {
    const result = getChord([64, 48, 67]);
    expect(result.name).toBe('C');
    expect(result.rootIndex).toBe(0);
    expect(result.inversionNumber).toBe(0);    
    expect(result.noteCount).toBe(3);
    expect(result.isVoicing).toBeTruthy();
    expect(result.containsDoubledNotes).toBeFalsy();    
})

test ('gets first inverted open chord', () => {
    const result = getChord([64, 84, 67]);
    expect(result.name).toBe('C/E');
    expect(result.rootIndex).toBe(2);
    expect(result.inversionNumber).toBe(1);
    expect(result.noteCount).toBe(3);
    expect(result.isVoicing).toBeTruthy();
    expect(result.containsDoubledNotes).toBeFalsy();
})

test ('gets major seventh chord', () => {
    const result = getChord([64, 60, 67, 71]);
    expect(result.name).toBe('C7');
    expect(result.rootIndex).toBe(0);
    expect(result.inversionNumber).toBe(0);    
    expect(result.noteCount).toBe(4);
    expect(result.isVoicing).toBeFalsy();
    expect(result.containsDoubledNotes).toBeFalsy();
})

test ('returns null of chord does not exist', () => {
    const result = getChord([60, 61, 62]);
    expect(result).toBeNull();
})

test ('gets scales', () => {
    const result = getScales(new Chord('C7', [60, 64, 67, 71], 0, chordTypes.maj7, false, false));
    expect(result.length).toBe(4);
    expect(result[0].length).toBe(2);
    expect(result[0][0].scale.nameWithKey).toBe('C Major');
    expect(result[0][0].degree).toBe(1);
    expect(result[0][1].scale.nameWithKey).toBe('G Major');
    expect(result[0][1].degree).toBe(4);
    expect(result[1].length).toBe(2);
    expect(result[1][0].scale.nameWithKey).toBe('E Minor');
    expect(result[1][0].degree).toBe(6);
    expect(result[1][1].scale.nameWithKey).toBe('A Minor');
    expect(result[1][1].degree).toBe(3);
    expect(result[2].length).toBe(1);
    expect(result[2][0].scale.nameWithKey).toBe('C Harmonic Major');
    expect(result[2][0].degree).toBe(1);
    expect(result[3].length).toBe(1);   
    expect(result[3][0].scale.nameWithKey).toBe('E Harmonic Minor');
    expect(result[3][0].degree).toBe(6);
})

test('inverts interval', () => {
    let interval = [3, 3, 5];
    const expectedIntervals = [[3, 5, 1], [5, 1, 3], [1, 3, 3], interval];
    for (let i=0; i<expectedIntervals.length; i++) {
        const result = invertInterval(interval);
        expect(result).toEqual(expectedIntervals[i]);
        interval = result;
    }
});