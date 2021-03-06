/**
  @public
  @class MIDIEvent
  @param time {int} the time that the event is scheduled
  @param type {int} type of MIDIEvent, e.g. NOTE_ON, NOTE_OFF or, 144, 128, etc.
  @param data1 {int} if type is 144 or 128: note number
  @param [data2] {int} if type is 144 or 128: velocity
  @param [channel] {int} channel


  @example
  // plays the central c at velocity 100
  let event = sequencer.createMIDIEvent(120, sequencer.NOTE_ON, 60, 100);

  // pass arguments as array
  let event = sequencer.createMIDIEvent([120, sequencer.NOTE_ON, 60, 100]);

*/


'use strict';


import {log, info, warn, error, typeString, createState} from './util';
import {createNote} from './note.js';


let
  midiEventId = 0;


/*
  arguments:
   - [ticks, type, data1, data2, channel]
   - ticks, type, data1, data2, channel

  data2 and channel are optional but must be numbers if provided
*/

export class MIDIEvent{
  constructor(...args){
    let note;

    this.id = 'M' + midiEventId++ + Date.now();
    this.eventNumber = midiEventId;
    this.time = 0;
    this.muted = false;
    this._state = createState();


    if(args === undefined || args.length === 0){
      // bypass contructor for cloning
      return;
    }else if(typeString(args[0]) === 'midimessageevent'){
      info('midimessageevent');
      return;
    }else if(typeString(args[0]) === 'array'){
      // support for un-spreaded parameters
      args = args[0];
      if(typeString(args[0]) === 'array'){
        // support for passing parameters in an array
        args = args[0];
      }
    }

    args.forEach(function(data, i){
      if(isNaN(data) && i < 5){
        error('please provide numbers for ticks, type, data1 and optionally for data2 and channel');
      }
    });

    this.ticks = args[0];
    this.status = args[1];
    this.type = (this.status >> 4) * 16;
    //console.log(this.type, this.status);
    if(this.type >= 0x80 && this.type <= 0xE0){
      //the higher 4 bits of the status byte is the command
      this.command = this.type;
      //the lower 4 bits of the status byte is the channel number
      this.channel = (this.status & 0xF) + 1; // from zero-based to 1-based
    }else{
      this.type = this.status;
      this.channel = args[4] || 1;
    }

    this._sortIndex = this.type + this.ticks; // note off events come before note on events

    switch(this.type){
      case 0x0:
        break;
      case 0x80:
        this.data1 = args[2];
        note = createNote(this.data1);
        this.note = note;
        this.noteName = note.fullName;
        this.noteNumber = note.number;
        this.octave = note.octave;
        this.frequency = note.frequency;
        this.data2 = 0;//data[3];
        this.velocity = this.data2;
        break;
      case 0x90:
        this.data1 = args[2];//note number
        this.data2 = args[3];//velocity
        if(this.data2 === 0){
          //if velocity is 0, this is a NOTE OFF event
          this.type = 0x80;
        }
        note = createNote(this.data1);
        this.note = note;
        this.noteName = note.fullName;
        this.noteNumber = note.number;
        this.octave = note.octave;
        this.frequency = note.frequency;
        this.velocity = this.data2;
        break;
      case 0x51:
        this.bpm = args[2];
        break;
      case 0x58:
        this.nominator = args[2];
        this.denominator = args[3];
        break;
      case 0xB0:// control change
        this.data1 = args[2];
        this.data2 = args[3];
        this.controllerType = args[2];
        this.controllerValue = args[3];
        break;
      case 0xC0:// program change
        this.data1 = args[2];
        this.programNumber = args[2];
        break;
      case 0xD0:// channel pressure
        this.data1 = args[2];
        this.data2 = args[3];
        break;
      case 0xE0:// pitch bend
        this.data1 = args[2];
        this.data2 = args[3];
        break;
      case 0x2F:
        break;
      default:
        warn('not a recognized type of midi event!');
    }
  }



