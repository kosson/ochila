const UserModel = require('../../../models/user');
const mongoose  = require('mongoose');

function googleStrategy (request, accessToken, refreshToken, params, profile, done) {
    // popularea modelului cu date
    const record = {
        _id: new mongoose.Types.ObjectId(),
        email: profile._json.email,
        googleID: profile.id,
        googleProfile: {
            name:          profile._json.name,
            given_name:    profile._json.given_name,
            family_name:   profile._json.family_name,
            picture:       profile._json.picture,
            token:         accessToken,
            refresh_token: refreshToken,
            token_type:    params.token_type,
            expires_in:    params.expires_in
        },
        roles: {
            admin:  false,
            public: false,
            roles:  [],
            unit:   []
        },
        created: Date.now()
    };
    // numără câte înregistrări sunt în colecție.
    // var noRecs = userModel.find().estimatedDocumentCount( (err, count) => { // FIXME: Folosește secvența când faci upgrade la MongoDB 4.0.3 sau peste
    UserModel.find().countDocuments( (err, count) => {
        if (err) {
            console.log(err);
        }
        // DACĂ nu găsește nicio înregistrare, o va crea pe prima care va avea calitatea de admin
        if (count == 0) {
            record.roles.push('admin'); // introdu rolul de administrator în array-ul rolurilor
            // FIXME: [ROLURI] Ieși din hardocadarea rolurilor. Constituie un mecanism separat de acordare ale acestora. Primul admin ca trebuie să aibă un mecanism de creare de roluri noi și acordare ale acestora.
            record.roles.unit.push('global'); // unitatea este necesară pentru a face segregări ulterioare în funcție de apartenența la o unitate orice ar însemna aceasta
            record.roles.admin = true;

            // Constituie documentul Mongoose pentru modelul `UserModel`.
            const userObj = new UserModel(record);
            // Salvează documentul în bază! În același timp, profilul a fi indexat în Elasticsearch (vezi în model!).
            userObj.save(function (err, user) {
                if (err) throw new Error('Eroarea la salvarea userului este: ', err.message);
                // console.log("Salvez user în bază!");
                done(null, user);
            });
        // DACĂ sunt înregistrări în colecție, caută după email dacă deja există
        } else {
            UserModel.findOne({ email: profile._json.email }, (err, user) => {
                if (err) throw new Error('A apărut următoarea eroare la căutarea utilizatorului: ', err.message);    
                
                // Dacă userul există deja, treci pe următorul middleware.
                if (user) {
                    // console.log(user.roles);
                    done(null, user); 
                } else {
                    // FIXME: Aici se face limitarea accesului pentru această strategie doar a celor care au email pe domeniul google.com
                    if (profile._json.email.endsWith('@google.com')) {
                        record.roles.push("user"); // în afară de admin, toți cei care se vor loga ulterior vor porni ca useri simpli
                    } else {
                        // dacă cineva din exteriorul proiectului se înscrie, contul va fi asimilat publicului. Acesta va putea da calificări, pot comenta, etc.
                        record.roles.public = true;
                    }
                    // dacă NU există acest user în bază, va fi adăugat fără a fi admin.
                    record.roles.admin = false;
                    // TODO: Este locul unde poți explora conceptul de comunități!
                    record.roles.unit.push('global'); // unitatea este necesară pentru a face segregări ulterioare în funcție de apartenența la o unitate orice ar însemna aceasta
                    
                    // constituie documentul în baza modelului `UserModel` și salvează-l în bază. Atenție, va fi indexat și în Elasticsearch (vezi modelul).
                    const UserDoc = new UserModel(record);
                    UserDoc.save(function (err, user) {
                        if (err) throw err;
                        // console.log("Salvez user în bază!");
                        done(null, user);
                    });
                }
            });
        }
    });
}
module.exports = googleStrategy;