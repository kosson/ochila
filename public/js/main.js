var socket = io();
var pubComm = io('/redcol');
var uuid = '';

// MANAGEMENTUL COMUNICĂRII pe socketuri
pubComm.on('mesaje', (mess) => {
    // TODO: execută funcție care afișează mesajul
    // broadcastMes(mess);
    console.log(text);
});

pubComm.on('uuid', (id) => {
    uuid = id;
    RED.uuid = id;
});