  clone(){
    let event = new MIDIEvent();

    for(let property of Object.keys(this)){
      if(property !== 'id' && property !== 'eventNumber' && property !== 'midiNote'){
        event[property] = this[property];
      }
      event.song = undefined;
      event.track = undefined;
      event.trackId = undefined;
      event.part = undefined;
      event.partId = undefined;
    }
    return event;
  }



  transpose(semi){
    if(this.type !== 0x80 && this.type !== 0x90){
      error('you can only transpose note on and note off events');
      return;
    }

    //console.log('transpose', semi);
    if(typeString(semi) === 'array'){
      let type = semi[0];
      if(type === 'hertz'){
        //convert hertz to semi
      }else if(type === 'semi' || type === 'semitone'){
        semi = semi[1];
      }
    }else if(isNaN(semi) === true){
      error('please provide a number');
      return;
    }

    let tmp = this.data1 + parseInt(semi, 10);
    if(tmp < 0){
      tmp = 0;
    }else if(tmp > 127){
      tmp = 127;
    }
    this.data1 = tmp;
    let note = createNote(this.data1);
    this.note = note;
    this.noteName = note.fullName;
    this.noteNumber = note.number;
    this.octave = note.octave;
    this.frequency = note.frequency;

    if(this.midiNote !== undefined){
      this.midiNote.pitch = this.data1;
    }

    if(this._state.part !== 'new'){
      this._state.part = 'transposed';
    }
    this._update();
  }



  setPitch(pitch){
    if(this.type !== 0x80 && this.type !== 0x90){
      error('you can only set the pitch of note on and note off events');
      return;
    }
    if(typeString(pitch) === 'array'){
      let type = pitch[0];
      if(type === 'hertz'){
        //convert hertz to pitch
      }else if(type === 'semi' || type === 'semitone'){
        pitch = pitch[1];
      }
    }else if(isNaN(pitch) === true){
      error('please provide a number');
      return;
    }

    this.data1 = parseInt(pitch,10);
    let note = createNote(this.data1);
    this.note = note;
    this.noteName = note.fullName;
    this.noteNumber = note.number;
    this.octave = note.octave;
    this.frequency = note.frequency;

    if(this.midiNote !== undefined){
      this.midiNote.pitch = this.data1;
    }
    if(this._state.part !== 'new'){
      this._state.part = 'transposed';
    }
    this._update();
  }



  move(ticks){
    if(isNaN(ticks)){
      error('please provide a number');
      return;
    }
    this.ticks += parseInt(ticks, 10);
    this._sortIndex = this.type + this.ticks
    //@todo: set duration of midi note
    if(this._state.part !== 'new'){
      this._state.part = 'moved';
    }
    this._update();
  }



  moveTo(...position){

    if(position[0] === 'ticks' && isNaN(position[1]) === false){
      this.ticks = parseInt(position[1], 10);
    }else if(this.song === undefined){
      console.error('The midi event has not been added to a song yet; you can only move to ticks values');
    }else{
      position = this.song.getPosition(position);
      if(position === false){
        console.error('wrong position data');
      }else{
        this.ticks = position.ticks;
      }
    }
    this._sortIndex = this.type + this.ticks
    if(this._state.part !== 'new'){
      this._state.part = 'moved';
    }
    this._update();
  }


  reset(fromPart = true, fromTrack = true, fromSong = true){

    if(fromPart){
      this.part = undefined;
      this.partId = undefined;
    }
    if(fromTrack){
      this.track = undefined;
      this.trackId = undefined;
      this.channel = 0;
    }
    if(fromSong){
      this.song = undefined;
    }
    this._state.part = 'removed';
    this._update();
  }


  update(){
    if(this.part !== undefined){
      this.part._needsUpdate = true;
    }
  }
}

export function createMIDIEvent(){
  return new MIDIEvent(...arguments);
}
