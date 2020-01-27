const mongoose = require('mongoose');
const mexp     = require('mongoose-elasticsearch-xp');

let PersonSchema = new mongoose.Schema({
    name: String,
    identifiers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Entity'
    }]
});

Persoana.plugin(mexp);

module.exports = new mongoose.model('Person', PersonSchema);