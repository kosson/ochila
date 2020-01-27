require('dotenv').config();
const fs          = require('fs-extra');
const path        = require('path');
const querystring = require('querystring');
const BagIt       = require('bagit-fs');
const uuidv1      = require('uuid/v1');
const Readable    = require('stream').Readable;
const mongoose    = require('mongoose');
const esClient    = require('../elasticsearch.config');
const Resursa     = require('../models/resursa-red'); // Adu modelul resursei
const UserModel   = require('../models/user'); // Adu modelul unui user
const Log         = require('../models/logentry'); // Adu modelul unei înregistrări de jurnal

// CĂUTARE ÎN ELASTICSEARCH
const searchDoc = async function (indexName, payload){
    return await esClient.search({
        index: indexName,
        // type: mappingType,
        body: payload
    });
};

module.exports = (express, app, passport, pubComm) => {
    /* CREEAZĂ RUTERUL */
    var router = express.Router();

    // Încarcă mecanismele de verificare ale rolurilor
    let makeSureLoggedIn = require('connect-ensure-login');
    let checkRole = require('./controllers/checkRole.helper'); // Verifică rolul pe care îl are contul    

    // IMPORTUL CONTROLLERELOR DE RUTE
    // Încarcă controlerul necesar tratării rutelor de autentificare
    var UserStrategies = require('./user/user.ctrl')(passport); // Mecanismul de autentificare -> returnează metode care verifică autentificare sau nu
    var index   = require('./index');
    var admin   = require('./administrator');
    var resurse = require('./resurse')(router);

    // ========== / ROOT =================
    app.use('/', index);

    // ========== ADMINISTRATOR ==========
    app.use('/administrator', UserStrategies.ensureAuthenticated, admin);

    // ========== RESURSE ================
    app.use('/resurse', UserStrategies.ensureAuthenticated, resurse);

    // ========== RESURSE PUBLICE ========
    app.get('/resursepublice', (req, res) => {
        let resursePublice = Resursa.find({'generalPublic': 'true'}).limit(10);
        let promiseResPub = resursePublice.exec();
        promiseResPub.then((result) => {
            res.render('resursepublice', {
                title:   "Resurse publice",
                style:   "/lib/fontawesome/css/fontawesome.min.css",
                logoimg: "img/rED-logo192.png",
                user:    req.user,
                resurse: result
            });
        }).catch((err) => {
            if (err) throw err;
        });
    });
    app.get('/resursepublice/:idres', (req, res) => {
        var record = require('./controllers/resincredid.ctrl')(req.params); // aduce resursa și transformă conținutul din JSON în HTML
        record.then(rezultat => {
            let scripts = [      
                {script: '/js/redincredadmin.js'},       
                {script: '/lib/moment/min/moment.min.js'}        
            ];
            res.render('resursa-publica', {
                user:    req.user,
                title:   "RED public",
                style:   "/lib/fontawesome/css/fontawesome.min.css",
                logoimg: "/img/red-logo-small30.png",
                credlogo: "../img/CREDlogo.jpg",
                resursa: rezultat,
                scripts
            });
        }).catch(err => {
            if (err) throw err;
        });
    });

    // ========== TAGS ===========
    app.get('/tags/:tag', (req, res) => {
        let params = req.params.trim();
        var records = require('./controllers/tag.ctrl')(params); // aduce toate resursele care au tagul asociat
    });

    // ========== LOGIN ==========
    app.get('/login', UserStrategies.login); // va fi randat template-ul de login
    app.post('/login', passport.authenticate('local', {
        successRedirect: '/resurse', // redirectează userul logat cu succes către resurse
        failureRedirect: '/login'    // dacă a apărut o eroare, reîncarcă userului pagina de login TODO: Fă să apară un mesaj de eroare!!!
    }));

    // ========== AUTH ===========
    app.get('/auth', UserStrategies.auth); // Încarcă template-ul hbs pentru afișarea butonului de autorizare
    // AUTH/GOOGLE -> RUTA BUTONULUI CATRE SERVERUL DE AUTORIZARE (trebuie să ai deja ClientID și Secretul)
    app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email']}));
    // RUTA PE CARE VINE RĂSPUNSUL SERVERULUI DE AUTORIZARE
    app.get('/callback', passport.authenticate('google', { failureRedirect: '/auth'}), function(req, res) {
        res.redirect('/resurse');
    });

    //  ========== LOGOUT ==========
    app.get('/logout', function(req, res){
        req.logout();
        // req.session.destroy(function (err) {
        //     if (err) throw new Error('A apărut o eroare la logout: ', err);
        //     res.redirect('/');
        // });
        res.redirect('/');
    });
    
    // ========== PROFILUL PROPRIU ==========
    app.get('/profile',
        makeSureLoggedIn.ensureLoggedIn(),
        function clbkProfile (req, res) {
            // console.dir(req.user);
            res.render('profile', {
                user:    req.user,
                title:   "Profil",
                style:   "/lib/fontawesome/css/fontawesome.min.css",
                logoimg: "/img/red-logo-small30.png",
                credlogo: "../img/CREDlogo.jpg"
            });
        }
    );
    // ACCESAREA PROPRIILOR RESURSE
    app.get('/profile/resurse', makeSureLoggedIn.ensureLoggedIn(), function(req, res){
            // console.dir(req.user.email);
            var count = require('./controllers/resincred.ctrl')(req.user);
            // console.log(count);
            count.then(rezultat => {
                // console.log(rezultat);
                res.render('resurse-profil', {
                    user:    req.user,
                    title:   "Profil",
                    style:   "/lib/fontawesome/css/fontawesome.min.css",
                    logoimg: "/img/red-logo-small30.png",
                    credlogo: "../img/CREDlogo.jpg",
                    resurse: rezultat
                });
            }).catch(err => {
                if (err) throw err;
            });
        }
    );
    // Aducere unei singure resurse contribuite de utilizator

    // În cazul administratorilor, aceștia au acces la mecanismele de validare
    app.get('/profile/resurse/:idres', UserStrategies.ensureAuthenticated, function(req, res){
        // Adu înregistrarea resursei cu toate câmpurile referință populate deja
        var record = require('./controllers/resincredid.ctrl')(req.params);
        // FIXME: verifică dacă există în Elasticsearch înregistrarea corespondentă, dacă nu folosește .esSynchronize() a lui mongoose-elasticsearch-xp
        record.then(rezultat => {
            let scripts = [      
                {script: '/js/redincredadmin.js'},       
                {script: '/lib/moment/min/moment.min.js'}        
            ];
            let roles = ["user", "cred", "validator"];
            let confirmedRoles = checkRole(req.session.passport.user.roles.rolInCRED, roles);
            
            /* ====== VERIFICAREA CREDENȚIALELOR ====== */
            if(req.session.passport.user.roles.admin){
                // Adaugă mecanismul de validare a resursei
                if (rezultat[0].expertCheck) {
                    rezultat[0].validate = `<input type="checkbox" id="valid" class="expertCheck" checked>`;
                } else {
                    rezultat[0].validate = `<input type="checkbox" id="valid" class="expertCheck">`;
                }
                // Adaugă mecanismul de prezentare la public
                if (rezultat[0].generalPublic) {
                    rezultat[0].genPub = `<input type="checkbox" id="public" class="generalPublic" checked>`;
                } else {
                    rezultat[0].genPub = `<input type="checkbox" id="public" class="generalPublic">`;
                }                
                res.render('resursa-admin', {
                    user:    req.user,
                    title:   "Administrare RED",
                    style:   "/lib/fontawesome/css/fontawesome.min.css",
                    scripts,
                    logoimg: "/img/red-logo-small30.png",
                    credlogo: "../img/CREDlogo.jpg",
                    resursa: rezultat
                });
            } else if (confirmedRoles.length > 0) { // când ai cel puțin unul din rolurile menționate în roles, ai acces la formularul de trimitere a resursei.
                res.render('resursa', {
                    user:    req.user,
                    title:   "Afișare RED",
                    style:   "/lib/fontawesome/css/fontawesome.min.css",
                    logoimg: "/img/red-logo-small30.png",
                    credlogo: "../img/CREDlogo.jpg",
                    resursa: rezultat,
                    scripts
                });
            } else {
                res.redirect('/401');
            }
        }).catch(err => {
            if (err) throw err;
        });
    });

    // Sistem de asistență - HELP
    app.get('/help', makeSureLoggedIn.ensureLoggedIn(), function (req, res) {
        res.render('help', {
            user:    req.user,
            title:   "Asistență",
            style:   "/lib/fontawesome/css/fontawesome.min.css",
            logoimg: "/img/red-logo-small30.png",
            credlogo: "../img/CREDlogo.jpg"
        });
    });

    /* =========== CONSTRUCȚIA BAG-ULUI, INTRODUCEREA ÎNREGISTRĂRII, INTRODUCEREA ÎN ELASTICSEARCH ========= */
    /* SOCKETURI!!! */
    let lastBag;   // este o referință către un bag deja deschis
    let lastUuid;  // referință către UUID-ul în efect
    // EVENTS
    pubComm.on('connect', (socket) => {
        // Ascultă mesajele
        socket.on('mesaje', (mesaj) => {
            console.log('Standing by.... listening');
            console.log(mesaj);
        });

        // Primirea imaginilor pe socket conduce la crearea Bag-ului
        socket.on('resursa', function cbRes (resourceFile) {
            // creează calea pe care se va depozita.
            var calea = `${process.env.REPO_REL_PATH}${resourceFile.user}/`; // FIXME: Folosește path.join în viitor să dăm și celor de pe Windows o șansă

            // Transformarea Buffer-ului primit într-un stream `Readable`
            var strm = new Readable();
            strm.push(resourceFile.resF);  
            strm.push(null);

            // dacă resursa primită nu are uuid, înseamnă că este prima. Tratează cazul primei resurse
            if (!resourceFile.uuid) {
                // setează lastUuid
                lastUuid = uuidv1();
                // ajustează calea adăugând fragmentul uuid
                calea += `${lastUuid}`;
                // generează bag-ul pentru user
                lastBag = BagIt(calea, 'sha256', {'Contact-Name': `${resourceFile.name}`}); //creează bag-ul
                // adăugarea fișierului primit în Bag
                strm.pipe(lastBag.createWriteStream(`${resourceFile.numR}`));                
                // construiește obiectul de răspuns necesar lui Editor.js
                var responseObj = {
                    success: 1,
                    uuid: lastUuid,
                    file: `${process.env.BASE_URL}/${process.env.NAME_OF_REPO_DIR}/${resourceFile.user}/${lastUuid}/data/${resourceFile.numR}`
                };
                // trimite înapoi în client obiectul de care are nevoie Editor.js
                socket.emit('resursa', responseObj);
            } else if (resourceFile.uuid && lastUuid === resourceFile.uuid) {
                // dacă lastUuid este același cu cel primit din client, avem de-a face cu aceeași resursă
                // setează calea către directorul deja existent al resursei
                calea += `${resourceFile.uuid}`;
                lastBag = BagIt(calea, 'sha256');
                // introdu un nou fișier în Bag
                strm.pipe(lastBag.createWriteStream(`${resourceFile.numR}`));
                // construiește obiectul de răspuns.
                var responseObj4AddedFile = {
                    success: 1,
                    uuid: resourceFile.uuid,
                    file: `${process.env.BASE_URL}/${process.env.NAME_OF_REPO_DIR}/${resourceFile.user}/${resourceFile.uuid}/data/${resourceFile.numR}`
                };
                // trimite înapoi obiectul care reprezintă fișierul creat în Bag-ul resursei
                socket.emit('resursa', responseObj4AddedFile);
            } else {
                const err = new Error('message', 'nu pot încărca... se încearcă crearea unui bag nou');
            }
        });

        // În momentul în care se va apăsa butonul care creează resursa, se va închide și Bag-ul.
        socket.on('closeBag', () => {
            // finalizarea creării Bag-ului
            if (lastBag) {
                lastBag.finalize(() => {
                    // FIXME: setează bag-ul ca depozit git
                    socket.emit('closeBag', 'Am finalizat închiderea bag-ului');
                });
            } else {
                socket.emit('closeBag', 'Nu e niciun bag.');
            }
        });

        socket.on('log', (entry) => {
            var log = new Log({
                _id: new mongoose.Types.ObjectId(),
                date: Date.now(),
                title: entry.title,
                idContributor: entry.idContributor,
                autor: entry.autor,
                content: entry.content,
                contorAcces: entry.contorAcces
            });
            log.save().then((result) => {
                socket.emit('log', result);
            }).catch(err => {
                if (err) throw err;
            });            
        });

        // Introducerea resursei în baza de date MongoDB la finalizarea completării FORM01
        socket.on('red', (RED) => {
            // gestionează cazul în care nu ai un uuid generat pentru că resursa educațională, adică nu are niciun fișier încărcat
            if (!RED.uuid) {
                RED.uuid = uuidv1();
            }
            // Încarcă modelul cu date!!!
            var resursaEducationala = new Resursa({
                _id:             new mongoose.Types.ObjectId(),
                date:            Date.now(),
                identifier:      RED.uuid,
                idContributor:   RED.idContributor,
                autori:          RED.nameUser,
                langRED:         RED.langRED,
                title:           RED.title,
                titleI18n:       RED.titleI18n,
                arieCurriculara: RED.arieCurriculara,
                level:           RED.level,
                discipline:      RED.discipline,
                competenteGen:   RED.competenteGen,
                competenteS:     RED.competenteS,
                activitati:      RED.activitati,
                grupuri:         RED.grupuri,
                domeniu:         RED.domeniu,
                functii:         RED.functii,
                demersuri:       RED.demersuri,
                spatii:          RED.spatii,
                invatarea:       RED.invatarea,
                description:     RED.description,
                dependinte:      RED.dependinte,
                coperta:         RED.coperta,
                licenta:         RED.licenta,
                content:         RED.content,
                bibliografie:    RED.bibliografie,
                expertCheck:     RED.expertCheck,
                contorAcces:     0,
                generalPublic:   false,
                contorDescarcare:0,
                utilMie:         0,
                etichete:        RED.etichete
            });
            // SAVE!!! INDEXARE ÎN ACELAȘI MOMENT!
            var pResEd = resursaEducationala.populate('competenteS').execPopulate(); // returnează o promisiune
            pResEd.then(res => {
                res.save();
                socket.emit('red', res);
            }).catch(err => {
                if (err) throw err;
            });
        });

        // Ștergerea unei resurse
        socket.on('delresid', (resource) => {
            // console.log('Șterg resursa cu id-ul: ', resource);
            Resursa.findOneAndDelete({_id: resource.id}, (err, doc) => {
                if (err) throw err;
                // console.log(doc);
                var docId = doc._id;
                // TODO: Sterge fizic directorul cu totul
                let dirPath = path.join(process.env.REPO_REL_PATH, resource.contribuitor, resource.id);
                // console.log(dirPath);
                fs.remove(dirPath, (err) => {
                    if(err) throw err;
                    // console.log('Am șters directorul cu succes');
                    // socket.emit('delresid', 'Salut, client, am șters resursa: ', resource.id, 'contribuită de: ', resource.contributor);
                });
            });
        });

        // Aducerea resurselor pentru un id (email) și trimiterea în client
        socket.on('mkAdmin', (userSet) => {    
            // Atenție: https://mongoosejs.com/docs/deprecations.html#-findandmodify-
            let docUser = UserModel.findOne({_id: userSet.id}, 'admin');
            if (userSet.admin == true) {                
                docUser.exec(function clbkSetAdmTrue(error, doc) {
                    if (error) console.log(error);
                    doc.roles.admin = true;
                    doc.save().then(() => {
                        socket.emit('mkAdmin', {admin: true});
                    }).catch(err => {
                        if (err) throw err;
                    });
                });
            } else {
                docUser.exec(function clbkSetAdmFalse(error, doc) {
                    if (error) console.log(error);
                    doc.roles.admin = false;
                    doc.save().then(() => {
                        socket.emit('mkAdmin', {admin: false});
                    }).catch(err => {
                        if (err) throw err;
                    });
                });
            }   
        });

        // validarea resursei
        socket.on('validateRes', (queryObj) => {
            // eveniment declanșat din redincredadmin.js
            let resQuery = Resursa.findOne({_id: queryObj._id}, 'expertCheck');
            resQuery.exec(function (err, doc) {
                doc.expertCheck = queryObj.expertCheck;
                doc.save().then(newdoc => {
                    socket.emit('validateRes', {expertCheck: newdoc.expertCheck});
                }).catch(err => {
                    if (err) throw err;
                });
            });
        });

        // setarea resursei drept publică
        socket.on('setPubRes', (queryObj) => {
            // eveniment declanșat din redincredadmin.js
            let resQuery = Resursa.findOne({_id: queryObj._id}, 'generalPublic');
            resQuery.exec(function (err, doc) {
                doc.generalPublic = queryObj.generalPublic;
                doc.save().then(newdoc => {
                    socket.emit('setPubRes', {generalPublic: newdoc.generalPublic});
                }).catch(err => {
                    if (err) throw err;
                });
            });
        });

        // căutarea resurselor după disciplinele selectate
        socket.on('searchresdisc', (queryObj) => {
            // console.log(queryObj);
            let resQuery = Resursa.find({
                discipline: {$all: queryObj}
            });
            resQuery.exec(function (err, docs) {
                // console.log(docs);
                socket.emit('searchresdisc', docs);
            });
        });
        
        // căutarea termenilor în Elasticsearch
        socket.on('searchres', (queryString) => {
            const body = {
                query: {
                    query_string: {
                        "query": queryString,
                        "fuzziness": 2,
                        "fields": ["title", "description", "etichete", "discipline"]
                    },
                    highlight: {
                        fields: {
                            title: {},
                            description: {}
                        }
                    }
                }
            };
            // TODO: Integrează gestionarea cuvintelor evidențiate returnate de Elasticsearch: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-body.html#request-body-search-highlighting
            var promiseMeData = searchDoc('resursedus', body, (err, result) => {
                if (err) console.log(err);
                return result;
            });
            promiseMeData.then((result) => {
                socket.emit('searchres', result.hits.hits);
            }).catch(console.log);
        });

        // căutarea unui utilizator
        socket.on('person', queryString => {
            // https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html
            const body = {
                "query": {
                    "multi_match": {
                        "query": queryString,
                        "type": "best_fields",
                        "fields": ["email", "googleProfile", "name", "*_name"]        
                    }
                }
                // anterior am folosit https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html
                // de explorat: https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-simple-query-string-query.html
            };
            searchDoc('users', body, (err, result) => {
                if(err) throw err;
                return result;
            }).then((result) => {
                // pentru fiecare id din elasticsearch, cauta daca există o înregistrare în MongoDB. Dacă nu există în Mongo, șterge din Elastic.
                result.hits.hits.map((user) => {
                    // dacă documentul nu există în baza de date, șterge înregistrarea din Elastic
                    // console.log(UserModel.exists({_id: user._id}));
                    let checked = UserModel.exists({_id: user._id}).then((result) => {
                        if (!result) {
                            esClient.delete({
                                index: 'users',
                                type: 'user',
                                id: user._id
                            }).then((res) => {
                                console.log(res);
                            }).catch((error)=>{
                                console.log(error);
                            });
                        }
                    }).catch((error) => {
                        if (error) {
                            console.log(error);
                        }
                    });
                });

                socket.emit('person', result);
                // TODO: Aici ai putea testa daca ai date; daca nu ai date, tot aici ai putea face căutarea în baza Mongoose să vezi dacă există.
            }).catch((error) => {
                // if (error) socket.emit('person', error);
                // În cazul în care indexul nu există, constitue unul nou din colecția existentă în MongoDB
                if (error.status == 404) {
                    UserModel.on('es-bulk-sent', function () {
                        console.log('buffer sent');
                    });

                    UserModel.on('es-bulk-data', function (doc) {
                        console.log('Introduc ' + doc);
                    });
                    
                    UserModel.on('es-bulk-error', function (err) {
                        console.error(err);
                    });
                    
                    UserModel
                        .esSynchronize()
                        .then(function () {
                            console.log('Verifică acum');
                    });
                }
                socket.emit('mesaje', error);
                // console.log(error);
            });
        });

        // fișa completă de utilizator
        socket.on('personrecord', id => {
            // TODO: constituie un query care să aducă înregistrarea de user și ultimele sale 5 contribuții RED
            console.log(id);
            // https://mongoosejs.com/docs/api.html#model_Model.populate

            UserModel.findById(id, function clbkFindById (error, user) {
                if (error) console.log(error);
                var opts = [
                    {
                        path: 'resurse', 
                        options: {
                            sort: {date: -1}, // 1 este ascending; -1 deste descending (pornește cu ultima adusă)
                            limit: 5
                        },
                        model: Resursa
                    }
                ];

                UserModel.populate(user, opts, function clbkExecPopUser (error, res) {
                    // console.log(res);
                    socket.emit('personrecord', res);
                });
            });
        });
    });
    /* =========== CONSTRUCȚIA BAG-ULUI - END ========= */

    /* ========== ÎNCĂRCAREA UNUI fișier cu `multer` ========= */
    var multer  = require('multer');
    var multer2bag = require('./multer-bag-storage'); // încarcă mecanismul de storage special construit să gestioneze bag-uri!

    var storage = multer2bag({
        destination: function (req, file, cb) {
            // verifică dacă nu cumva mai întâi utilizatorul a ales să încarce o imagine. În acest caz, lastUuid poartă valoarea setată anterior.
            if (!lastUuid) {
                lastUuid = uuidv1(); // userul încarcă mai întâi de toate un  fișier tip document. Setezi uuid-ul pentru prima dată.
                pubComm.emit('uuid', lastUuid); // trimite clientului numele directorului pe care a fost salvată prima resursă încărcată
            }

            // Aceasta este cale pentru cazul în care nu există un director al resursei deja
            let firstDataPath = `${process.env.REPO_REL_PATH}${req.user.email}/${lastUuid}`;
            // Aceasta este calea pentru cazul în care deja există creat directorul resursei pentru că a fost încărcat deja un fișier.
            let existingDataPath = `${process.env.REPO_REL_PATH}${req.user.email}/${lastUuid}`;

            /* ======= Directorul utilizatorului nu există. Trebuie creat !!!! ========= */
            if (!fs.existsSync(firstDataPath)) {
                cb(null, firstDataPath);    // introdu primul fișier aici.
            } else if(fs.existsSync(existingDataPath)) {
                // cb(null, existingDataPath); // păstrează spațiile fișierului original dacă acestea le avea. La întoarcere în client, va fi un path rupt de spații.
                cb(null, existingDataPath);
            }
        },
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        }        
    });

    // Funcție helper pentru filtrarea extensiilor acceptate
    let fileFilter = function fileFltr (req, file, cb) {
        var fileObj = {
            "image/png": ".png",
            "image/jpeg": ".jpeg",
            "image/jpg": ".jpg",
            "application/pdf": ".pdf",
            "application/msword": ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "application/vnd.ms-powerpoint": ".ppt",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
            "application/octet-stream": ".zip",
            "application/vnd.oasis.opendocument.text": ".odt",
            "application/vnd.oasis.opendocument.presentation": ".odp"
        };
        if (fileObj[file.mimetype] == undefined) {
            cb(new Error("file format not valid"), false); // nu stoca fișierul și trimite eroarea
        } else {
            cb(null, true); // acceptă fișierul pentru a fi stocat
        }
    };

    // crearea mecanismului de stocare pentru ca multer să știe unde să trimită
    var upload = multer({
        storage: storage,
        limits: {
            // fileSize: 1024 * 1024 * 5 // limitarea dimensiunii fișierelor la 5MB
            fileSize: process.env.FILE_LIMIT_UPL_RES
        },
        fileFilter: fileFilter
    }); // multer() inițializează pachetul

    app.post('/repo', UserStrategies.ensureAuthenticated, upload.any(), function(req, res){
        // console.log('Detaliile lui files: ', req.files);
        var fileP = req.files[0].path;
        var parts = fileP.split('/');
        parts.shift(); // necesar pentru a șterge punctul din start-ul căii
        var cleanPath = parts.join('/'); // reasamblează calea curată

        // var fileName = querystring.escape(req.files[0].originalname);
        var fileName = req.files[0].originalname;
        var filePath = `${process.env.BASE_URL}/${cleanPath}/data/${fileName}`;
        // console.log('Calea formată înainte de a trimite înapoi: ', filePath);
        
        var resObj = {
            "success": 1,
            "file": {
                "url": `${filePath}`,
                "name": `${fileName}`
            }
        };
        // FIXME: În momentul în care utilizatorul decide să șteargă resursa din fișier, acest lucru ar trebui să se reflecte și pe hard disk.
        // Creează logica de ștergere a resursei care nu mai există în Frontend. Altfel, te vei trezi cu hardul plin de fișiere orfane.
        res.send(JSON.stringify(resObj));
    });
    // ========== ÎNCĂRCAREA UNUI FIȘIER cu `multer` - END =========

    // ========== 401 - NEPERMIS ==========
    app.get('/401', function(req, res){
        res.status(401);
        res.render('nepermis', {
            title:    "401",
            logoimg:  "img/red-logo-small30.png",
            mesaj:    "Încă nu ești autorizat pentru acestă zonă"
        });
    });

    //========== 404 - NEGĂSIT ==========
    app.use('*', function (req, res, next) {
        res.render('negasit', {
            title:    "404",
            logoimg:  "/img/red-logo-small30.png",
            imaginesplash: "/img/theseAreNotTheDroids.jpg",
            mesaj:    "Nu-i, verifică linkul!"
        });
    });

    return app;
};