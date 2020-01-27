const mongoose = require('mongoose');
const mexp     = require('mongoose-elasticsearch-xp').v7;

var ResourceSchema = new mongoose.Schema({
    _id: Schema.Types.ObjectId,

    // #1. INIȚIALIZARE ÎNREGISTRARE
    date:        Date,  // este data la care resursa intră în sistem. Data este introdusă automat la momentul în care este trimisă către baza de date.
    contributor: {type: String, trim: true, es_indexed: true},// este id-ul celui care a introdus resursa.
    creator:     [
        {type: String, trim: true} // Dacă sunt mai mulți autori, vor fi adăugați cu virgule între ei.
    ],
    language:    {type: String, trim: true},  // Este limba primară a resursei. Valoarea va fi conform ISO 639-1 (https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).
    format:      {type: String, trim: true},
    publisher:   {type: String, trim: true},

    // #2. TITLU ȘI RESPONSABILITATE
    title: {        
        type: String,  // Aici se introduce titlul lucrării în limba de elaborare
        // validate: {
        //     required: [true, 'Titlul este absolut necesar']
        // },
        index: true,
        trim: true,
        es_indexed: true
    },
    titleI18n:    [],  // Un titlu poate fi tradus în mai multe limbi. Cheia va fi o valoare conform ISO 639-2. Modificare la 639-2 pentru a permite și rromani - http://www.bibnat.ro/dyn-doc/Coduri%20de%20%20limba_639_2_2009_fin.pdf.

    // #5 DESCRIERE
    description:  {
        type: String, 
        es_indexed: true
    },
    identifier:   [{
        type: String,
        trim: true,
        es_indexed: true
    }], // Sunt diferiții identificatori ai unei resurse. Poate fi orice string, fie text, nume fișier, fie url sau ISBN... Se generează automat la încărcare. Va apărea doar la momentul accesării! Nu este disponibil la momentul încărcării.

    // #6. CONȚINUT
    dependinte:   String, // În cazul în care resursa are nevoie de un context de execuție, acesta va fi menționat aici.
    cover:        String, // [este un URI] dacă resursa are o imagine reprezentativă, video, audio, etc. Aceasta se numește generic „copertă” și va fi folosită pentru a ilustra resursa în landing page și acces restricționat specialiști
    rights:       String,
    summary:      {es_indexed: true}, // Este conținutul pe care îl permiți să fie adăugat cu Editor.js

    // #7. METRICI
    metrics:      {},  // Metrici de evaluare.
},
{ 
    toJSON: {
        virtuals: true
    }
});

// Câmpul virtual `relation` care va lega id-ul resursei cu id-ul acesteia din câmpul `source` din modelul Entity
ResourceSchema.virtual('relation', {
    ref: 'Entity',
    localField: '_id',
    foreignField: 'source'
});

ResursaSchema.plugin(mexp); // indexare directă a înregistrărilor.

// HOOKS
// Stergerea comentariilor asociate utiliatorului atunci când acesta este șters din baza de date.
ResursaSchema.pre('remove', function hRemoveCb() {
    const Coment = monoose.model('coment'); // acces direct la model fără require
    Coment.remove({ // -> Parcurge întreaga colecție a comentariilor
        // -> iar dacă un `_id`  din întreaga colecție de comentarii se potrivește cu id-urile de comentariu din întregistrarea resursei (`$in: this.Coment`), șterge-le. 
        _id: {$in: this.Coment} // se va folosi operatorul de query `in` pentru a șterge înregistrările asociate
    }).then(() => next()); // -> acesta este momentul în care putem spune că înregistrarea a fost eliminată complet.
});

module.exports = mongoose.model('Resource', ResourceSchema);