const mongoose = require('mongoose');
const mexp     = require('mongoose-elasticsearch-xp').v7;

// o entitate poate fi un fragment din textul unei cărți sau articol, poate fi un autor, poate fi chiar o altă resursă!
const EntitySchema = new mongoose.Schema({
    _id: Schema.Types.ObjectId,
    descriptor: {
        type: String,
        es_indexed: true
    },
    content: {
        type: String,
        index: true,
        trim: true,
        es_indexed: true
    },
    subject: {
        type: String,
        es_indexed: true
    },
    type: [],
    source: [], // așa cum este definit de Dublin Core
    identifier: []
});

EntitySchema.plugin(mexp); // indexare directă a înregistrărilor.

module.exports = mongoose.model('Entity', EntitySchema);